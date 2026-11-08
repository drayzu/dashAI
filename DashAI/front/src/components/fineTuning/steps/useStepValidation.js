// Single source of truth for the configuration steps gating (SPEC §4):
// Modelo · Datos · Parámetros · Revisión. It runs the store preflight (the
// same validateDraft the store uses in startRun) and splits its blockers and
// warnings per step, so StepNav, the footer, ReviewStep and RunPreviewPanel
// always agree on what is missing.

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useFineTuningActions, useFineTuningStore } from "../FineTuningContext";
import { useHardwareProfile } from "../hooks/useHardwareProfile";
import {
  activeRun,
  checkpointById,
  isActiveStatus,
  queuedRuns,
  sessionById,
} from "../data/selectors";

export const STEP_KEYS = Object.freeze([
  "model",
  "data",
  "parameters",
  "review",
]);

/** Blocker codes (validateDraft) owned by each step. */
export const STEP_BLOCKERS = Object.freeze({
  model: [
    "no_checkpoint",
    "checkpoint_unknown",
    "method_unsupported",
    "credential_required",
  ],
  data: [
    "no_dataset",
    "format_text_only",
    "format_missing",
    "mapping_incomplete",
    "format_not_confirmed",
    "data_unavailable",
    "data_invalid",
    "insufficient_rows",
  ],
  parameters: ["invalid_parameters"],
  review: ["download_not_confirmed", "session_not_found"],
});

/** Warning codes (validateDraft) owned by each step. */
export const STEP_WARNINGS = Object.freeze({
  model: ["download_required"],
  data: ["data_too_long", "validated_on_sample", "no_eval"],
  parameters: ["vram_exceeds", "vram_tight"],
  review: [],
});

// Blockers that only mean "the user has not chosen/confirmed yet" (step shown
// as pending, readiness "incomplete") as opposed to real errors ("blocked").
const NOT_CHOSEN = new Set(["no_checkpoint", "no_dataset"]);
const INCOMPLETE = new Set([
  "no_checkpoint",
  "no_dataset",
  "format_missing",
  "mapping_incomplete",
  "format_not_confirmed",
  "download_not_confirmed",
]);

const EMPTY = Object.freeze([]);

function toIssues(blockers, warnings) {
  return [
    ...blockers.map((code) => ({ code, level: "error" })),
    ...warnings.map((code) => ({ code, level: "warning" })),
  ];
}

/** Recomputes the VRAM warnings against the hardware profile shown in the UI. */
function vramWarnings(warnings, estimated, available) {
  const rest = warnings.filter(
    (w) => w !== "vram_exceeds" && w !== "vram_tight",
  );
  if (typeof estimated !== "number" || !(available > 0)) return rest;
  if (estimated > available) return [...rest, "vram_exceeds"];
  if (estimated > available * 0.9) return [...rest, "vram_tight"];
  return rest;
}

/**
 * Pure part of the hook (exported for tests).
 * @param {{blockers: string[], warnings: string[], details: object, prepared: object|null}} preflight
 * @param {object} [options]
 * @param {object} [options.dataState] result of dataPrep/useDataPreparation
 *   (optional; its blockingIssues/validation refine the data step)
 * @param {number} [options.availableVramGb] VRAM of the displayed hardware
 */
