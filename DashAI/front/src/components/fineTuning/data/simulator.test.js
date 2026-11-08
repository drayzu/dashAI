import {
  GPU_BUSY_WAIT_MS,
  buildPoints,
  computeTotalSteps,
  deriveRun,
  learningRateAt,
  lossAt,
  lossCurve,
  planRun,
  rescaleTimeline,
  runTiming,
  stepAt,
} from "./simulator";
import { createDefaultDraft, SIMULATED_HARDWARE } from "./catalog";

const T0 = Date.UTC(2026, 9, 14, 12, 0, 0);

function makeRun({
  id = "run-1",
  parametersB = 0.49,
  method = "qlora",
  parameters = {},
  useEval = true,
  durationMode = "steps",
} = {}) {
  const draft = createDefaultDraft({
    checkpointId: "qwen2.5-0.5b-instruct",
    method,
    durationMode,
    format: "alpaca",
    mapping: { instruction: "instruction", input: "input", output: "output" },
    parameters: { maxSteps: 60, ...parameters },
  });
  const trainCount = 43;
  return {
    id,
    createdAt: T0 - 1000,
    status: 1,
    events: [],
    points: [],
    resources: { vramGb: 0, ramGb: 0, peakVramGb: 0, peakRamGb: 0 },
    eventCursor: 0,
    snapshot: {
      draft,
      checkpoint: {
        id: "qwen2.5-0.5b-instruct",
        name: "Qwen2.5 0.5B Instruct",
        repository: "Qwen/Qwen2.5-0.5B-Instruct",
        revision: "7ae557604adf67be50417f59c2c2f167def9a775",
        parametersB,
        diskBytes: 988097824,
      },
      dataset: {
        id: "fichas-soporte",
        fingerprint: "0123456789abcdef",
        trainCount,
        evalCount: useEval ? 5 : 0,
        useEval,
        totalRows: 48,
        usedRows: 48,
        splitSeed: 42,
        supervisedTokens: 2600,
      },
      hardware: { ...SIMULATED_HARDWARE },
      totalSteps: computeTotalSteps(draft, trainCount),
    },
  };
}

function plan(run, opts = {}) {
  const timeline = planRun({
    run,
    startAt: T0,
    speed: 1,
    scenario: null,
    needsDownload: false,
    diskBytes: run.snapshot.checkpoint.diskBytes,
    adapterName: "Adaptador",
    adapterBytes: 35_200_000,
    ...opts,
  });
  return { ...run, timeline };
}

const derive = (run, t) => deriveRun(run, t).run;
const phaseStart = (run, phase) =>
  run.timeline.phases.find((p) => p.phase === phase);

describe("computeTotalSteps", () => {
  it("uses maxSteps in steps mode and batches × epochs in epochs mode", () => {
    expect(
      computeTotalSteps(
        createDefaultDraft({ parameters: { maxSteps: 120 } }),
        43,
      ),
    ).toBe(120);
    const epochs = createDefaultDraft({
      durationMode: "epochs",
      parameters: { epochs: 2, batchSize: 2, gradAccum: 4 },
    });
    // ceil(43 / 8) × 2 = 12
    expect(computeTotalSteps(epochs, 43)).toBe(12);
  });
});

