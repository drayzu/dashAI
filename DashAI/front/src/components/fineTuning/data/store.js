// Client-side store of the simulated fine-tuning prototype (SPEC §3.2).
// Framework-agnostic (subscribe/getSnapshot for useSyncExternalStore).
// The state is plain JSON persisted in localStorage under one key per
// prototype; it never talks to the backend.

import {
  DATA_PREP_KEYS,
  DEFAULT_PARAMETERS,
  LIBRARY_VERSIONS,
  PRESETS,
  RUN_CONFIG_KEYS,
  SIMULATED_HARDWARE,
  SPEEDS,
  FAILURE_CODES,
  createDefaultDraft,
  createInitialCheckpoints,
  estimateAdapterBytes,
  validateParameters,
} from "./catalog";
import {
  estimateVram,
  missingMappingFields,
  prepareDataset,
  detectFormat,
  suggestMapping,
} from "./sft";
import {
  FICHA_INSTRUCTION,
  HELD_OUT_CASES,
  getSampleDataset,
  sampleDatasetRef,
} from "./sampleDatasets";
import { checkFicha, simulateLatencyMs, simulateResponse } from "./responses";
import {
  STANDALONE_DOWNLOAD_MS,
  computeTotalSteps,
  deriveRun,
  hashSeed,
  noise,
  planRun,
  rescaleTimeline,
} from "./simulator";
import {
  activeRun,
  adapterById,
  checkpointById,
  gpuBusyByTraining,
  isActiveStatus,
  isTimeDependent,
  queuedRuns,
  runById,
  sessionById,
} from "./selectors";

export const STATE_VERSION = 1;
export const TICK_MS = 500;
export const TICK_PERSIST_MS = 2000;
export const DEFAULT_CHAT_PARAMS = Object.freeze({
  temperature: 0.7,
  maxNewTokens: 256,
  topP: 0.9,
});
export const COMPARISON_STEP_MS = 300;

const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;

const METHOD_LABEL = { qlora: "QLoRA", lora: "LoRA" };

/** Error thrown by store actions: `error.code` (first) and `error.codes` (all). */
export function codedError(codes, details) {
  const list = Array.isArray(codes) ? codes : [codes];
  const error = new Error(list[0]);
  error.code = list[0];
  error.codes = list;
  if (details) error.details = details;
  return error;
}