export function computeStepValidation(
  preflight,
  { dataState, availableVramGb } = {},
) {
  const pf = preflight || {
    blockers: ["session_not_found"],
    warnings: [],
    details: {},
    prepared: null,
  };
  const details = pf.details || {};
  const blockers = [...(pf.blockers || [])];
  const available =
    availableVramGb > 0 ? availableVramGb : details.availableVramGb;
  let warnings = vramWarnings(
    [...(pf.warnings || [])],
    details.estimatedVramGb,
    available,
  );

  // The data-prep hook may know more than the preflight (e.g. rows it loaded).
  if (dataState) {
    const extra = Array.isArray(dataState.blockingIssues)
      ? dataState.blockingIssues
      : EMPTY;
    if (
      extra.length > 0 &&
      !blockers.includes("data_invalid") &&
      !blockers.includes("no_dataset")
    ) {
      blockers.push("data_invalid");
    }
  }

  const pick = (codes, owned) => codes.filter((c) => owned.includes(c));
  const knownBlockers = Object.values(STEP_BLOCKERS).flat();
  const unknown = blockers.filter((c) => !knownBlockers.includes(c));

  const build = (key) => {
    const b = pick(blockers, STEP_BLOCKERS[key]);
    const w = pick(warnings, STEP_WARNINGS[key]);
    return {
      valid: b.length === 0,
      blockers: b,
      warnings: w,
      issues: toIssues(b, w),
    };
  };

  const model = build("model");
  const data = build("data");
  const parameters = build("parameters");
  const reviewOwn = [...pick(blockers, STEP_BLOCKERS.review), ...unknown];

  const prepared = pf.prepared || null;
  const rowIssues =
    (dataState &&
    dataState.validation &&
    Array.isArray(dataState.validation.issues)
      ? dataState.validation.issues
      : null) ||
    (prepared && prepared.validation ? prepared.validation.issues : EMPTY);

  const stepStatus = (step) => {
    if (step.valid) return "valid";
    return step.blockers.every((c) => NOT_CHOSEN.has(c))
      ? "pending"
      : "invalid";
  };
  model.status = stepStatus(model);
  data.status = stepStatus(data);
  parameters.status = stepStatus(parameters);
  data.rowIssues = rowIssues;
  data.prepared = prepared;
  parameters.fieldErrors = details.parameters || {};

  const allBlockers = [...new Set(blockers)];
  const ready = allBlockers.length === 0;
  const earlierValid = model.valid && data.valid && parameters.valid;
  let readiness = "ready";
  if (!ready)
    readiness = allBlockers.every((c) => INCOMPLETE.has(c))
      ? "incomplete"
      : "blocked";

  const review = {
    valid: ready,
    ready,
    readiness,
    blockers: allBlockers,
    ownBlockers: reviewOwn,
    warnings,
    issues: toIssues(allBlockers, warnings),
    status: ready ? "valid" : earlierValid ? "invalid" : "pending",
  };

  const order = [model, data, parameters];
  const firstNotValid = order.findIndex((s) => !s.valid);
  // Steps up to the first non-valid one are reachable; Review only when the
  // three previous steps are valid.
  const maxReachable =
    firstNotValid === -1 ? STEP_KEYS.length - 1 : firstNotValid;

  return {
    model,
    data,
    parameters,
    review,
    maxReachable,
    firstInvalidIndex: firstNotValid,
    estimatedVramGb:
      typeof details.estimatedVramGb === "number"
        ? details.estimatedVramGb
        : null,
    availableVramGb: available > 0 ? available : null,
    preflight: { ...pf, warnings },
  };
}

function selectContext(sessionId) {
  return (state) => {
    const active = activeRun(state);
    const own =
      state.runs.find((r) => r.sessionId === sessionId && r.status === 2) ||
      state.runs.find(
        (r) => r.sessionId === sessionId && isActiveStatus(r.status),
      ) ||
      null;
    return {
      session: sessionById(state, sessionId),
      checkpoints: state.checkpoints,
      demo: state.demo,
      activeRunId: active ? active.id : null,
      activeRunName: active ? active.name : null,
      queuedCount: queuedRuns(state).length,
      sessionActiveRunId: own ? own.id : null,
      sessionMaxRunNumber: state.runs
        .filter((r) => r.sessionId === sessionId)
        .reduce((max, r) => Math.max(max, r.number || 0), 0),
    };
  };
}