describe("planRun / deriveRun: success", () => {
  it("skips downloading when the checkpoint is ready and finishes with a full curve", () => {
    const run = plan(makeRun());
    expect(run.timeline.plannedPhases).toEqual([
      "preparing",
      "validating",
      "loading",
      "training",
      "evaluating",
      "saving",
    ]);
    // durations at speed 1: 2 + 3 + 3 + 36 + 2 + 2 s
    expect(run.timeline.endAt - T0).toBe(48000);

    const preparing = derive(run, T0 + 500);
    expect(preparing).toMatchObject({ status: 2, phase: "preparing", step: 0 });
    expect(preparing.events.map((e) => e.key)).toEqual(["preparing"]);

    const tr = phaseStart(run, "training");
    const mid = derive(run, tr.start + tr.span / 2);
    expect(mid).toMatchObject({ status: 2, phase: "training", step: 30 });
    expect(mid.points).toHaveLength(30);
    expect(mid.resources.vramGb).toBeGreaterThan(1);

    const done = derive(run, T0 + 60000);
    expect(done).toMatchObject({
      status: 3,
      phase: null,
      progress: 1,
      step: 60,
      terminationReason: null,
    });
    expect(done.points).toHaveLength(60);
    expect(typeof done.points[59].evalLoss).toBe("number");
    expect(
      done.points.filter((p) => typeof p.evalLoss === "number"),
    ).toHaveLength(6);
    expect(done.resources).toMatchObject({ vramGb: 0, ramGb: 0 });
    expect(done.resources.peakVramGb).toBeGreaterThan(1);
    const keys = done.events.map((e) => e.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "checkpointCached",
        "validatingRows",
        "fingerprintOk",
        "splitDone",
        "templateApplied",
        "loadingBaseQlora",
        "loraAttached",
        "trainingStarted",
        "stepLog",
        "evalLog",
        "evaluating",
        "saving",
        "verifying",
        "published",
      ]),
    );
    expect(keys).not.toContain("downloadStarted");
    expect(keys.filter((k) => k === "stepLog")).toHaveLength(10);
  });

  it("downloads only when the checkpoint is missing, with byte progress", () => {
    const run = plan(makeRun(), { needsDownload: true });
    expect(run.timeline.plannedPhases).toContain("downloading");
    const dl = phaseStart(run, "downloading");
    const halfway = deriveRun(run, dl.start + dl.span / 2);
    expect(halfway.run.phase).toBe("downloading");
    expect(halfway.run.download.doneBytes).toBe(Math.round(988097824 / 2));
    expect(halfway.effects.checkpoint.availability).toBe("downloading");
    const after = deriveRun(run, dl.end + 10);
    expect(after.effects.checkpoint).toEqual({
      availability: "ready",
      downloadedBytes: 988097824,
    });
    expect(after.run.events.map((e) => e.key)).toEqual(
      expect.arrayContaining([
        "downloadStarted",
        "downloadProgress",
        "downloadDone",
      ]),
    );
  });

  it("is reload-safe: incremental ticks equal a single late derivation", () => {
    const run = plan(makeRun());
    let incremental = run;
    for (let t = T0; t <= T0 + 50000; t += 500)
      incremental = derive(incremental, t);
    const once = derive(run, T0 + 50000);
    expect(incremental.points).toEqual(once.points);
    expect(incremental.events).toEqual(once.events);
    expect(incremental.status).toBe(once.status);
    expect(incremental.step).toBe(once.step);
  });

  it("skips the evaluating phase without evaluation split", () => {
    const run = plan(makeRun({ useEval: false }));
    expect(run.timeline.plannedPhases).not.toContain("evaluating");
    const done = derive(run, T0 + 100000);
    expect(done.points.some((p) => typeof p.evalLoss === "number")).toBe(false);
  });
});

describe("failure scenarios", () => {
  it("oom fails at 35% of training", () => {
    const run = plan(makeRun(), { scenario: "oom" });
    const end = derive(run, T0 + 100000);
    expect(end).toMatchObject({
      status: 4,
      terminationReason: "failed",
      phase: "training",
    });
    expect(end.failure).toMatchObject({
      code: "oom",
      phase: "training",
      step: 21,
    });
    expect(end.events[end.events.length - 1]).toMatchObject({
      key: "failed.oom",
      level: "error",
    });
    expect(end.resources.peakVramGb).toBeCloseTo(8 * 0.97, 1);
  });

  it("incomplete_download fails at 60% of the download, and only when downloading", () => {
    const run = plan(makeRun(), {
      scenario: "incomplete_download",
      needsDownload: true,
    });
    const { run: end, effects } = deriveRun(run, T0 + 100000);
    expect(end).toMatchObject({
      status: 4,
      phase: "downloading",
      terminationReason: "failed",
    });
    expect(end.download.doneBytes).toBe(Math.round(988097824 * 0.6));
    expect(effects.checkpoint.availability).toBe("invalid");
    expect(end.events.map((e) => e.key)).not.toContain("downloadDone");

    const noDownload = plan(makeRun(), {
      scenario: "incomplete_download",
      needsDownload: false,
    });
    expect(derive(noDownload, T0 + 100000).status).toBe(3);
  });

  it("invalid_data_full and mask_invalid fail in validating", () => {
    const invalid = derive(
      plan(makeRun(), { scenario: "invalid_data_full" }),
      T0 + 100000,
    );
    expect(invalid).toMatchObject({ status: 4, phase: "validating" });
    expect(invalid.failure.params).toMatchObject({
      row: 17,
      column: "output",
      problem: "empty",
    });
    expect(invalid.events.map((e) => e.key)).not.toContain("splitDone");

    const mask = derive(
      plan(makeRun(), { scenario: "mask_invalid" }),
      T0 + 100000,
    );
    expect(mask).toMatchObject({ status: 4, phase: "validating" });
    expect(mask.failure).toMatchObject({ code: "mask_invalid" });
    expect(mask.failure.params).toMatchObject({ examples: 3, maxLength: 512 });
    expect(mask.points).toHaveLength(0);
  });

  it("nan_loss stops at 50% of training without a NaN point", () => {
    const end = derive(plan(makeRun(), { scenario: "nan_loss" }), T0 + 100000);
    expect(end.failure).toMatchObject({ code: "nan_loss", step: 30 });
    expect(end.points).toHaveLength(29);
    expect(end.points.every((p) => Number.isFinite(p.loss))).toBe(true);
  });

  it("interrupted ends with reason interrupted at 55%", () => {
    const end = derive(
      plan(makeRun(), { scenario: "interrupted" }),
      T0 + 100000,
    );
    expect(end).toMatchObject({
      status: 4,
      terminationReason: "interrupted",
      phase: "training",
    });
    expect(end.failure.step).toBe(33);
  });

  it("grad_norm_warning finishes with health warnings and warn events", () => {
    const end = derive(
      plan(makeRun(), { scenario: "grad_norm_warning" }),
      T0 + 100000,
    );
    expect(end.status).toBe(3);
    expect(end.healthWarnings.map((w) => w.step)).toEqual([23, 25, 44]);
    expect(end.healthWarnings[0]).toMatchObject({
      field: "grad_norm",
      value: "NaN",
    });
    expect(
      end.events.filter(
        (e) => e.key === "gradNormWarning" && e.level === "warn",
      ),
    ).toHaveLength(3);
    expect(end.points.find((p) => p.step === 23).gradNorm).toBeNull();
  });

  it("missing_adapter succeeds and schedules the adapter loss", () => {
    const run = plan(makeRun(), { scenario: "missing_adapter" });
    expect(derive(run, T0 + 100000).status).toBe(3);
    expect(run.timeline.adapterMissingAt).toBe(run.timeline.endAt + 4000);
  });

  it("gpu_busy keeps the run queued for 8 s, then proceeds", () => {
    const run = plan(makeRun(), { scenario: "gpu_busy" });
    const waiting = derive(run, T0 + 4000);
    expect(waiting).toMatchObject({ status: 1 });
    expect(waiting.events.map((e) => e.key)).toEqual(["gpuWaiting"]);
    const going = derive(run, T0 + GPU_BUSY_WAIT_MS + 500);
    expect(going).toMatchObject({ status: 2, phase: "preparing" });
    expect(going.startedAt).toBe(T0 + GPU_BUSY_WAIT_MS);
    expect(derive(run, T0 + 200000).status).toBe(3);
  });

  it("fails with oom at 20% when the estimate exceeds the available VRAM", () => {
    const big = makeRun({
      parametersB: 1.54,
      method: "lora",
      parameters: { batchSize: 4, maxLength: 1024, maxSteps: 120 },
    });
    const end = derive(plan(big), T0 + 200000);
    expect(end.failure).toMatchObject({ code: "oom", step: 24 });
    expect(end.terminationReason).toBe("failed");
  });
});

