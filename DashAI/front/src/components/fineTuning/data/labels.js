// i18n helpers for core enums and events (keys live in the `fineTuning`
// namespace, part file .claude/ft-proto/i18n/core.json). Pass the `t` from
// useTranslation(["fineTuning", "common"]). Never render raw enum values.

export const NS = "fineTuning";

/** i18n key of a run event: fineTuning:events.<event.key>. */
export function eventKey(event) {
  return `${NS}:events.${event && event.key ? event.key : "unknown"}`;
}

/** Translated event line (params are already language-neutral strings/numbers). */
export function formatEvent(event, t) {
  return t(eventKey(event), {
    ...(event && event.params),
    defaultValue: event ? event.key : "",
  });
}

/** Run status label (Registrada · En cola · En ejecución · Finalizada · Error). */
export function statusLabel(status, t) {
  return t(`${NS}:status.${Number.isInteger(status) ? status : 0}`);
}

/** Phase label; also accepts the pseudo-phases "queued" and "published". */
export function phaseLabel(phase, t) {
  return phase ? t(`${NS}:phase.${phase}`) : "";
}

export function reasonLabel(reason, t) {
  return reason ? t(`${NS}:reason.${reason}`) : "";
}

export function checkpointAvailabilityLabel(availability, t) {
  return t(`${NS}:availability.checkpoint.${availability || "missing"}`);
}

export function adapterAvailabilityLabel(availability, t) {
  return t(`${NS}:availability.adapter.${availability || "missing"}`);
}

/** MUI color for availability chips. */
export function availabilityColor(availability) {
  switch (availability) {
    case "ready":
      return "success";
    case "downloading":
      return "info";
    case "invalid":
      return "error";
    case "missing":
      return "warning";
    default:
      return "default";
  }
}

/**
 * Diagnosis for a FailureCode, a validation issue code, a chat error code
 * (adapter_missing, base_missing, gpu_busy) or "cancelled".
 * @returns {{title: string, explanation: string, actions: string[]}}
 */
export function failureInfo(code, t, params = {}) {
  const base = `${NS}:failures.${code || "unknown"}`;
  const actions = t(`${base}.actions`, { ...params, returnObjects: true });
  return {
    title: t(`${base}.title`, params),
    explanation: t(`${base}.explanation`, params),
    actions: Array.isArray(actions) ? actions : [],
  };
}

/** Short label for a validation issue with its count (pluralized). */
export function issueLabel(issue, t) {
  return t(`${NS}:validation.issue.${issue.code}`, {
    count: issue.count,
    column: issue.column || "",
  });
}

/** Message for a start blocker code from validateDraft / startRun errors. */
export function blockerLabel(code, t) {
  return t(`${NS}:validation.start.${code}`, {
    defaultValue: t(`${NS}:validation.start.unknown`),
  });
}

/** Message for a preflight warning code. */
export function warningLabel(code, t, params = {}) {
  return t(`${NS}:validation.warn.${code}`, params);
}

/** Inline helper text for a parameter validation code. */
export function parameterErrorLabel(code, t, params = {}) {
  return t(`${NS}:validation.params.${code}`, params);
}

export function presetLabel(presetKey, t) {
  return t(`${NS}:presets.${presetKey || "custom"}.name`);
}

export function presetDescription(presetKey, t) {
  return t(`${NS}:presets.${presetKey || "custom"}.description`);
}

export function methodLabel(method, t) {
  return t(`${NS}:catalog.methods.${method}.name`);
}

export function formatLabel(format, t) {
  return format
    ? t(`${NS}:datasets.formats.${format}`)
    : t(`${NS}:datasets.formats.none`);
}

/** Display name of a dataset ref (sample datasets are translated). */
export function datasetName(ref, t) {
  if (!ref) return "";
  if (ref.source === "sample" && ref.i18nKey) {
    return t(`${NS}:datasets.samples.${ref.i18nKey}.name`, {
      defaultValue: ref.name,
    });
  }
  return ref.name;
}

export function datasetDescription(ref, t) {
  if (!ref || ref.source !== "sample" || !ref.i18nKey) return "";
  return t(`${NS}:datasets.samples.${ref.i18nKey}.description`, {
    defaultValue: ref.description || "",
  });
}

export function checkpointDescription(checkpoint, t) {
  if (!checkpoint || !checkpoint.i18nKey) return "";
  return t(`${NS}:catalog.models.${checkpoint.i18nKey}.description`);
}

/** Translated chat/comparison error (adapter_missing | base_missing | gpu_busy). */
export function generationErrorLabel(errorCode, t, errorParams = {}) {
  if (errorCode === "gpu_busy" && errorParams.cause === "training") {
    return t(`${NS}:failures.gpu_busy.trainingExplanation`);
  }
  return t(`${NS}:failures.${errorCode}.explanation`);
}