function deepCopy(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function safeDefaultStorage() {
  try {
    return typeof window !== "undefined" && window.localStorage
      ? window.localStorage
      : null;
  } catch (e) {
    return null;
  }
}

const ARRAY_KEYS = [
  "checkpoints",
  "sessions",
  "runs",
  "adapters",
  "chats",
  "comparisons",
  "importedDatasets",
];

/** Accepts only version 1 states with well-formed arrays. */
export function isValidState(obj) {
  if (!obj || typeof obj !== "object" || obj.version !== STATE_VERSION)
    return false;
  if (typeof obj.counter !== "number") return false;
  if (!ARRAY_KEYS.every((k) => Array.isArray(obj[k]))) return false;
  if (!obj.demo || typeof obj.demo !== "object") return false;
  if (
    !obj.sessions.every(
      (s) =>
        s && typeof s.id === "string" && s.draft && typeof s.draft === "object",
    )
  ) {
    return false;
  }
  if (
    !obj.runs.every(
      (r) =>
        r &&
        typeof r.id === "string" &&
        typeof r.status === "number" &&
        r.snapshot,
    )
  ) {
    return false;
  }
  if (!obj.chats.every((c) => c && Array.isArray(c.messages))) return false;
  if (!obj.comparisons.every((c) => c && Array.isArray(c.items))) return false;
  return obj.checkpoints.every((c) => c && typeof c.id === "string");
}

export function createEmptyState() {
  return {
    version: STATE_VERSION,
    counter: 0,
    checkpoints: createInitialCheckpoints(),
    sessions: [],
    runs: [],
    adapters: [],
    chats: [],
    comparisons: [],
    demo: { speed: 1, nextFailure: null, gpuBusy: false, hfCredential: false },
    importedDatasets: [],
    storageError: false,
    gpuFreeAt: 0,
  };
}

function alloc(state, prefix) {
  const counter = state.counter + 1;
  return [`${prefix}-${counter}`, { ...state, counter }];
}

function replaceById(list, id, fn) {
  let changed = false;
  const next = list.map((item) => {
    if (item.id !== id) return item;
    const updated = fn(item);
    if (updated !== item) changed = true;
    return updated;
  });
  return changed ? next : list;
}

function uniqueName(base, existing) {
  const names = new Set(existing);
  if (!names.has(base)) return base;
  let i = 2;
  while (names.has(`${base} (${i})`)) i += 1;
  return `${base} (${i})`;
}

function nextSessionName(state) {
  const names = new Set(state.sessions.map((s) => s.name));
  let n = 1;
  while (names.has(`Sesión ${n}`)) n += 1;
  return `Sesión ${n}`;
}

// Full draft for a run: session data preparation + run configuration.
function mergeConfig(sessionDraft, configDraft) {
  const base = createDefaultDraft(deepCopy(sessionDraft || {}));
  if (!configDraft) return base;
  const next = { ...base };
  RUN_CONFIG_KEYS.forEach((key) => {
    if (key in configDraft && configDraft[key] !== undefined) {
      next[key] =
        key === "parameters"
          ? { ...base.parameters, ...deepCopy(configDraft.parameters) }
          : deepCopy(configDraft[key]);
    }
  });
  return next;
}

function restoreDraft(frozenDraft) {
  const copy = deepCopy(frozenDraft || {});
  return createDefaultDraft({
    ...copy,
    parameters: { ...DEFAULT_PARAMETERS, ...(copy.parameters || {}) },
  });
}

/** Run-config part of a draft (B: what a run configuration owns). */
export function extractRunConfig(draft) {
  const out = {};
  RUN_CONFIG_KEYS.forEach((key) => {
    if (draft && key in draft) out[key] = deepCopy(draft[key]);
  });
  return out;
}

/** Data-preparation part of a draft (B: what the session owns). */
export function extractDataPrep(draft) {
  const out = {};
  DATA_PREP_KEYS.forEach((key) => {
    if (draft && key in draft) out[key] = deepCopy(draft[key]);
  });
  return out;
}

function frozenDraft(draft) {
  const copy = deepCopy(draft);
  // Exactly one duration limit is active (R40): drop the inactive key.
  if (copy.durationMode === "epochs") delete copy.parameters.maxSteps;
  else delete copy.parameters.epochs;
  delete copy.downloadConfirmed;
  return copy;
}

function adapterNameFor(run) {
  const d = run.snapshot.draft;
  return `${run.name} · ${METHOD_LABEL[d.method] || d.method} r${
    d.parameters.loraR
  }`;
}

function adapterBytesFor(run) {
  const d = run.snapshot.draft;
  return estimateAdapterBytes(
    run.snapshot.checkpoint.id,
    d.parameters.loraR,
    d.parameters.targetModules,
  );
}

function pseudoSha256(text) {
  // Illustrative manifest hash (64 hex) derived from FNV-1a lanes.
  const lanes = [0, 1, 2, 3].map(
    (i) =>
      hashSeed(`${i}|${text}`).toString(16).padStart(8, "0") +
      hashSeed(`${text}|${i}`).toString(16).padStart(8, "0"),
  );
  return `sha256:${lanes.join("")}`;
}

/**
 * Validation for creating/starting a run.
 * scope: "config" (B config creation), "train" (queueing), "start" (A: all).
 * Blocker codes (i18n fineTuning:validation.start.<code>): session_not_found,
 * no_checkpoint, checkpoint_unknown, method_unsupported, credential_required,
 * download_not_confirmed, no_dataset, format_text_only, format_missing,
 * mapping_incomplete, format_not_confirmed, invalid_parameters,
 * data_unavailable, data_invalid, insufficient_rows.
 * Warning codes (fineTuning:validation.warn.<code>): vram_exceeds,
 * vram_tight, download_required, data_too_long, validated_on_sample, no_eval.
 */
export function validateDraft(
  state,
  draft,
  prepared,
  { scope = "start", hardware } = {},
) {
  const blockers = [];
  const warnings = [];
  const details = {};
  const hw = hardware || SIMULATED_HARDWARE;
  if (!draft) return { blockers: ["session_not_found"], warnings, details };
  const ck = draft.checkpointId
    ? checkpointById(state, draft.checkpointId)
    : null;

  if (!draft.checkpointId) blockers.push("no_checkpoint");
  else if (!ck) blockers.push("checkpoint_unknown");
  else {
    if (!ck.methods.includes(draft.method)) blockers.push("method_unsupported");
    if (
      (scope === "start" || scope === "train") &&
      ck.gated &&
      !state.demo.hfCredential
    ) {
      blockers.push("credential_required");
    }
    if (ck.availability !== "ready") {
      warnings.push("download_required");
      if (scope === "start" && !draft.downloadConfirmed)
        blockers.push("download_not_confirmed");
    }
  }

  if (!draft.dataset) blockers.push("no_dataset");
  else if (!draft.format) {
    blockers.push(
      draft.formatDetection && draft.formatDetection.reason === "text_only"
        ? "format_text_only"
        : "format_missing",
    );
  } else {
    if (missingMappingFields(draft.format, draft.mapping).length > 0)
      blockers.push("mapping_incomplete");
    const confidence = draft.formatDetection
      ? draft.formatDetection.confidence
      : "none";
    const detectedSame =
      draft.formatDetection && draft.formatDetection.format === draft.format;
    if (!draft.formatConfirmed && !(confidence === "high" && detectedSame)) {
      blockers.push("format_not_confirmed");
    }
  }

  const paramErrors = validateParameters(draft.parameters, draft.durationMode);
  if (Object.keys(paramErrors).length > 0) {
    blockers.push("invalid_parameters");
    details.parameters = paramErrors;
  }

  if (prepared && draft.dataset && draft.format) {
    if (prepared.checkedRows === 0) blockers.push("data_unavailable");
    else if (prepared.validation.blocking) {
      blockers.push("data_invalid");
      details.issues = prepared.validation.issues;
    } else if (!prepared.splitOk) blockers.push("insufficient_rows");
    if (prepared.validation.issues.some((i) => i.code === "too_long"))
      warnings.push("data_too_long");
    if (prepared.sampled) warnings.push("validated_on_sample");
    if (!prepared.useEval) warnings.push("no_eval");
  }

  if (ck) {
    const estimated = estimateVram({
      parametersB: ck.parametersB,
      method: draft.method,
      batchSize: draft.parameters.batchSize,
      maxLength: draft.parameters.maxLength,
      loraR: draft.parameters.loraR,
    });
    details.estimatedVramGb = estimated;
    details.availableVramGb = hw.vramGb;
    if (estimated > hw.vramGb) warnings.push("vram_exceeds");
    else if (estimated > hw.vramGb * 0.9) warnings.push("vram_tight");
  }
  return {
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    details,
  };
}

/**
 * Creates a store.
 * @param {object} [options]
 * @param {string} [options.storageKey] e.g. "dashai:ft-proto:A:v1"
 * @param {Storage|null} [options.storage] defaults to window.localStorage
 *   (null = memory only). Unavailable storage never throws.
 * @param {() => number} [options.now] clock (inject a fake one in tests)
 * @param {boolean} [options.autoTick] internal 500 ms interval, only while
 *   something is time-dependent
 * @param {"A"|"B"} [options.prototype]
 * @param {boolean} [options.seed] build seeds when nothing valid is stored
 */
export function createFineTuningStore(options = {}) {
  const {
    storageKey = "dashai:ft-proto:A:v1",
    now = Date.now,
    autoTick = true,
    prototype = "A",
    seed = true,
    tickMs = TICK_MS,
  } = options;
  const storage =
    options.storage === undefined ? safeDefaultStorage() : options.storage;

  const listeners = new Set();
  const transientRows = new Map();
  let timer = null;
  let lastPersistAt = 0;
  let pendingWrite = false;
  let destroyed = false;
  let hardware = { ...SIMULATED_HARDWARE };

  function readStored() {
    if (!storage) return null;
    try {
      const raw = storage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return isValidState(parsed) ? { ...parsed, storageError: false } : null;
    } catch (e) {
      return null;
    }
  }

  let state =
    readStored() ||
    (seed ? buildSeedState(now(), prototype) : createEmptyState());

  function writeStorage() {
    pendingWrite = false;
    if (!storage) return;
    try {
      const { storageError, ...persisted } = state;
      storage.setItem(
        storageKey,
        JSON.stringify({ ...persisted, storageError: false }),
      );
      lastPersistAt = now();
      if (storageError) state = { ...state, storageError: false };
    } catch (e) {
      if (!state.storageError) state = { ...state, storageError: true };
    }
  }

  function emit() {
    listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        // A failing listener must not break the store.
      }
    });
  }

  function scheduleTicking() {
    if (!autoTick || destroyed) return;
    const needs = isTimeDependent(state);
    if (needs && !timer) {
      timer = setInterval(tick, tickMs);
    } else if (!needs && timer) {
      clearInterval(timer);
      timer = null;
      if (pendingWrite) {
        writeStorage();
        emit();
      }
    }
  }

  // mode: "now" (structural change) | "throttled" (tick progress)
  function commit(next, mode = "now") {
    if (next === state) return;
    state = next;
    if (mode === "now" || now() - lastPersistAt >= TICK_PERSIST_MS)
      writeStorage();
    else pendingWrite = true;
    emit();
    scheduleTicking();
  }

  // ---------------------------------------------------------------- time --

  function startQueued(s, run, startAt) {
    const ck = checkpointById(s, run.snapshot.checkpoint.id);
    const needsDownload = !ck || ck.availability !== "ready";
    let next = s;
    if (ck && ck.download) {
      // A run takes over a standalone download of the same checkpoint.
      next = {
        ...next,
        checkpoints: replaceById(next.checkpoints, ck.id, (c) => ({
          ...c,
          download: null,
        })),
      };
    }
    const timeline = planRun({
      run,
      startAt,
      speed: s.demo.speed,
      scenario: run.scenario,
      needsDownload,
      diskBytes: ck ? ck.diskBytes : run.snapshot.checkpoint.diskBytes,
      adapterName: adapterNameFor(run),
      adapterBytes: adapterBytesFor(run),
    });
    return {
      ...next,
      runs: replaceById(next.runs, run.id, (r) => ({
        ...r,
        timeline,
        eventCursor: 0,
      })),
    };
  }

  function applyCheckpointEffect(s, checkpointId, effect) {
    if (!effect) return s;
    return {
      ...s,
      checkpoints: replaceById(s.checkpoints, checkpointId, (c) => {
        if (
          c.availability === effect.availability &&
          c.downloadedBytes === effect.downloadedBytes
        )
          return c;
        return {
          ...c,
          availability: effect.availability,
          downloadedBytes: effect.downloadedBytes,
          download: null,
          downloadStartedAt:
            effect.availability === "downloading"
              ? c.downloadStartedAt || now()
              : null,
        };
      }),
    };
  }

  function publishAdapter(s, run) {
    const [adapterId, s1] = alloc(s, "adapter");
    const d = run.snapshot.draft;
    const sizeBytes = adapterBytesFor(run);
    const evalPoints = run.points.filter((p) => typeof p.evalLoss === "number");
    const last = run.points[run.points.length - 1];
    const configBytes = 812 + (d.parameters.targetModules || []).length * 14;
    const manifestBytes = 1536;
    const adapter = {
      id: adapterId,
      runId: run.id,
      sessionId: run.sessionId,
      name: adapterNameFor(run),
      checkpointId: run.snapshot.checkpoint.id,
      checkpointName: run.snapshot.checkpoint.name,
      revision: run.snapshot.checkpoint.revision,
      datasetId: run.snapshot.dataset.id,
      datasetName: run.snapshot.dataset.name,
      fingerprint: run.snapshot.dataset.fingerprint,
      method: d.method,
      loraR: d.parameters.loraR,
      createdAt: run.endedAt,
      availability: "ready",
      sizeBytes: sizeBytes + configBytes + manifestBytes,
      files: [
        { name: "adapter_model.safetensors", bytes: sizeBytes },
        { name: "adapter_config.json", bytes: configBytes },
        { name: "dashai_manifest.json", bytes: manifestBytes },
      ],
      manifestHash: pseudoSha256(
        `${run.id}|${run.snapshot.dataset.fingerprint}|${run.endedAt}`,
      ),
      metrics: {
        finalLoss: last ? last.loss : null,
        finalEvalLoss: evalPoints.length
          ? evalPoints[evalPoints.length - 1].evalLoss
          : null,
        durationSec: run.startedAt
          ? Math.round((run.endedAt - run.startedAt) / 1000)
          : null,
        peakVramGb: run.resources.peakVramGb,
        peakRamGb: run.resources.peakRamGb,
        steps: run.step,
      },
    };
    return {
      ...s1,
      adapters: [...s1.adapters, adapter],
      runs: replaceById(s1.runs, run.id, (r) => ({ ...r, adapterId })),
    };
  }

  function finalizeTerminal(s, run) {
    let next = {
      ...s,
      gpuFreeAt: Math.max(s.gpuFreeAt || 0, run.endedAt || 0),
      runs: replaceById(s.runs, run.id, (r) => ({
        ...r,
        timeline: r.timeline ? { ...r.timeline, events: [] } : r.timeline,
        eventCursor: 0,
      })),
    };
    if (run.status === 3) next = publishAdapter(next, run);
    return next;
  }

  function advanceRuns(s, t) {
    let next = s;
    let structural = false;
    for (let guard = 0; guard < 100; guard += 1) {
      const current = next.runs.find(
        (r) => r.timeline && isActiveStatus(r.status),
      );
      if (current) {
        const { run: derived, effects } = deriveRun(current, t);
        if (derived !== current) {
          next = {
            ...next,
            runs: replaceById(next.runs, current.id, () => derived),
          };
        }
        if (effects.checkpoint) {
          const before = checkpointById(next, current.snapshot.checkpoint.id);
          next = applyCheckpointEffect(
            next,
            current.snapshot.checkpoint.id,
            effects.checkpoint,
          );
          const after = checkpointById(next, current.snapshot.checkpoint.id);
          if (before && after && before.availability !== after.availability)
            structural = true;
        }
        if (effects.terminal) {
          next = finalizeTerminal(next, derived);
          structural = true;
          continue;
        }
        break;
      }
      const queue = queuedRuns(next);
      if (queue.length === 0) break;
      const head = queue[0];
      if (next.demo.gpuBusy) {
        if (!head.externalGpuWaitLogged) {
          next = {
            ...next,
            runs: replaceById(next.runs, head.id, (r) => ({
              ...r,
              externalGpuWaitLogged: true,
              events: [
                ...r.events,
                { t, key: "gpuWaiting", params: {}, level: "warn" },
              ],
            })),
          };
          structural = true;
        }
        break;
      }
      const startAt = Math.min(
        t,
        Math.max(head.queuedAt || 0, next.gpuFreeAt || 0),
      );
      next = startQueued(next, head, startAt);
      structural = true;
    }
    return { state: next, structural };
  }

  function advanceAdapterMissing(s, t) {
    let next = s;
    s.runs.forEach((run) => {
      const at = run.timeline && run.timeline.adapterMissingAt;
      if (run.status !== 3 || !at || run.adapterMissingApplied || t < at)
        return;
      const adapter = adapterById(next, run.adapterId);
      next = {
        ...next,
        adapters: adapter
          ? replaceById(next.adapters, adapter.id, (a) => ({
              ...a,
              availability: "missing",
            }))
          : next.adapters,
        runs: replaceById(next.runs, run.id, (r) => ({
          ...r,
          adapterMissingApplied: true,
          events: [
            ...r.events,
            {
              t: at,
              key: "adapterMissing",
              params: { adapterName: adapter ? adapter.name : "" },
              level: "warn",
            },
          ],
        })),
      };
    });
    return next;
  }

  function advanceDownloads(s, t) {
    let next = s;
    s.checkpoints.forEach((ck) => {
      if (ck.availability !== "downloading" || !ck.download) return;
      const { startedAt, span } = ck.download;
      const f = Math.min(1, Math.max(0, (t - startedAt) / Math.max(1, span)));
      next = {
        ...next,
        checkpoints: replaceById(next.checkpoints, ck.id, (c) =>
          f >= 1
            ? {
                ...c,
                availability: "ready",
                downloadedBytes: c.diskBytes,
                download: null,
                downloadStartedAt: null,
              }
            : { ...c, downloadedBytes: Math.round(c.diskBytes * f) },
        ),
      };
    });
    return next;
  }

  function gpuBlockedReason(s) {
    if (s.demo.gpuBusy) return "external";
    if (gpuBusyByTraining(s)) return "training";
    return null;
  }

  function generate(s, modelRef, input, params, seedKey) {
    let adapter = null;
    let checkpoint = null;
    if (modelRef.kind === "adapter") {
      adapter = adapterById(s, modelRef.id);
      if (!adapter || adapter.availability !== "ready") {
        return {
          error: "adapter_missing",
          errorParams: {
            availability: adapter ? adapter.availability : "deleted",
          },
        };
      }
      checkpoint = checkpointById(s, adapter.checkpointId);
    } else {
      checkpoint = checkpointById(s, modelRef.id);
    }
    if (!checkpoint || checkpoint.availability !== "ready") {
      return {
        error: "base_missing",
        errorParams: {
          availability: checkpoint ? checkpoint.availability : "unknown",
        },
      };
    }
    const cause = gpuBlockedReason(s);
    if (cause) return { error: "gpu_busy", errorParams: { cause } };
    const text = simulateResponse({
      modelRef,
      adapter,
      checkpoint,
      input,
      params,
      seed: seedKey,
    });
    return { text, latencyMs: simulateLatencyMs(text, modelRef, seedKey) };
  }

  function advanceChats(s, t) {
    let next = s;
    s.chats.forEach((chat) => {
      if (
        !chat.messages.some((m) => m.status === "pending" && m.resolveAt <= t)
      )
        return;
      const messages = chat.messages.map((m) => {
        if (m.status !== "pending" || m.resolveAt > t) return m;
        const lowTemp = Number(m.snapshot.params.temperature) <= 0.3;
        const result = generate(
          next,
          m.snapshot.modelRef,
          m.input,
          m.snapshot.params,
          lowTemp ? "" : m.id,
        );
        if (result.error) {
          return {
            ...m,
            status: "error",
            errorCode: result.error,
            errorParams: result.errorParams,
            resolvedAt: t,
          };
        }
        return {
          ...m,
          status: "done",
          text: result.text,
          latencyMs: result.latencyMs,
          resolvedAt: t,
        };
      });
      next = {
        ...next,
        chats: replaceById(next.chats, chat.id, (c) => ({
          ...c,
          messages,
          updatedAt: t,
        })),
      };
    });
    return next;
  }

  function advanceComparisons(s, t) {
    let next = s;
    s.comparisons.forEach((cmp) => {
      const due = cmp.items.some(
        (it) =>
          (it.base === null && !it.baseError && it.resolveAt.base <= t) ||
          (it.adapted === null &&
            !it.adaptedError &&
            it.resolveAt.adapted <= t),
      );
      if (!due) return;
      const adapter = adapterById(next, cmp.adapterId);
      const items = cmp.items.map((it) => {
        let item = it;
        const sides = [
          ["base", { kind: "base", id: cmp.baseCheckpointId }],
          ["adapted", { kind: "adapter", id: cmp.adapterId }],
        ];
        sides.forEach(([side, ref]) => {
          if (
            item[side] !== null ||
            item[`${side}Error`] ||
            item.resolveAt[side] > t
          )
            return;
          if (side === "adapted" && !adapter) {
            item = { ...item, adaptedError: "adapter_missing" };
            return;
          }
          const result = generate(
            next,
            ref,
            it.input,
            cmp.params,
            `${cmp.id}|${it.id}`,
          );
          if (result.error) {
            item = { ...item, [`${side}Error`]: result.error };
            return;
          }
          const check = checkFicha(result.text);
          item = {
            ...item,
            [side]: result.text,
            latency: { ...item.latency, [side]: result.latencyMs },
            auto: {
              ...item.auto,
              [`${side}JsonValid`]: check.jsonValid,
              [`${side}CategoryOk`]: check.category === it.reference.categoria,
            },
          };
        });
        return item;
      });
      next = {
        ...next,
        comparisons: replaceById(next.comparisons, cmp.id, (c) => ({
          ...c,
          items,
        })),
      };
    });
    return next;
  }

  function advance(s, t) {
    const runs = advanceRuns(s, t);
    let next = runs.state;
    let structural = runs.structural;
    const afterMissing = advanceAdapterMissing(next, t);
    if (afterMissing !== next) structural = true;
    next = afterMissing;
    const before = next;
    next = advanceDownloads(next, t);
    if (
      next.checkpoints.some(
        (c, i) => c.availability !== before.checkpoints[i].availability,
      )
    )
      structural = true;
    const beforeChats = next;
    next = advanceChats(next, t);
    if (next !== beforeChats) structural = true;
    const beforeCmp = next;
    next = advanceComparisons(next, t);
    if (next !== beforeCmp) structural = true;
    return { state: next, structural };
  }

  function tick() {
    if (destroyed) return;
    const { state: next, structural } = advance(state, now());
    if (next !== state) commit(next, structural ? "now" : "throttled");
    else scheduleTicking();
  }

  // ------------------------------------------------------------ helpers --

  function requireSession(sessionId) {
    const session = sessionById(state, sessionId);
    if (!session) throw codedError("session_not_found");
    return session;
  }

  function updateSession(sessionId, fn, mode = "now") {
    const next = replaceById(state.sessions, sessionId, fn);
    if (next !== state.sessions) commit({ ...state, sessions: next }, mode);
  }

  function resolveRows(session, preparedData) {
    if (preparedData && Array.isArray(preparedData.rows)) {
      const totalRows =
        Number(preparedData.totalRows) || preparedData.rows.length;
      return {
        rows: preparedData.rows,
        totalRows,
        sampled:
          preparedData.sampled !== undefined
            ? Boolean(preparedData.sampled)
            : preparedData.rows.length < totalRows,
      };
    }
    const ds = session.draft.dataset;
    if (!ds) return { rows: [], totalRows: 0, sampled: false };
    if (ds.source === "sample") {
      const sample = getSampleDataset(ds.id);
      if (sample)
        return {
          rows: sample.rows,
          totalRows: sample.rows.length,
          sampled: false,
        };
    }
    const cached = transientRows.get(session.id);
    if (cached && cached.datasetId === ds.id) {
      return {
        rows: cached.rows,
        totalRows: ds.totalRows || cached.rows.length,
        sampled: true,
      };
    }
    if (Array.isArray(session.datasetRows) && session.datasetRows.length > 0) {
      return {
        rows: session.datasetRows,
        totalRows: ds.totalRows || session.datasetRows.length,
        sampled: true,
      };
    }
    return { rows: [], totalRows: ds.totalRows || 0, sampled: true };
  }

  function buildSnapshot(draft, prepared, t) {
    const ck = checkpointById(state, draft.checkpointId);
    const totalSteps = computeTotalSteps(draft, prepared.trainCount);
    const p = draft.parameters;
    const { validation, ...preparedRest } = prepared;
    return {
      frozenAt: t,
      draft: frozenDraft(draft),
      checkpoint: {
        id: ck.id,
        name: ck.name,
        family: ck.family,
        repository: ck.repository,
        revision: ck.revision,
        parametersB: ck.parametersB,
        methods: [...ck.methods],
        diskBytes: ck.diskBytes,
        license: ck.license,
        contextLength: ck.contextLength,
      },
      dataset: {
        ...deepCopy(draft.dataset),
        ...deepCopy(preparedRest),
        validationIssues: deepCopy(validation.issues),
      },
      hardware: { ...hardware },
      versions: { ...LIBRARY_VERSIONS },
      totalSteps,
      effectiveBatch: (Number(p.batchSize) || 1) * (Number(p.gradAccum) || 1),
      estimatedVramGb: estimateVram({
        parametersB: ck.parametersB,
        method: draft.method,
        batchSize: p.batchSize,
        maxLength: p.maxLength,
        loraR: p.loraR,
      }),
      quantization: draft.method === "qlora" ? "nf4" : null,
      doubleQuantization: draft.method === "qlora",
      computeDtype: "float16",
      template: "chatml",
      lossPolicy: "assistant_only",
      packing: false,
    };
  }

  function prepareFor(session, draft, preparedData, scope) {
    const rowsInfo = resolveRows(session, preparedData);
    const prepared = prepareDataset(rowsInfo.rows, draft, rowsInfo);
    const result = validateDraft(state, draft, prepared, { scope, hardware });
    return { prepared, ...result };
  }

  function emptyResources() {
    return { vramGb: 0, ramGb: 0, peakVramGb: 0, peakRamGb: 0 };
  }

  // ------------------------------------------------------------- public --

  const store = {
    prototype,
    storageKey,

    getSnapshot() {
      return state;
    },
    getState() {
      return state;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    now() {
      return now();
    },
    tick,

    /** Writes any throttled progress to storage right away. */
    flush() {
      if (pendingWrite) {
        writeStorage();
        emit();
      }
    },

    destroy() {
      destroyed = true;
      if (timer) clearInterval(timer);
      timer = null;
      listeners.clear();
    },

    isTicking() {
      return timer !== null;
    },

    // Hardware used for frozen snapshots and preflight (not part of state).
    setHardwareProfile(profile) {
      if (!profile) return;
      hardware = {
        gpuName: profile.gpuName,
        vramGb: profile.vramGb,
        ramGb: profile.ramGb,
        accelerator: profile.accelerator,
        source: profile.source,
      };
    },
    getHardwareProfile() {
      return hardware;
    },

    // ---------------------------------------------------------- sessions --
    createSession(name, draftPatch) {
      const t = now();
      const [id, s1] = alloc(state, "session");
      const finalName = (name && String(name).trim()) || nextSessionName(state);
      const session = {
        id,
        name: finalName,
        createdAt: t,
        updatedAt: t,
        draft: createDefaultDraft(draftPatch || {}),
        lastStep: "model",
        datasetRows: null,
      };
      commit({ ...s1, sessions: [...s1.sessions, session] });
      return id;
    },

    renameSession(sessionId, name) {
      const clean = String(name || "").trim();
      if (!clean) return "empty_name";
      updateSession(sessionId, (s) =>
        s.name === clean ? s : { ...s, name: clean, updatedAt: now() },
      );
      return null;
    },

    /** Returns null on success or an error code ("session_has_active_run"). */
    deleteSession(sessionId) {
      const session = sessionById(state, sessionId);
      if (!session) return "session_not_found";
      const runs = state.runs.filter((r) => r.sessionId === sessionId);
      if (runs.some((r) => isActiveStatus(r.status)))
        return "session_has_active_run";
      const adapterIds = new Set(
        state.adapters
          .filter((a) => a.sessionId === sessionId)
          .map((a) => a.id),
      );
      transientRows.delete(sessionId);
      commit({
        ...state,
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        runs: state.runs.filter((r) => r.sessionId !== sessionId),
        adapters: state.adapters.filter((a) => !adapterIds.has(a.id)),
        comparisons: state.comparisons.filter(
          (c) => !adapterIds.has(c.adapterId),
        ),
      });
      return null;
    },

    duplicateSession(sessionId, name) {
      const session = requireSession(sessionId);
      const t = now();
      const [id, s1] = alloc(state, "session");
      const copyName =
        (name && String(name).trim()) ||
        uniqueName(
          `${session.name} (copia)`,
          state.sessions.map((s) => s.name),
        );
      const copy = {
        ...deepCopy(session),
        id,
        name: copyName,
        createdAt: t,
        updatedAt: t,
        draft: {
          ...deepCopy(session.draft),
          downloadConfirmed: false,
          runName: "",
        },
      };
      const cached = transientRows.get(sessionId);
      if (cached) transientRows.set(id, cached);
      commit({ ...s1, sessions: [...s1.sessions, copy] });
      return id;
    },

    // ------------------------------------------------------------- draft --
    updateDraft(sessionId, patch) {
      if (!patch) return;
      updateSession(sessionId, (session) => {
        const draft = session.draft;
        const next = { ...draft, ...patch };
        ["parameters", "splits", "mapping"].forEach((key) => {
          if (
            patch[key] &&
            typeof patch[key] === "object" &&
            !Array.isArray(patch[key])
          ) {
            next[key] = { ...draft[key], ...patch[key] };
          }
        });
        if (
          "format" in patch &&
          patch.format !== draft.format &&
          !("mapping" in patch)
        ) {
          const columns = (draft.dataset && draft.dataset.columns) || [];
          next.mapping = patch.format
            ? suggestMapping(patch.format, columns)
            : {};
        }
        const formatChanged =
          ("format" in patch && patch.format !== draft.format) ||
          ("mapping" in patch &&
            JSON.stringify(next.mapping) !== JSON.stringify(draft.mapping));
        if (formatChanged && !("formatConfirmed" in patch))
          next.formatConfirmed = false;
        if (
          ("parameters" in patch || "durationMode" in patch) &&
          !("preset" in patch)
        ) {
          next.preset = "custom";
        }
        if (
          "checkpointId" in patch &&
          patch.checkpointId !== draft.checkpointId &&
          !("downloadConfirmed" in patch)
        ) {
          next.downloadConfirmed = false;
        }
        if (Array.isArray(next.parameters.targetModules)) {
          next.parameters = {
            ...next.parameters,
            targetModules: [...next.parameters.targetModules],
          };
        }
        return { ...session, draft: next, updatedAt: now() };
      });
    },

    applyPreset(sessionId, presetKey) {
      updateSession(sessionId, (session) => {
        const preset = PRESETS[presetKey];
        if (!preset) {
          return {
            ...session,
            draft: { ...session.draft, preset: "custom" },
            updatedAt: now(),
          };
        }
        return {
          ...session,
          draft: {
            ...session.draft,
            preset: presetKey,
            durationMode: preset.durationMode,
            parameters: { ...session.draft.parameters, ...preset.parameters },
          },
          updatedAt: now(),
        };
      });
    },

    setLastStep(sessionId, step) {
      updateSession(sessionId, (s) =>
        s.lastStep === step ? s : { ...s, lastStep: step },
      );
    },

    /**
     * Sets the session dataset and runs format detection (suggested mapping,
     * formatConfirmed=false). `rows` are the rows available client-side;
     * pass ref=null to clear.
     */
    selectDataset(sessionId, ref, columns, rows) {
      const list = Array.isArray(rows) ? rows : [];
      if (!ref) {
        transientRows.delete(sessionId);
        updateSession(sessionId, (session) => ({
          ...session,
          datasetRows: null,
          draft: {
            ...session.draft,
            dataset: null,
            format: null,
            formatConfirmed: false,
            formatDetection: null,
            mapping: {},
            maxSamples: null,
          },
          updatedAt: now(),
        }));
        return null;
      }
      const cols =
        (Array.isArray(columns) && columns.length ? columns : null) ||
        (Array.isArray(ref.columns) && ref.columns.length
          ? ref.columns
          : null) ||
        Object.keys(list[0] || {});
      const detection = detectFormat(cols, list);
      const dataset = {
        source: ref.source,
        id: ref.id,
        name: ref.name,
        totalRows: Number(ref.totalRows) || list.length,
        columns: [...cols],
      };
      if (ref.i18nKey) dataset.i18nKey = ref.i18nKey;
      if (ref.source !== "sample")
        transientRows.set(sessionId, { datasetId: ref.id, rows: list });
      updateSession(sessionId, (session) => ({
        ...session,
        datasetRows:
          ref.source === "sample" ? null : deepCopy(list.slice(0, 50)),
        draft: {
          ...session.draft,
          dataset,
          format: detection.format,
          formatConfirmed: false,
          formatDetection: {
            format: detection.format,
            confidence: detection.confidence,
            reason: detection.reason,
          },
          mapping: detection.format
            ? suggestMapping(detection.format, cols)
            : {},
          maxSamples: null,
        },
        updatedAt: now(),
      }));
      return detection;
    },

    /**
     * Preflight for the review step / run preview panel.
     * @returns {{blockers: string[], warnings: string[], details: object,
     *   prepared: object}}
     */
    preflight(sessionId, { preparedData, configDraft, scope = "start" } = {}) {
      const session = sessionById(state, sessionId);
      if (!session)
        return {
          blockers: ["session_not_found"],
          warnings: [],
          details: {},
          prepared: null,
        };
      const draft = configDraft
        ? mergeConfig(session.draft, configDraft)
        : session.draft;
      return prepareFor(session, draft, preparedData, scope);
    },

    // ------------------------------------------------------- checkpoints --
    /** Returns null or an error code (checkpoint_unknown, credential_required). */
    downloadCheckpoint(checkpointId) {
      const ck = checkpointById(state, checkpointId);
      if (!ck) return "checkpoint_unknown";
      if (ck.gated && !state.demo.hfCredential) return "credential_required";
      if (ck.availability === "ready" || ck.availability === "downloading")
        return null;
      const t = now();
      const span = STANDALONE_DOWNLOAD_MS / Math.max(1, state.demo.speed);
      commit({
        ...state,
        checkpoints: replaceById(state.checkpoints, checkpointId, (c) => ({
          ...c,
          availability: "downloading",
          downloadedBytes: 0,
          downloadStartedAt: t,
          download: { startedAt: t, span },
        })),
      });
      return null;
    },

    /** Cancels a standalone download (a run's download is cancelled with the run). */
    cancelDownload(checkpointId) {
      const ck = checkpointById(state, checkpointId);
      if (!ck) return "checkpoint_unknown";
      if (ck.availability !== "downloading") return null;
      if (!ck.download) return "download_owned_by_run";
      commit({
        ...state,
        checkpoints: replaceById(state.checkpoints, checkpointId, (c) => ({
          ...c,
          availability: "missing",
          downloadedBytes: 0,
          download: null,
          downloadStartedAt: null,
        })),
      });
      return null;
    },

    /** Demo control: force a checkpoint availability. */
    setCheckpointAvailability(checkpointId, availability) {
      if (
        !["missing", "ready", "invalid", "downloading"].includes(availability)
      )
        return;
      if (availability === "downloading") {
        store.downloadCheckpoint(checkpointId);
        return;
      }
      commit({
        ...state,
        checkpoints: replaceById(state.checkpoints, checkpointId, (c) => ({
          ...c,
          availability,
          downloadedBytes:
            availability === "ready"
              ? c.diskBytes
              : availability === "invalid"
                ? Math.round(c.diskBytes * 0.4)
                : 0,
          download: null,
          downloadStartedAt: null,
        })),
      });
    },

    // -------------------------------------------------------------- runs --
    /**
     * Creates a run with status 0 and a frozen snapshot (prototype B config).
     * configDraft = run-config part (checkpointId, method, preset,
     * durationMode, parameters, runName); null uses the whole session draft.
     * Throws codedError(blockers).
     */
    createRunConfig(sessionId, configDraft = null, opts = {}) {
      const session = requireSession(sessionId);
      const draft = configDraft
        ? mergeConfig(session.draft, configDraft)
        : session.draft;
      const scope = opts.scope || "config";
      const { prepared, blockers, details } = prepareFor(
        session,
        draft,
        opts.preparedData,
        scope,
      );
      if (blockers.length > 0) throw codedError(blockers, details);
      const t = now();
      const [id, s1] = alloc(state, "run");
      const number =
        state.runs
          .filter((r) => r.sessionId === sessionId)
          .reduce((max, r) => Math.max(max, r.number || 0), 0) + 1;
      const name =
        (draft.runName && String(draft.runName).trim()) ||
        `${session.name} · ${number}`;
      const snapshot = buildSnapshot(draft, prepared, t);
      const run = {
        id,
        number,
        sessionId,
        name,
        createdAt: t,
        requestId: opts.requestId || null,
        status: 0,
        phase: null,
        terminationReason: null,
        failure: null,
        queuedAt: null,
        startedAt: null,
        endedAt: null,
        progress: 0,
        step: 0,
        totalSteps: snapshot.totalSteps,
        points: [],
        resources: emptyResources(),
        download: null,
        events: [{ t, key: "created", params: { name }, level: "info" }],
        healthWarnings: [],
        snapshot,
        adapterId: null,
        scenario: null,
        timeline: null,
        eventCursor: 0,
        clonedFromRunId: opts.clonedFromRunId || null,
      };
      commit({ ...s1, runs: [...s1.runs, run] });
      return id;
    },

    /** Re-freezes a status-0 run with a new configuration. Throws on error. */
    updateRunConfig(runId, configDraft) {
      const run = runById(state, runId);
      if (!run) throw codedError("run_not_found");
      if (run.status !== 0) throw codedError("not_editable");
      const session = requireSession(run.sessionId);
      const current = mergeConfig(
        session.draft,
        extractRunConfig(restoreDraft(run.snapshot.draft)),
      );
      const draft = mergeConfig(current, configDraft || {});
      const { prepared, blockers, details } = prepareFor(
        session,
        draft,
        undefined,
        "config",
      );
      if (blockers.length > 0) throw codedError(blockers, details);
      const t = now();
      const name =
        (configDraft &&
          configDraft.runName &&
          String(configDraft.runName).trim()) ||
        run.name;
      const snapshot = buildSnapshot(draft, prepared, t);
      commit({
        ...state,
        runs: replaceById(state.runs, runId, (r) => ({
          ...r,
          name,
          snapshot,
          totalSteps: snapshot.totalSteps,
        })),
      });
      return runId;
    },

    /**
     * Queues a run. Status 0 → queued; active → same id (idempotent);
     * finished/error → a new run cloned from its frozen config is queued and
     * its id returned. Throws codedError("credential_required") etc.
     */
    trainRun(runId, opts = {}) {
      if (opts.requestId) {
        const existing = state.runs.find((r) => r.requestId === opts.requestId);
        if (existing) return existing.id;
      }
      const run = runById(state, runId);
      if (!run) throw codedError("run_not_found");
      if (isActiveStatus(run.status)) return run.id;
      let target = run;
      if (run.status === 3 || run.status === 4) {
        const session = requireSession(run.sessionId);
        const draft = restoreDraft(run.snapshot.draft);
        const ck = checkpointById(state, draft.checkpointId);
        if (ck && ck.gated && !state.demo.hfCredential)
          throw codedError("credential_required");
        const t = now();
        const [id, s1] = alloc(state, "run");
        const number =
          state.runs
            .filter((r) => r.sessionId === run.sessionId)
            .reduce((max, r) => Math.max(max, r.number || 0), 0) + 1;
        const name =
          draft.runName && draft.runName.trim()
            ? uniqueName(
                draft.runName.trim(),
                state.runs
                  .filter((r) => r.sessionId === run.sessionId)
                  .map((r) => r.name),
              )
            : `${session.name} · ${number}`;
        const snapshot = {
          ...deepCopy(run.snapshot),
          frozenAt: t,
          hardware: { ...hardware },
        };
        target = {
          ...deepCopy(run),
          id,
          number,
          name,
          createdAt: t,
          requestId: opts.requestId || null,
          status: 0,
          phase: null,
          terminationReason: null,
          failure: null,
          queuedAt: null,
          startedAt: null,
          endedAt: null,
          progress: 0,
          step: 0,
          points: [],
          resources: emptyResources(),
          download: null,
          events: [{ t, key: "created", params: { name }, level: "info" }],
          healthWarnings: [],
          snapshot,
          adapterId: null,
          scenario: null,
          timeline: null,
          eventCursor: 0,
          clonedFromRunId: run.id,
          seeded: false,
          adapterMissingApplied: false,
          externalGpuWaitLogged: false,
        };
        state = { ...s1, runs: [...s1.runs, target] };
      } else {
        const ck = checkpointById(state, run.snapshot.checkpoint.id);
        if (ck && ck.gated && !state.demo.hfCredential)
          throw codedError("credential_required");
      }
      const t = now();
      const ahead =
        activeRun(state) ||
        queuedRuns(state)[queuedRuns(state).length - 1] ||
        null;
      const scenario =
        state.demo.nextFailure && FAILURE_CODES.includes(state.demo.nextFailure)
          ? state.demo.nextFailure
          : null;
      const events = [{ t, key: "queued", params: {}, level: "info" }];
      if (ahead && ahead.id !== target.id) {
        events.push({
          t,
          key: "waitingForRun",
          params: { name: ahead.name },
          level: "info",
        });
      }
      const next = {
        ...state,
        demo: { ...state.demo, nextFailure: null },
        runs: replaceById(state.runs, target.id, (r) => ({
          ...r,
          status: 1,
          queuedAt: t,
          requestId: opts.requestId || r.requestId,
          scenario,
          events: [...r.events, ...events],
        })),
      };
      const advanced = advance(next, t);
      commit(advanced.state);
      return target.id;
    },

    /** Queues every not-started run of a session (single-GPU queue order). */
    trainAll(sessionId) {
      const configs = state.runs
        .filter((r) => r.sessionId === sessionId && r.status === 0)
        .sort((a, b) => a.number - b.number);
      const queued = [];
      const skipped = [];
      configs.forEach((r) => {
        try {
          queued.push(store.trainRun(r.id));
        } catch (e) {
          skipped.push({ runId: r.id, code: e.code || e.message });
        }
      });
      return { queued, skipped };
    },

    /**
     * Prototype A: freezes the whole session draft and queues it. Idempotent
     * per requestId (a double click returns the same run). Throws
     * codedError(blockers) with codes from validateDraft (scope "start").
     */
    startRun(sessionId, { requestId, preparedData } = {}) {
      if (requestId) {
        const existing = state.runs.find((r) => r.requestId === requestId);
        if (existing) return existing.id;
      }
      const runId = store.createRunConfig(sessionId, null, {
        preparedData,
        requestId,
        scope: "start",
      });
      try {
        store.trainRun(runId);
      } catch (e) {
        commit({ ...state, runs: state.runs.filter((r) => r.id !== runId) });
        throw e;
      }
      updateSession(sessionId, (s) =>
        s.draft.runName ? { ...s, draft: { ...s.draft, runName: "" } } : s,
      );
      return runId;
    },

    /** Cancels a queued or active run (ERROR/cancelled). Returns null or a code. */
    cancelRun(runId) {
      if (!runById(state, runId)) return "run_not_found";
      const t = now();
      // Bring the simulation up to date first: a run that already finished
      // stays finished (a late cancel never reverts a published result).
      const upToDate = advance(state, t).state;
      const current = runById(upToDate, runId);
      if (!isActiveStatus(current.status)) {
        commit(upToDate);
        return "run_not_active";
      }
      const wasDownloading =
        current.status === 2 && current.phase === "downloading";
      const holdsGpu = Boolean(current.timeline);
      const cancelled = {
        ...current,
        status: 4,
        terminationReason: "cancelled",
        failure: null,
        phase: current.status === 2 ? current.phase : null,
        endedAt: t,
        resources: {
          ...(current.resources || emptyResources()),
          vramGb: 0,
          ramGb: 0,
        },
        timeline: current.timeline ? { ...current.timeline, events: [] } : null,
        eventCursor: 0,
        events: [
          ...current.events,
          {
            t,
            key: current.status === 2 ? "cancelled" : "cancelledQueued",
            params: {},
            level: "warn",
          },
        ],
      };
      let next = {
        ...upToDate,
        runs: replaceById(upToDate.runs, runId, () => cancelled),
        gpuFreeAt: holdsGpu ? t : upToDate.gpuFreeAt,
      };
      if (wasDownloading) {
        // The partial download is discarded (it never counts as ready).
        next = {
          ...next,
          checkpoints: replaceById(
            next.checkpoints,
            current.snapshot.checkpoint.id,
            (c) => ({
              ...c,
              availability: "missing",
              downloadedBytes: 0,
              download: null,
              downloadStartedAt: null,
            }),
          ),
        };
      }
      commit(advance(next, t).state);
      return null;
    },

    /** Deletes a non-active run and its adapter. Returns null or a code. */
    deleteRun(runId) {
      const run = runById(state, runId);
      if (!run) return "run_not_found";
      if (isActiveStatus(run.status)) return "run_active";
      commit({
        ...state,
        runs: state.runs.filter((r) => r.id !== runId),
        adapters: state.adapters.filter((a) => a.runId !== runId),
        comparisons: state.comparisons.filter(
          (c) => !run.adapterId || c.adapterId !== run.adapterId,
        ),
      });
      return null;
    },

    /** Copies a run's frozen configuration into its session draft. */
    cloneRunToDraft(runId) {
      const run = runById(state, runId);
      if (!run) throw codedError("run_not_found");
      const draft = restoreDraft(run.snapshot.draft);
      draft.downloadConfirmed = false;
      draft.runName = "";
      updateSession(run.sessionId, (session) => ({
        ...session,
        draft,
        lastStep: "review",
        updatedAt: now(),
      }));
      return run.sessionId;
    },

    // ---------------------------------------------------------- adapters --
    setAdapterAvailability(adapterId, availability) {
      if (!["ready", "missing", "invalid"].includes(availability)) return;
      const next = replaceById(state.adapters, adapterId, (a) =>
        a.availability === availability ? a : { ...a, availability },
      );
      if (next !== state.adapters) commit({ ...state, adapters: next });
    },

    renameAdapter(adapterId, name) {
      const clean = String(name || "").trim();
      if (!clean) return "empty_name";
      const next = replaceById(state.adapters, adapterId, (a) =>
        a.name === clean ? a : { ...a, name: clean },
      );
      if (next !== state.adapters) commit({ ...state, adapters: next });
      return null;
    },

    /** Deletes an adapter; chats that reference it then report it missing. */
    deleteAdapter(adapterId) {
      if (!adapterById(state, adapterId)) return "adapter_not_found";
      commit({
        ...state,
        adapters: state.adapters.filter((a) => a.id !== adapterId),
        comparisons: state.comparisons.filter((c) => c.adapterId !== adapterId),
      });
      return null;
    },

    // ------------------------------------------------------------- chats --
    openChat(modelRef, { name } = {}) {
      if (!modelRef || !modelRef.kind || !modelRef.id)
        throw codedError("model_required");
      const reusable = [...state.chats]
        .reverse()
        .find(
          (c) =>
            c.messages.length === 0 &&
            c.modelRef &&
            c.modelRef.kind === modelRef.kind &&
            c.modelRef.id === modelRef.id,
        );
      if (reusable) return reusable.id;
      const t = now();
      const [id, s1] = alloc(state, "chat");
      const chat = {
        id,
        name: name || modelDisplayName(state, modelRef),
        nameAuto: !name,
        modelRef: { kind: modelRef.kind, id: modelRef.id },
        params: { ...DEFAULT_CHAT_PARAMS },
        messages: [],
        createdAt: t,
        updatedAt: t,
      };
      commit({ ...s1, chats: [...s1.chats, chat] });
      return id;
    },

    /** Changes the model for new messages; past/pending messages keep their snapshot. */
    setChatModel(chatId, modelRef) {
      if (!modelRef) return;
      const next = replaceById(state.chats, chatId, (c) => ({
        ...c,
        modelRef: { kind: modelRef.kind, id: modelRef.id },
        name: c.nameAuto ? modelDisplayName(state, modelRef) : c.name,
        updatedAt: now(),
      }));
      if (next !== state.chats) commit({ ...state, chats: next });
    },

    updateChatParams(chatId, patch) {
      if (!patch) return;
      const next = replaceById(state.chats, chatId, (c) => ({
        ...c,
        params: sanitizeChatParams({ ...c.params, ...patch }),
      }));
      if (next !== state.chats) commit({ ...state, chats: next });
    },

    renameChat(chatId, name) {
      const clean = String(name || "").trim();
      if (!clean) return "empty_name";
      const next = replaceById(state.chats, chatId, (c) => ({
        ...c,
        name: clean,
        nameAuto: false,
      }));
      if (next !== state.chats) commit({ ...state, chats: next });
      return null;
    },

    /**
     * Sends a user message. Returns the id of the pending assistant message,
     * which resolves after ~1.2–2.5 s to "done" or to "error" with errorCode
     * adapter_missing | base_missing | gpu_busy (never a silent fallback).
     */
    sendMessage(chatId, text) {
      const chat = state.chats.find((c) => c.id === chatId);
      if (!chat) throw codedError("chat_not_found");
      const clean = String(text || "").trim();
      if (!clean) throw codedError("empty_message");
      const t = now();
      const snapshot = {
        modelRef: { ...chat.modelRef },
        modelName: modelDisplayName(state, chat.modelRef),
        params: { ...chat.params },
      };
      const [userId, s1] = alloc(state, "msg");
      const [assistantId, s2] = alloc(s1, "msg");
      const delay = 1200 + (hashSeed(`${assistantId}|${clean}`) % 1300);
      const messages = [
        ...chat.messages,
        {
          id: userId,
          role: "user",
          text: clean,
          createdAt: t,
          status: "done",
          snapshot,
        },
        {
          id: assistantId,
          role: "assistant",
          text: "",
          input: clean,
          createdAt: t,
          resolveAt: t + delay,
          status: "pending",
          snapshot,
        },
      ];
      commit({
        ...s2,
        chats: replaceById(s2.chats, chatId, (c) => ({
          ...c,
          messages,
          updatedAt: t,
        })),
      });
      return assistantId;
    },

    deleteChat(chatId) {
      commit({ ...state, chats: state.chats.filter((c) => c.id !== chatId) });
    },

    // ------------------------------------------------------- comparisons --
    /**
     * Generates base vs adapted outputs for the 12 held-out cases with the
     * same instruction and parameters; outputs resolve progressively
     * (~300 ms each). Returns the comparison id.
     */
    createComparison(adapterId, { params } = {}) {
      const adapter = adapterById(state, adapterId);
      if (!adapter) throw codedError("adapter_not_found");
      const t = now();
      const [id, s1] = alloc(state, "comparison");
      const seedNum = hashSeed(`${id}|${t}`);
      const finalParams = sanitizeChatParams({
        ...DEFAULT_CHAT_PARAMS,
        temperature: 0.2,
        ...(params || {}),
      });
      const items = HELD_OUT_CASES.map((c, i) => ({
        id: c.id,
        input: c.input,
        reference: { ...c.reference },
        base: null,
        adapted: null,
        baseError: null,
        adaptedError: null,
        auto: {
          baseJsonValid: null,
          adaptedJsonValid: null,
          baseCategoryOk: null,
          adaptedCategoryOk: null,
        },
        scores: { base: null, adapted: null },
        latency: { base: null, adapted: null },
        resolveAt: {
          base: t + COMPARISON_STEP_MS * (2 * i + 1),
          adapted: t + COMPARISON_STEP_MS * (2 * i + 2),
        },
      }));
      // Blind review: per-item side swap and a shuffled row order.
      const order = items.map((_, i) => (noise(seedNum, i) < 0.5 ? 0 : 1));
      const rowOrder = items.map((_, i) => i);
      for (let i = rowOrder.length - 1; i > 0; i -= 1) {
        const j = Math.floor(noise(seedNum, 100 + i) * (i + 1));
        [rowOrder[i], rowOrder[j]] = [rowOrder[j], rowOrder[i]];
      }
      const comparison = {
        id,
        adapterId,
        adapterName: adapter.name,
        baseCheckpointId: adapter.checkpointId,
        baseName: adapter.checkpointName,
        createdAt: t,
        instruction: FICHA_INSTRUCTION,
        params: finalParams,
        items,
        blind: false,
        order,
        rowOrder,
      };
      commit({ ...s1, comparisons: [...s1.comparisons, comparison] });
      return id;
    },

    scoreComparisonItem(comparisonId, itemId, side, score) {
      if (!["base", "adapted"].includes(side)) return;
      const value =
        score === null || score === undefined
          ? null
          : Math.max(0, Math.min(2, Math.round(score)));
      const next = replaceById(state.comparisons, comparisonId, (c) => ({
        ...c,
        items: c.items.map((it) =>
          it.id === itemId
            ? { ...it, scores: { ...it.scores, [side]: value } }
            : it,
        ),
      }));
      if (next !== state.comparisons) commit({ ...state, comparisons: next });
    },

    setComparisonBlind(comparisonId, blind) {
      const next = replaceById(state.comparisons, comparisonId, (c) =>
        c.blind === Boolean(blind) ? c : { ...c, blind: Boolean(blind) },
      );
      if (next !== state.comparisons) commit({ ...state, comparisons: next });
    },

    deleteComparison(comparisonId) {
      commit({
        ...state,
        comparisons: state.comparisons.filter((c) => c.id !== comparisonId),
      });
    },

    // -------------------------------------------------------------- demo --
    /**
     * Demo shortcut: compresses what is left of every started run so it ends
     * in ~2 s, still going through its remaining phases (and its configured
     * failure, if any). Returns the number of runs fast-forwarded.
     */
    fastForwardRuns(targetMs = 2000) {
      const t = now();
      let count = 0;
      const runs = state.runs.map((r) => {
        if (!r.timeline || !isActiveStatus(r.status) || !(r.timeline.endAt > t))
          return r;
        const factor = Math.min(1, targetMs / (r.timeline.endAt - t));
        if (factor >= 1) return r;
        count += 1;
        return { ...r, timeline: rescaleTimeline(r.timeline, t, factor) };
      });
      if (count) commit({ ...state, runs });
      return count;
    },

    setDemo(patch) {
      if (!patch) return;
      const t = now();
      let next = { ...state, demo: { ...state.demo } };
      if (
        "speed" in patch &&
        SPEEDS.includes(patch.speed) &&
        patch.speed !== state.demo.speed
      ) {
        const factor = state.demo.speed / patch.speed;
        next.demo.speed = patch.speed;
        next.runs = next.runs.map((r) =>
          r.timeline && isActiveStatus(r.status)
            ? {
                ...r,
                timeline: rescaleTimeline(r.timeline, t, factor, patch.speed),
              }
            : r,
        );
        next.checkpoints = next.checkpoints.map((c) => {
          if (!c.download) return c;
          const f = Math.min(
            1,
            (t - c.download.startedAt) / Math.max(1, c.download.span),
          );
          const span = c.download.span * factor;
          return {
            ...c,
            download: { startedAt: Math.round(t - f * span), span },
          };
        });
      }
      if ("nextFailure" in patch) {
        next.demo.nextFailure = FAILURE_CODES.includes(patch.nextFailure)
          ? patch.nextFailure
          : null;
      }
      if ("gpuBusy" in patch) {
        const busy = Boolean(patch.gpuBusy);
        if (state.demo.gpuBusy && !busy)
          next.gpuFreeAt = Math.max(next.gpuFreeAt || 0, t);
        next.demo.gpuBusy = busy;
        if (busy) {
          next.runs = next.runs.map((r) =>
            r.externalGpuWaitLogged
              ? { ...r, externalGpuWaitLogged: false }
              : r,
          );
        }
      }
      if ("hfCredential" in patch)
        next.demo.hfCredential = Boolean(patch.hfCredential);
      commit(advance(next, t).state);
    },

    /** Restores the seed data (demo reset). */
    resetDemo() {
      transientRows.clear();
      const fresh = seed
        ? buildSeedState(now(), prototype)
        : createEmptyState();
      commit({ ...fresh, storageError: state.storageError });
    },
  };

  // Catch up after a reload (progress is derived from wall-clock time).
  if (isTimeDependent(state)) {
    const { state: caughtUp } = advance(state, now());
    state = caughtUp;
  }
  scheduleTicking();
  return store;
}

