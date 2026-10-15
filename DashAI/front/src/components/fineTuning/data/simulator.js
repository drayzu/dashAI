// Run simulation (SPEC §3.4). Pure functions, deterministic given the run
// seed and `now`: a run's visible state (phase, step, loss points, resources,
// events) is derived from a timeline planned when the run acquires the
// simulated GPU, so progress continues correctly after a page reload.

import { formatBytes, trainableParameters } from "./catalog";
import { estimateVram, fnv1a64 } from "./sft";

export const BASE_DURATIONS_MS = Object.freeze({
  preparing: 2000,
  downloading: 12000,
  validating: 3000,
  loading: 3000,
  evaluating: 2000,
  saving: 2000,
});
export const TRAINING_MS_PER_STEP = 600;
export const TRAINING_MIN_MS = 15000;
export const TRAINING_MAX_MS = 60000;
export const GPU_BUSY_WAIT_MS = 8000;
export const ADAPTER_MISSING_DELAY_MS = 4000;
export const STANDALONE_DOWNLOAD_MS = 12000;
export const MAX_POINTS = 400;

// Failure points as a fraction of the phase in which they happen.
export const FAILURE_PLAN = Object.freeze({
  incomplete_download: {
    phase: "downloading",
    fraction: 0.6,
    reason: "failed",
  },
  invalid_data_full: { phase: "validating", fraction: 0.5, reason: "failed" },
  mask_invalid: { phase: "validating", fraction: 0.85, reason: "failed" },
  oom: { phase: "training", fraction: 0.35, reason: "failed" },
  nan_loss: { phase: "training", fraction: 0.5, reason: "failed" },
  interrupted: { phase: "training", fraction: 0.55, reason: "interrupted" },
});
export const IMPLICIT_OOM_FRACTION = 0.2;

export function hashSeed(text) {
  return parseInt(fnv1a64(String(text)).slice(8), 16) >>> 0;
}