/**
 * Gating of the configuration steps.
 *
 * Accepts both `useStepValidation(session, { dataState, hardware })` and the
 * SPEC form `useStepValidation(session, dataState, hardware)`.
 *
 * @param {object|null} session session object (its id is used to read the
 *   live session from the store)
 * @param {object} [options]
 * @param {object} [options.dataState] result of useDataPreparation (optional)
 * @param {object} [options.hardware] hardware profile override
 *   ({gpuName, vramGb, ramGb, source}); defaults to useHardwareProfile()
 * @param {object} [options.preparedData] rows for the preflight ({rows,
 *   totalRows, sampled}); by default the store resolves them itself
 * @param {object} [options.configDraft] prototype B run-config part
 * @returns {{
 *   model: {valid, status, blockers, warnings, issues},
 *   data: {valid, status, blockers, warnings, issues, rowIssues, prepared},
 *   parameters: {valid, status, blockers, warnings, issues, fieldErrors},
 *   review: {valid, ready, readiness: "ready"|"incomplete"|"blocked", status,
 *            blockers, ownBlockers, warnings, issues},
 *   steps: {key, label, status}[], maxReachable: number, firstInvalidIndex,
 *   estimatedVramGb, availableVramGb, preflight, session, checkpoint, demo,
 *   hardware, gpu: {busy, cause, queueAhead, activeRunName},
 *   sessionActiveRunId, nextRunNumber
 * }}
 */
export function useStepValidation(session, optionsOrDataState, hardwareArg) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const store = useFineTuningActions();
  const hw = useHardwareProfile();

  const isOptions =
    optionsOrDataState &&
    typeof optionsOrDataState === "object" &&
    ("dataState" in optionsOrDataState ||
      "hardware" in optionsOrDataState ||
      "preparedData" in optionsOrDataState ||
      "configDraft" in optionsOrDataState);
  const options = isOptions
    ? optionsOrDataState
    : { dataState: optionsOrDataState, hardware: hardwareArg };
  const { dataState, preparedData, configDraft } = options;
  const hardware = options.hardware || (hw && hw.profile) || null;

  const sessionId = session ? session.id : null;
  const selector = useMemo(() => selectContext(sessionId), [sessionId]);
  const ctx = useFineTuningStore(selector);
  const liveSession = ctx.session || session || null;

  // `ctx` (memoized by shallow equality) changes whenever the live session,
  // checkpoints or demo flags change: exactly what validateDraft reads.
  const preflight = useMemo(
    () =>
      sessionId && ctx
        ? store.preflight(sessionId, { preparedData, configDraft })
        : null,
    [store, sessionId, ctx, preparedData, configDraft],
  );

  const availableVramGb = hardware ? Number(hardware.vramGb) : undefined;
  const computed = useMemo(
    () => computeStepValidation(preflight, { dataState, availableVramGb }),
    [preflight, dataState, availableVramGb],
  );

  const draft = liveSession ? liveSession.draft : null;
  const checkpointId = draft ? draft.checkpointId : null;
  const checkpoint = useMemo(
    () =>
      checkpointId
        ? checkpointById({ checkpoints: ctx.checkpoints }, checkpointId)
        : null,
    [ctx.checkpoints, checkpointId],
  );

  const steps = useMemo(
    () =>
      STEP_KEYS.map((key) => ({
        key,
        label: t(`fineTuning:stepNav.steps.${key}`),
        status: computed[key].status,
      })),
    [computed, t],
  );

  const gpu = useMemo(() => {
    const external = Boolean(ctx.demo && ctx.demo.gpuBusy);
    const queueAhead = (ctx.activeRunId ? 1 : 0) + ctx.queuedCount;
    let cause = null;
    if (external) cause = "external";
    else if (ctx.activeRunId) cause = "training";
    else if (ctx.queuedCount > 0) cause = "queue";
    return {
      busy: Boolean(cause),
      cause,
      queueAhead,
      activeRunName: ctx.activeRunName,
    };
  }, [ctx.demo, ctx.activeRunId, ctx.activeRunName, ctx.queuedCount]);

  return useMemo(
    () => ({
      ...computed,
      steps,
      session: liveSession,
      checkpoint,
      demo: ctx.demo,
      hardware,
      gpu,
      sessionActiveRunId: ctx.sessionActiveRunId,
      nextRunNumber: ctx.sessionMaxRunNumber + 1,
    }),
    [
      computed,
      steps,
      liveSession,
      checkpoint,
      ctx.demo,
      hardware,
      gpu,
      ctx.sessionActiveRunId,
      ctx.sessionMaxRunNumber,
    ],
  );
}

export default useStepValidation;