function sanitizeChatParams(params) {
  const num = (v, lo, hi, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
  };
  return {
    temperature: num(params.temperature, 0, 2, DEFAULT_CHAT_PARAMS.temperature),
    maxNewTokens: Math.round(
      num(params.maxNewTokens, 1, 2048, DEFAULT_CHAT_PARAMS.maxNewTokens),
    ),
    topP: num(params.topP, 0, 1, DEFAULT_CHAT_PARAMS.topP),
  };
}

/** Display name of a model reference (adapter or base checkpoint). */
export function modelDisplayName(state, modelRef) {
  if (!modelRef) return "";
  if (modelRef.kind === "adapter") {
    const adapter = adapterById(state, modelRef.id);
    return adapter ? adapter.name : modelRef.id;
  }
  const ck = checkpointById(state, modelRef.id);
  return ck ? ck.name : modelRef.id;
}

/**
 * Seed data (both prototypes): session "Asistente de soporte" with a
 * complete draft (Qwen2.5 0.5B, QLoRA, fichas-soporte, preset balanced),
 * runs #1 (QLoRA r8, 60 steps) and #2 (QLoRA r16, 120 steps) finished with
 * adapters, run #3 failed with OOM (LoRA on Qwen2.5 1.5B). Prototype B also
 * gets one not-started configuration. Timestamps are relative to `nowMs`.
 */