function mix(a, b) {
  let h = (a ^ Math.imul((b >>> 0) + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** Deterministic noise in [0, 1) indexed by (seed, i). */
export function noise(seed, i) {
  return mix(seed >>> 0, i >>> 0) / 4294967296;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v, d = 4) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

/** Steps mode: maxSteps. Epochs mode: ceil(train / (batch × accum)) × epochs. */
export function computeTotalSteps(draft, trainCount) {
  const p = (draft && draft.parameters) || {};
  if (draft && draft.durationMode === "epochs") {
    const effective = Math.max(
      1,
      (Number(p.batchSize) || 1) * (Number(p.gradAccum) || 1),
    );
    const perEpoch = Math.max(
      1,
      Math.ceil((Number(trainCount) || 0) / effective),
    );
    return Math.max(
      1,
      perEpoch * Math.max(1, Math.round(Number(p.epochs) || 1)),
    );
  }
  return Math.max(1, Math.round(Number(p.maxSteps) || 1));
}

export function trainingDurationMs(totalSteps) {
  return clamp(
    (Number(totalSteps) || 1) * TRAINING_MS_PER_STEP,
    TRAINING_MIN_MS,
    TRAINING_MAX_MS,
  );
}

/** Loss curve parameters for a run (start ≈ 2.4–2.8, floor from r and lr). */
export function lossCurve({ seed, loraR, learningRate, method, parametersB }) {
  const lr = Number(learningRate) || 2e-4;
  const r = Number(loraR) || 16;
  const lrFactor = clamp(Math.log10(2e-4 / lr), -0.6, 2);
  const start = 2.4 + 0.4 * noise(seed, 1);
  let floor = 0.46 + 0.22 * lrFactor + 0.08 * (16 / r - 1);
  floor += method === "qlora" ? 0.03 : 0;
  floor -= 0.06 * Math.log2(Math.max(0.25, (Number(parametersB) || 0.5) / 0.5));
  floor = clamp(floor + 0.05 * (noise(seed, 2) - 0.5), 0.22, 1.7);
  const k = 4.4 * Math.sqrt(clamp(lr / 2e-4, 0.2, 3));
  return { start: round(start, 3), floor: round(floor, 3), k: round(k, 3) };
}

function smoothLoss(x, curve) {
  return curve.floor + (curve.start - curve.floor) * Math.exp(-curve.k * x);
}

export function lossAt(step, totalSteps, curve, seed) {
  const x = clamp(step / Math.max(1, totalSteps), 0, 1);
  const amp = 0.09 * (1 - 0.5 * x);
  const n = (noise(seed, 1000 + step) - 0.5) * 2 * amp;
  return round(Math.max(0.05, smoothLoss(x, curve) + n));
}

export function evalLossAt(step, totalSteps, curve, seed) {
  const x = clamp(step / Math.max(1, totalSteps), 0, 1);
  const gap = 0.08 + 0.12 * noise(seed, 7);
  const uShape = totalSteps >= 100 ? 0.45 * Math.max(0, x - 0.55) ** 2 : 0;
  const n = (noise(seed, 5000 + step) - 0.5) * 0.03;
  return round(Math.max(0.05, smoothLoss(x, curve) + gap + uShape + n));
}

export function learningRateAt(step, totalSteps, params) {
  const base = Number(params.learningRate) || 2e-4;
  const warmup = Math.max(0, Number(params.warmupSteps) || 0);
  if (warmup > 0 && step <= warmup) return base * (step / warmup);
  const progress = clamp(
    (step - warmup) / Math.max(1, totalSteps - warmup),
    0,
    1,
  );
  switch (params.scheduler) {
    case "cosine":
      return base * 0.5 * (1 + Math.cos(Math.PI * progress));
    case "constant":
      return base;
    default:
      return base * (1 - progress);
  }
}

export function gradNormAt(step, totalSteps, seed) {
  const x = clamp(step / Math.max(1, totalSteps), 0, 1);
  const v =
    0.34 +
    0.95 * Math.exp(-3 * x) * (0.7 + 0.3 * noise(seed, 9000 + step)) +
    0.16 * noise(seed, 12000 + step);
  return round(clamp(v, 0.3, 1.5), 3);
}

function isEvalStep(step, metrics) {
  return (
    metrics.useEval &&
    metrics.evalEvery > 0 &&
    step % metrics.evalEvery === 0 &&
    step < metrics.totalSteps
  );
}

/**
 * Metric points for steps 1..uptoStep (≤ MAX_POINTS, eval steps always kept).
 * `finalEval` adds the end-of-training evaluation to the last point.
 */
export function buildPoints(metrics, uptoStep, { finalEval = false } = {}) {
  const points = [];
  const total = metrics.totalSteps;
  const upto = clamp(Math.floor(uptoStep), 0, total);
  const stride = Math.max(
    metrics.logEvery || 1,
    total > MAX_POINTS ? Math.ceil(total / MAX_POINTS) : 1,
  );
  const health = new Set(metrics.healthSteps || []);
  for (let s = 1; s <= upto; s += 1) {
    const evalHere = isEvalStep(s, metrics);
    const isLast = s === upto;
    if (!(s % stride === 0 || evalHere || isLast || s === 1)) continue;
    const point = {
      step: s,
      loss: lossAt(s, total, metrics.curve, metrics.seed),
      lr: Number(learningRateAt(s, total, metrics.lrParams).toPrecision(3)),
      gradNorm: health.has(s) ? null : gradNormAt(s, total, metrics.seed),
    };
    if (evalHere || (finalEval && s === total)) {
      point.evalLoss = evalLossAt(s, total, metrics.curve, metrics.seed);
    }
    points.push(point);
  }
  return points;
}

function formatLr(lr) {
  return Number(lr).toExponential(1);
}

function healthStepsFor(totalSteps) {
  const steps = [0.38, 0.41, 0.73].map((f) =>
    Math.max(1, Math.round(totalSteps * f)),
  );
  return [...new Set(steps)].filter((s) => s <= totalSteps);
}

/**
 * Plans a run once it gets the GPU.
 * @param {object} args
 * @param {object} args.run run with a frozen `snapshot`
 * @param {number} args.startAt time the GPU was acquired (ms)
 * @param {number} [args.speed] demo speed (1|4|20)
 * @param {string|null} [args.scenario] hidden failure scenario
 * @param {boolean} args.needsDownload checkpoint not ready at start
 * @param {number} [args.diskBytes] checkpoint size (download progress)
 * @param {string} [args.adapterName]
 * @param {number} [args.adapterBytes]
 * @returns {object} timeline (persisted in run.timeline)
 */
export function planRun({
  run,
  startAt,
  speed = 1,
  scenario = null,
  needsDownload = false,
  diskBytes = 0,
  adapterName = "",
  adapterBytes = 0,
}) {
  const snapshot = run.snapshot;
  const draft = snapshot.draft;
  const p = draft.parameters;
  const ds = snapshot.dataset || {};
  const ck = snapshot.checkpoint || {};
  const hw = snapshot.hardware || {};
  const totalSteps =
    snapshot.totalSteps || computeTotalSteps(draft, ds.trainCount);
  const seed = hashSeed(
    `${run.id}|${ds.fingerprint || ""}|${p.seed}|${run.createdAt}`,
  );
  const s = Math.max(1, Number(speed) || 1);
  const scale = (ms) => ms / s;
  const useEval = ds.useEval !== false && (ds.evalCount || 0) > 0;
  const revision7 = (ck.revision || "").slice(0, 7);

  const estimate =
    snapshot.estimatedVramGb ||
    estimateVram({
      parametersB: ck.parametersB,
      method: draft.method,
      batchSize: p.batchSize,
      maxLength: p.maxLength,
      loraR: p.loraR,
    });
  const available = Number(hw.vramGb) || 8;

  let failureDef = null;
  if (scenario && FAILURE_PLAN[scenario]) {
    const def = FAILURE_PLAN[scenario];
    if (scenario !== "incomplete_download" || needsDownload) {
      failureDef = { code: scenario, ...def };
    }
  } else if (!scenario && estimate > available * 1.05) {
    failureDef = {
      code: "oom",
      phase: "training",
      fraction: IMPLICIT_OOM_FRACTION,
      reason: "failed",
      implicit: true,
    };
  }

  const events = [];
  const push = (at, key, params = {}, level = "info") =>
    events.push({ t: Math.round(at), key, params, level });

  let t = startAt;
  let gpuWaitUntil = null;
  if (scenario === "gpu_busy") {
    push(t, "gpuWaiting", {}, "warn");
    t += scale(GPU_BUSY_WAIT_MS);
    gpuWaitUntil = Math.round(t);
    push(t, "gpuFree", {});
  }

  const nominal = [
    ["preparing", BASE_DURATIONS_MS.preparing],
    needsDownload ? ["downloading", BASE_DURATIONS_MS.downloading] : null,
    ["validating", BASE_DURATIONS_MS.validating],
    ["loading", BASE_DURATIONS_MS.loading],
    ["training", trainingDurationMs(totalSteps)],
    useEval ? ["evaluating", BASE_DURATIONS_MS.evaluating] : null,
    ["saving", BASE_DURATIONS_MS.saving],
  ].filter(Boolean);

  const curve = lossCurve({
    seed,
    loraR: p.loraR,
    learningRate: p.learningRate,
    method: draft.method,
    parametersB: ck.parametersB,
  });
  const metrics = {
    seed,
    totalSteps,
    curve,
    lrParams: {
      learningRate: p.learningRate,
      warmupSteps: p.warmupSteps,
      scheduler: p.scheduler,
    },
    evalEvery: Number(p.evalEvery) || 10,
    logEvery: Number(p.logEvery) || 1,
    useEval,
    healthSteps:
      scenario === "grad_norm_warning" ? healthStepsFor(totalSteps) : [],
  };

  const phasesStart = t;
  const nominalEndAt = Math.round(
    phasesStart + nominal.reduce((sum, [, base]) => sum + scale(base), 0),
  );
  const phases = [];
  let failure = null;
  for (const [phase, base] of nominal) {
    const span = scale(base);
    const start = t;
    if (failureDef && failureDef.phase === phase) {
      const end = start + span * failureDef.fraction;
      phases.push({
        phase,
        start: Math.round(start),
        end: Math.round(end),
        span,
        weight: base,
      });
      failure = {
        code: failureDef.code,
        phase,
        reason: failureDef.reason,
        at: Math.round(end),
        fraction: failureDef.fraction,
        implicit: Boolean(failureDef.implicit),
        step:
          phase === "training"
            ? Math.max(1, Math.floor(totalSteps * failureDef.fraction))
            : 0,
      };
      break;
    }
    phases.push({
      phase,
      start: Math.round(start),
      end: Math.round(start + span),
      span,
      weight: base,
    });
    t = start + span;
  }
  const endAt = failure ? failure.at : Math.round(t);
  const totalWeight = nominal.reduce((sum, [, w]) => sum + w, 0);

  // Scheduled events per phase.
  const bytes = (f) => Math.round(diskBytes * f);
  phases.forEach((ph) => {
    const at = (f) => ph.start + ph.span * f;
    const within = (f) => at(f) <= ph.end;
    switch (ph.phase) {
      case "preparing":
        push(at(0), "preparing");
        if (!needsDownload && within(0.6)) {
          push(at(0.6), "checkpointCached", {
            repository: ck.repository,
            revision: revision7,
          });
        }
        break;
      case "downloading":
        push(at(0), "downloadStarted", {
          repository: ck.repository,
          revision: revision7,
          size: formatBytes(diskBytes),
          sizeBytes: diskBytes,
        });
        [0.25, 0.5, 0.75].forEach((f) => {
          if (
            within(f) &&
            !(failure && failure.phase === "downloading" && at(f) >= failure.at)
          ) {
            push(at(f), "downloadProgress", {
              percent: Math.round(f * 100),
              done: formatBytes(bytes(f)),
              total: formatBytes(diskBytes),
            });
          }
        });
        if (!failure || failure.phase !== "downloading") {
          push(at(1), "downloadDone", {
            size: formatBytes(diskBytes),
            repository: ck.repository,
          });
        }
        break;
      case "validating":
        push(at(0), "validatingRows", {
          rows: ds.usedRows || ds.totalRows || 0,
        });
        if (within(0.35))
          push(at(0.35), "fingerprintOk", {
            fingerprint: ds.fingerprint || "",
          });
        if (
          within(0.55) &&
          !(failure && failure.code === "invalid_data_full")
        ) {
          if (useEval) {
            push(at(0.55), "splitDone", {
              train: ds.trainCount,
              eval: ds.evalCount,
              seed: ds.splitSeed,
            });
          } else {
            push(at(0.55), "splitDoneNoEval", { train: ds.trainCount });
          }
        }
        if (within(0.8) && !(failure && failure.code === "invalid_data_full")) {
          push(at(0.8), "templateApplied", {
            examples: ds.trainCount,
            supervisedTokens: ds.supervisedTokens || 0,
          });
        }
        break;
      case "loading": {
        push(
          at(0),
          draft.method === "qlora" ? "loadingBaseQlora" : "loadingBaseLora",
          {
            repository: ck.repository,
          },
        );
        if (within(0.7)) {
          const trainable = trainableParameters(
            ck.id,
            p.loraR,
            p.targetModules,
          );
          push(at(0.7), "loraAttached", {
            r: p.loraR,
            alpha: p.loraAlpha,
            modules: (p.targetModules || []).length,
            trainable: `${(trainable / 1e6).toFixed(1)} M`,
          });
        }
        break;
      }
      case "training": {
        push(at(0), "trainingStarted", {
          totalSteps,
          effectiveBatch:
            (Number(p.batchSize) || 1) * (Number(p.gradAccum) || 1),
        });
        const stepTime = (st) => ph.start + ph.span * (st / totalSteps);
        const scheduled = [];
        const logSteps = new Set();
        for (let k = 1; k <= 10; k += 1)
          logSteps.add(Math.max(1, Math.ceil((totalSteps * k) / 10)));
        logSteps.forEach((st) => {
          scheduled.push([
            st,
            0,
            "stepLog",
            {
              step: st,
              total: totalSteps,
              loss: lossAt(st, totalSteps, curve, seed).toFixed(4),
              lr: formatLr(learningRateAt(st, totalSteps, metrics.lrParams)),
            },
            "info",
          ]);
        });
        if (useEval) {
          const evalSteps = [];
          for (
            let st = metrics.evalEvery;
            st < totalSteps;
            st += metrics.evalEvery
          )
            evalSteps.push(st);
          const every = Math.max(1, Math.ceil(evalSteps.length / 12));
          evalSteps
            .filter((_, i) => i % every === 0)
            .forEach((st) => {
              scheduled.push([
                st,
                1,
                "evalLog",
                {
                  step: st,
                  evalLoss: evalLossAt(st, totalSteps, curve, seed).toFixed(4),
                },
                "info",
              ]);
            });
        }
        metrics.healthSteps.forEach((st) => {
          scheduled.push([st, 2, "gradNormWarning", { step: st }, "warn"]);
        });
        scheduled
          .sort((a, b) => a[0] - b[0] || a[1] - b[1])
          .forEach(([st, , key, params, level]) => {
            const when = stepTime(st);
            if (
              when <= ph.end &&
              (!failure || failure.phase !== "training" || st < failure.step)
            ) {
              push(when, key, params, level);
            }
          });
        break;
      }
      case "evaluating":
        push(at(0), "evaluating", { examples: ds.evalCount });
        push(at(1), "evalLog", {
          step: totalSteps,
          evalLoss: evalLossAt(totalSteps, totalSteps, curve, seed).toFixed(4),
        });
        break;
      case "saving":
        push(at(0), "saving");
        push(at(0.6), "verifying");
        push(at(1), "published", {
          adapterName,
          size: formatBytes(adapterBytes),
          sizeBytes: adapterBytes,
        });
        break;
      default:
        break;
    }
  });

  if (failure) {
    const params = { step: failure.step };
    if (failure.code === "oom") {
      params.used = (available * 0.97).toFixed(1);
      params.available = available.toFixed(1);
      params.estimated = estimate.toFixed(1);
    } else if (failure.code === "incomplete_download") {
      params.percent = 60;
      params.done = formatBytes(bytes(0.6));
      params.total = formatBytes(diskBytes);
    } else if (failure.code === "invalid_data_full") {
      params.row = 17;
      params.column =
        (draft.mapping &&
          (draft.mapping.output ||
            draft.mapping.completion ||
            draft.mapping.messages)) ||
        "output";
      params.problem = "empty";
    } else if (failure.code === "mask_invalid") {
      params.examples = 3;
      params.maxLength = p.maxLength;
    }
    failure.params = params;
    push(failure.at, `failed.${failure.code}`, params, "error");
  }

  events.sort((a, b) => a.t - b.t);

  const vramTargetGb = round(
    Math.min(estimate * (0.9 + 0.1 * noise(seed, 3)), available * 0.97),
    2,
  );
  const ramTargetGb = round(
    Math.min(
      3.0 + 1.6 * noise(seed, 4) + (Number(ck.parametersB) || 0.5) * 0.8,
      (Number(hw.ramGb) || 16) * 0.8,
    ),
    2,
  );

  return {
    version: 1,
    speed: s,
    startAt: Math.round(startAt),
    gpuWaitUntil,
    phases,
    plannedPhases: nominal.map(([ph]) => ph),
    totalWeight,
    endAt,
    nominalEndAt,
    outcome: failure
      ? failure.reason === "interrupted"
        ? "interrupted"
        : "failed"
      : "finished",
    failure,
    totalSteps,
    metrics,
    vramEstimateGb: estimate,
    vramAvailableGb: available,
    vramTargetGb,
    ramTargetGb,
    download: needsDownload ? { totalBytes: diskBytes } : null,
    adapterMissingAt:
      scenario === "missing_adapter" && !failure
        ? Math.round(endAt + scale(ADAPTER_MISSING_DELAY_MS))
        : null,
    events,
  };
}

function phaseAt(timeline, t) {
  const { phases } = timeline;
  for (let i = 0; i < phases.length; i += 1) {
    const ph = phases[i];
    if (t >= ph.start && t < ph.end) return ph;
  }
  return null;
}

function fractionOf(ph, t) {
  return clamp((t - ph.start) / Math.max(1, ph.span), 0, 1);
}

/** Simulated VRAM/RAM (GB) at time t. */
export function resourcesAt(timeline, t) {
  const firstStart = timeline.phases.length
    ? timeline.phases[0].start
    : timeline.endAt;
  if (t < firstStart || t >= timeline.endAt) return { vramGb: 0, ramGb: 0 };
  const ph = phaseAt(timeline, t);
  if (!ph) return { vramGb: 0, ramGb: 0 };
  const f = fractionOf(ph, t);
  const v = timeline.vramTargetGb;
  const r = timeline.ramTargetGb;
  const seed = timeline.metrics.seed;
  const bucket = Math.floor(t / 1000);
  let vram = 0;
  let ram = 0;
  switch (ph.phase) {
    case "preparing":
      ram = 0.9 + 0.5 * f;
      break;
    case "downloading":
      ram = 1.4 + 0.2 * f;
      break;
    case "validating":
      ram = 1.6 + (r - 1.6) * 0.3 * f;
      break;
    case "loading":
      vram = v * (0.15 + 0.8 * f);
      ram = r * (0.75 + 0.25 * f);
      break;
    case "training":
      vram = v * (0.96 + 0.04 * noise(seed, 20000 + bucket));
      ram = r * (0.92 + 0.06 * noise(seed, 30000 + bucket));
      break;
    case "evaluating":
      vram = v * 0.97;
      ram = r * 0.95;
      break;
    case "saving":
      vram = v * 0.93;
      ram = r;
      break;
    default:
      break;
  }
  return { vramGb: round(vram, 2), ramGb: round(ram, 2) };
}

/** Peak VRAM/RAM reached up to time t (analytic, independent of tick rate). */
export function peakResourcesUntil(timeline, t) {
  let vram = 0;
  let ram = 0;
  const until = Math.min(t, timeline.endAt);
  timeline.phases.forEach((ph) => {
    if (until <= ph.start) return;
    const probe = Math.min(until, ph.end) - 1;
    const r = resourcesAt(timeline, Math.max(ph.start, probe));
    vram = Math.max(vram, r.vramGb);
    ram = Math.max(ram, r.ramGb);
  });
  return { peakVramGb: vram, peakRamGb: ram };
}

/** Overall progress (0..1) by nominal phase weights. */
export function progressAt(timeline, t) {
  let done = 0;
  timeline.phases.forEach((ph) => {
    if (t <= ph.start) return;
    const until = Math.min(t, ph.end);
    done += ph.weight * clamp((until - ph.start) / Math.max(1, ph.span), 0, 1);
  });
  return round(clamp(done / Math.max(1, timeline.totalWeight), 0, 1), 4);
}

/** Training step reached at time t. */
export function stepAt(timeline, t) {
  const tr = timeline.phases.find((ph) => ph.phase === "training");
  if (!tr || t < tr.start) return 0;
  const raw = Math.floor(
    ((Math.min(t, tr.end) - tr.start) / Math.max(1, tr.span)) *
      timeline.totalSteps,
  );
  let step = clamp(raw, 0, timeline.totalSteps);
  if (timeline.failure && timeline.failure.phase === "training") {
    step = Math.min(step, timeline.failure.step);
  }
  return step;
}

function sameResources(a, b) {
  return (
    a &&
    b &&
    a.vramGb === b.vramGb &&
    a.ramGb === b.ramGb &&
    a.peakVramGb === b.peakVramGb &&
    a.peakRamGb === b.peakRamGb
  );
}

/**
 * Derives the visible state of a run with a timeline at `now`.
 * Returns the same `run` object when nothing visible changed.
 * effects: { checkpoint?: {availability, downloadedBytes}, terminal?: true,
 *   outcome?: "finished"|"failed"|"interrupted" }
 */
export function deriveRun(run, now) {
  const tl = run.timeline;
  if (!tl) return { run, effects: {} };
  const effects = {};
  const t = Math.min(now, tl.endAt);
  const terminal = now >= tl.endAt;

  // Events (precomputed; copied once their time has come).
  let cursor = run.eventCursor || 0;
  const newEvents = [];
  while (cursor < tl.events.length && tl.events[cursor].t <= now) {
    newEvents.push(tl.events[cursor]);
    cursor += 1;
  }

  const firstStart = tl.phases.length ? tl.phases[0].start : tl.endAt;
  if (now < firstStart) {
    // Still waiting for the GPU (gpu_busy scenario): status stays queued.
    if (newEvents.length === 0) return { run, effects };
    return {
      run: {
        ...run,
        events: [...run.events, ...newEvents],
        eventCursor: cursor,
      },
      effects,
    };
  }

  let current = phaseAt(tl, t);
  if (!current && tl.phases.length) current = tl.phases[tl.phases.length - 1];
  const step = terminal && !tl.failure ? tl.totalSteps : stepAt(tl, t);
  const evaluating = tl.phases.find((ph) => ph.phase === "evaluating");
  const finalEval = Boolean(evaluating && t >= evaluating.end);
  const pointsUpTo =
    tl.failure && tl.failure.code === "nan_loss" ? Math.max(0, step - 1) : step;
  const pointsChanged =
    !run.points ||
    run.points.length === 0 ||
    run.points[run.points.length - 1].step !== pointsUpTo ||
    (finalEval && run.points[run.points.length - 1].evalLoss === undefined);
  const points = pointsChanged
    ? buildPoints(tl.metrics, pointsUpTo, { finalEval })
    : run.points;

  // Resources and peaks.
  const prevRes = run.resources || {
    vramGb: 0,
    ramGb: 0,
    peakVramGb: 0,
    peakRamGb: 0,
  };
  const cur = terminal ? { vramGb: 0, ramGb: 0 } : resourcesAt(tl, t);
  const analytic = peakResourcesUntil(tl, t);
  let peakVramGb = Math.max(
    prevRes.peakVramGb || 0,
    cur.vramGb,
    analytic.peakVramGb,
  );
  let peakRamGb = Math.max(
    prevRes.peakRamGb || 0,
    cur.ramGb,
    analytic.peakRamGb,
  );
  if (terminal && tl.failure && tl.failure.code === "oom") {
    peakVramGb = Math.max(peakVramGb, round(tl.vramAvailableGb * 0.97, 2));
  }
  if (terminal && !tl.failure) {
    peakVramGb = Math.max(peakVramGb, tl.vramTargetGb);
    peakRamGb = Math.max(peakRamGb, tl.ramTargetGb);
  }
  const resources = {
    vramGb: cur.vramGb,
    ramGb: cur.ramGb,
    peakVramGb,
    peakRamGb,
  };

  // Download progress and checkpoint effects.
  let download = run.download;
  const dl = tl.phases.find((ph) => ph.phase === "downloading");
  if (dl && tl.download) {
    const failedHere = tl.failure && tl.failure.phase === "downloading";
    const f = t < dl.start ? 0 : fractionOf(dl, Math.min(t, dl.end));
    const doneBytes = Math.round(tl.download.totalBytes * f);
    download = { totalBytes: tl.download.totalBytes, doneBytes };
    if (t >= dl.start) {
      if (t < dl.end) {
        effects.checkpoint = {
          availability: "downloading",
          downloadedBytes: doneBytes,
        };
      } else if (failedHere) {
        effects.checkpoint = {
          availability: "invalid",
          downloadedBytes: doneBytes,
        };
      } else {
        effects.checkpoint = {
          availability: "ready",
          downloadedBytes: tl.download.totalBytes,
        };
      }
    }
  }

  const healthWarnings = (tl.metrics.healthSteps || [])
    .filter((s) => s <= step)
    .map((s) => ({ step: s, field: "grad_norm", value: "NaN" }));

  let status = 2;
  let phase = current ? current.phase : null;
  let terminationReason = null;
  let failure = null;
  let progress = progressAt(tl, t);
  let endedAt = null;
  if (terminal) {
    effects.terminal = true;
    effects.outcome = tl.outcome;
    endedAt = tl.endAt;
    if (tl.failure) {
      status = 4;
      terminationReason = tl.failure.reason;
      failure = {
        code: tl.failure.code,
        phase: tl.failure.phase,
        step: tl.failure.step,
        params: tl.failure.params,
      };
      phase = tl.failure.phase;
    } else {
      status = 3;
      phase = null;
      progress = 1;
    }
  }

  const unchanged =
    run.status === status &&
    run.phase === phase &&
    run.step === step &&
    run.progress === progress &&
    newEvents.length === 0 &&
    points === run.points &&
    sameResources(run.resources, resources) &&
    (run.download
      ? download && run.download.doneBytes === download.doneBytes
      : !download) &&
    (run.healthWarnings || []).length === healthWarnings.length &&
    !terminal;
  if (unchanged) return { run, effects };

  return {
    run: {
      ...run,
      status,
      phase,
      terminationReason,
      failure,
      startedAt: run.startedAt || firstStart,
      endedAt: endedAt || run.endedAt || null,
      progress,
      step,
      totalSteps: tl.totalSteps,
      points,
      resources,
      download: download || null,
      events: newEvents.length ? [...run.events, ...newEvents] : run.events,
      eventCursor: cursor,
      healthWarnings,
    },
    effects,
  };
}

function rescaleTime(time, now, factor) {
  if (time === null || time === undefined || time <= now) return time;
  return Math.round(now + (time - now) * factor);
}

/**
 * Rescales the future part of a timeline around `now` (demo speed change).
 * factor = oldSpeed / newSpeed. Phase fractions stay continuous at `now`.
 */
export function rescaleTimeline(timeline, now, factor, newSpeed) {
  if (!timeline || !(factor > 0) || factor === 1) return timeline;
  const phases = timeline.phases.map((ph) => {
    if (ph.end <= now) return ph;
    if (ph.start >= now) {
      return {
        ...ph,
        start: rescaleTime(ph.start, now, factor),
        end: rescaleTime(ph.end, now, factor),
        span: ph.span * factor,
      };
    }
    const f = (now - ph.start) / Math.max(1, ph.span);
    const span = ph.span * factor;
    return {
      ...ph,
      start: Math.round(now - f * span),
      end: rescaleTime(ph.end, now, factor),
      span,
    };
  });
  return {
    ...timeline,
    speed: newSpeed || timeline.speed,
    phases,
    endAt: rescaleTime(timeline.endAt, now, factor),
    nominalEndAt: rescaleTime(timeline.nominalEndAt, now, factor),
    gpuWaitUntil: rescaleTime(timeline.gpuWaitUntil, now, factor),
    adapterMissingAt: rescaleTime(timeline.adapterMissingAt, now, factor),
    failure: timeline.failure
      ? {
          ...timeline.failure,
          at: rescaleTime(timeline.failure.at, now, factor),
        }
      : null,
    events: timeline.events.map((e) =>
      e.t > now ? { ...e, t: rescaleTime(e.t, now, factor) } : e,
    ),
  };
}

/** Elapsed / remaining helpers for the UI (ms). */
export function runTiming(run, now) {
  const tl = run && run.timeline;
  const startedAt = run && run.startedAt;
  if (!startedAt) return { elapsedMs: 0, remainingMs: null };
  const end = run.endedAt || now;
  const elapsedMs = Math.max(0, end - startedAt);
  if (!tl || run.endedAt)
    return { elapsedMs, remainingMs: run.endedAt ? 0 : null };
  // ETA from the nominal plan (a planned failure must not leak into the UI).
  const planned = tl.nominalEndAt || tl.endAt;
  return { elapsedMs, remainingMs: Math.max(0, planned - now) };
}
