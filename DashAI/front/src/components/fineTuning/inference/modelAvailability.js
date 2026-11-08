// Pure helpers shared by the inference and adapters UI: whether a model
// reference (base checkpoint or adapter) can generate right now, and why not.
// Generation never falls back from an adapter to its base (R73), so every
// blocked reference carries an explicit reason.

import {
  adapterById,
  checkpointById,
  gpuBusyByTraining,
} from "../data/selectors";

/**
 * @param {object} state store snapshot
 * @param {{kind: "adapter"|"base", id: string}|null} modelRef
 * @returns {{
 *   usable: boolean,
 *   reason: null|"no_model"|"adapter_deleted"|"adapter_missing"|"adapter_invalid"|
 *           "base_missing"|"base_downloading"|"base_invalid"|"base_unknown",
 *   errorCode: null|"adapter_missing"|"base_missing",
 *   adapter: object|null,
 *   checkpoint: object|null,
 * }}
 */
export function modelRefStatus(state, modelRef) {
  if (!modelRef || !modelRef.id) {
    return {
      usable: false,
      reason: "no_model",
      errorCode: null,
      adapter: null,
      checkpoint: null,
    };
  }
  let adapter = null;
  let checkpointId = modelRef.id;
  if (modelRef.kind === "adapter") {
    adapter = adapterById(state, modelRef.id);
    if (!adapter) {
      return {
        usable: false,
        reason: "adapter_deleted",
        errorCode: "adapter_missing",
        adapter: null,
        checkpoint: null,
      };
    }
    checkpointId = adapter.checkpointId;
  }
  const checkpoint = checkpointById(state, checkpointId);
  if (adapter && adapter.availability !== "ready") {
    return {
      usable: false,
      reason:
        adapter.availability === "invalid"
          ? "adapter_invalid"
          : "adapter_missing",
      errorCode: "adapter_missing",
      adapter,
      checkpoint,
    };
  }
  if (!checkpoint) {
    return {
      usable: false,
      reason: "base_unknown",
      errorCode: "base_missing",
      adapter,
      checkpoint: null,
    };
  }
  if (checkpoint.availability !== "ready") {
    const reason =
      checkpoint.availability === "downloading"
        ? "base_downloading"
        : checkpoint.availability === "invalid"
          ? "base_invalid"
          : "base_missing";
    return {
      usable: false,
      reason,
      errorCode: "base_missing",
      adapter,
      checkpoint,
    };
  }
  return { usable: true, reason: null, errorCode: null, adapter, checkpoint };
}

/** Why generation is blocked by the (single, simulated) GPU, else null. */
export function gpuBlockCause(state) {
  if (!state) return null;
  if (state.demo && state.demo.gpuBusy) return "external";
  if (gpuBusyByTraining(state)) return "training";
  return null;
}

/** Download progress of a checkpoint as an integer percentage (0–100). */
export function downloadPercent(checkpoint) {
  if (!checkpoint || !checkpoint.diskBytes) return 0;
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (100 * (checkpoint.downloadedBytes || 0)) / checkpoint.diskBytes,
      ),
    ),
  );
}

/** Locale-aware date + time ("14 oct 2026, 12:30"). */
export function formatDateTime(ms, language) {
  if (!ms) return "";
  try {
    return new Intl.DateTimeFormat(language || undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ms));
  } catch (e) {
    return new Date(ms).toLocaleString();
  }
}

/** Locale-aware time only (chat timestamps). */
export function formatTime(ms, language) {
  if (!ms) return "";
  try {
    return new Intl.DateTimeFormat(language || undefined, {
      timeStyle: "short",
    }).format(new Date(ms));
  } catch (e) {
    return new Date(ms).toLocaleTimeString();
  }
}

/** Locale-aware number with a fixed number of decimals. */
export function formatNumber(value, language, decimals = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  try {
    return new Intl.NumberFormat(language || undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch (e) {
    return value.toFixed(decimals);
  }
}

/** Duration in seconds → "8 min 18 s" style parts handled by the caller's t. */
export function splitDuration(totalSec) {
  const sec = Math.max(0, Math.round(Number(totalSec) || 0));
  return { minutes: Math.floor(sec / 60), seconds: sec % 60 };
}