export function buildSeedState(nowMs, prototype = "A") {
  const clock = { t: nowMs - 6 * DAY };
  const seedStore = createFineTuningStore({
    storage: null,
    now: () => clock.t,
    autoTick: false,
    seed: false,
    prototype,
  });
  const ds = getSampleDataset("fichas-soporte");
  const sid = seedStore.createSession("Asistente de soporte");
  seedStore.selectDataset(sid, sampleDatasetRef(ds), [...ds.columns], ds.rows);
  seedStore.updateDraft(sid, {
    checkpointId: "qwen2.5-0.5b-instruct",
    method: "qlora",
    formatConfirmed: true,
  });
  seedStore.applyPreset(sid, "balanced");

  const run = (at, patch, requestId, duration = 10 * MINUTE) => {
    clock.t = at;
    seedStore.updateDraft(sid, patch);
    const id = seedStore.startRun(sid, { requestId });
    clock.t = at + duration;
    seedStore.tick();
    return id;
  };

  run(
    nowMs - 5 * DAY - 3 * 60 * MINUTE,
    {
      downloadConfirmed: true,
      parameters: { loraR: 8, loraAlpha: 16, maxSteps: 60 },
    },
    "seed-run-1",
  );
  run(
    nowMs - 3 * DAY - 7 * 60 * MINUTE,
    {
      parameters: { loraR: 16, loraAlpha: 32, maxSteps: 120, evalEvery: 20 },
    },
    "seed-run-2",
  );

  clock.t = nowMs - DAY - 4 * 60 * MINUTE;
  seedStore.setCheckpointAvailability("qwen2.5-1.5b-instruct", "ready");
  run(
    nowMs - DAY - 4 * 60 * MINUTE,
    {
      checkpointId: "qwen2.5-1.5b-instruct",
      method: "lora",
      downloadConfirmed: true,
      parameters: {
        maxLength: 1024,
        batchSize: 4,
        gradAccum: 2,
        loraR: 16,
        loraAlpha: 32,
        maxSteps: 120,
      },
    },
    "seed-run-3",
  );
  // The 1.5B weights were removed afterwards to free disk space.
  seedStore.setCheckpointAvailability("qwen2.5-1.5b-instruct", "missing");

  clock.t = nowMs - DAY;
  seedStore.updateDraft(sid, {
    checkpointId: "qwen2.5-0.5b-instruct",
    method: "qlora",
    downloadConfirmed: false,
    runName: "",
  });
  seedStore.applyPreset(sid, "balanced");
  seedStore.setLastStep(sid, "review");

  if (prototype === "B") {
    clock.t = nowMs - 2 * 60 * MINUTE;
    seedStore.createRunConfig(sid, {
      checkpointId: "qwen2.5-1.5b-instruct",
      method: "qlora",
      preset: "qlora_8gb",
      durationMode: "steps",
      parameters: { ...PRESETS.qlora_8gb.parameters },
      runName: "Qwen2.5 1.5B · QLoRA r16",
    });
  }

  const seeded = seedStore.getSnapshot();
  seedStore.destroy();
  return {
    ...seeded,
    runs: seeded.runs.map((r) => ({ ...r, seeded: true, requestId: null })),
    adapters: seeded.adapters.map((a) => ({ ...a, seeded: true })),
    demo: { speed: 1, nextFailure: null, gpuBusy: false, hfCredential: false },
    storageError: false,
  };
}