describe("metrics", () => {
  it("produces believable loss curves and a warmup learning rate", () => {
    const curve = lossCurve({
      seed: 123,
      loraR: 16,
      learningRate: 2e-4,
      method: "qlora",
      parametersB: 0.49,
    });
    expect(curve.start).toBeGreaterThanOrEqual(2.4);
    expect(curve.start).toBeLessThanOrEqual(2.8);
    expect(lossAt(1, 60, curve, 123)).toBeGreaterThan(
      lossAt(60, 60, curve, 123),
    );
    const slow = lossCurve({
      seed: 123,
      loraR: 16,
      learningRate: 2e-5,
      method: "qlora",
      parametersB: 0.49,
    });
    expect(slow.floor).toBeGreaterThan(curve.floor);
    const params = { learningRate: 2e-4, warmupSteps: 5, scheduler: "linear" };
    expect(learningRateAt(1, 60, params)).toBeCloseTo(4e-5);
    expect(learningRateAt(5, 60, params)).toBeCloseTo(2e-4);
    expect(learningRateAt(60, 60, params)).toBeCloseTo(0);
  });

  it("caps points at 400 and keeps them stable across calls", () => {
    const metrics = {
      seed: 9,
      totalSteps: 2000,
      curve: { start: 2.6, floor: 0.5, k: 4 },
      lrParams: { learningRate: 2e-4, warmupSteps: 5, scheduler: "cosine" },
      evalEvery: 500,
      logEvery: 1,
      useEval: true,
      healthSteps: [],
    };
    const points = buildPoints(metrics, 2000, { finalEval: true });
    expect(points.length).toBeLessThanOrEqual(401);
    expect(buildPoints(metrics, 2000, { finalEval: true })).toEqual(points);
    expect(points[points.length - 1]).toMatchObject({ step: 2000 });
    expect(typeof points[points.length - 1].evalLoss).toBe("number");
  });
});

describe("rescaleTimeline", () => {
  it("keeps the current step continuous and shortens the remaining time", () => {
    const run = plan(makeRun({ parameters: { maxSteps: 60 } }));
    const tr = phaseStart(run, "training");
    const now = tr.start + tr.span * 0.25;
    const before = stepAt(run.timeline, now);
    const faster = rescaleTimeline(run.timeline, now, 1 / 20, 20);
    expect(stepAt(faster, now)).toBe(before);
    expect(faster.endAt).toBeLessThan(run.timeline.endAt);
    expect(faster.endAt - now).toBe(
      Math.round((run.timeline.endAt - now) / 20),
    );
    const rescaledRun = { ...run, timeline: faster };
    expect(derive(rescaledRun, faster.endAt + 1).status).toBe(3);
    expect(
      runTiming(derive(rescaledRun, now + 100), now + 100).remainingMs,
    ).toBeGreaterThan(0);
  });
});
