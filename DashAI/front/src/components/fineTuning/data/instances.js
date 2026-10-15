// Lazy store singletons, one per prototype (SPEC §1, §5). Creating a store
// reads localStorage (never throws if unavailable) and only starts its timer
// when something is time-dependent. Each store registers a job source so its
// runs appear in DashAI's global job queue widget (SPEC §7).

import { createFineTuningStore } from "./store";
import { registerExternalJobsSource } from "../../../utils/externalJobs";

export const STORAGE_KEYS = Object.freeze({
  A: "dashai:ft-proto:A:v1",
  B: "dashai:ft-proto:B:v1",
});

// Route bases (SPEC §5 for A, SPEC-B "Routes" for B). Kept here only for the
// job widget links; the UI receives its routes through FineTuningProvider.
export const RUN_HREF = Object.freeze({
  A: (run) =>
    `/app/generative/fine-tuning/sessions/${run.sessionId}/runs/${run.id}`,
  B: (run) => `/app/models/fine-tuning/${run.sessionId}/run/${run.id}`,
});

const RECENT_TERMINAL_MS = 12 * 60 * 60 * 1000;
const stores = {};

function jobStatus(run) {
  switch (run.status) {
    case 1:
      return run.timeline && run.startedAt ? "started" : "not_started";
    case 2:
      return "started";
    case 3:
      return "finished";
    case 4:
      if (run.terminationReason === "cancelled") return "cancelled";
      if (run.terminationReason === "interrupted") return "killed";
      return "error";
    default:
      return "not_started";
  }
}

function progressMessage(run, t) {
  if (run.status === 1) {
    const waitingGpu = run.events.some((e) => e.key === "gpuWaiting");
    return t(
      waitingGpu ? "fineTuning:jobs.waitingGpu" : "fineTuning:jobs.queued",
    );
  }
  if (run.status === 2) {
    const phase = t(`fineTuning:phase.${run.phase || "preparing"}`);
    if (run.phase === "training") {
      return t("fineTuning:jobs.trainingStep", {
        phase,
        step: run.step,
        total: run.totalSteps,
      });
    }
    return phase;
  }
  if (run.status === 3) return t("fineTuning:jobs.finished");
  if (run.terminationReason === "cancelled")
    return t("fineTuning:jobs.cancelled");
  if (run.failure) return t(`fineTuning:failures.${run.failure.code}.title`);
  return t(`fineTuning:reason.${run.terminationReason || "failed"}`);
}

function lastUpdate(run) {
  const lastEvent = run.events[run.events.length - 1];
  const ts = Math.max(
    run.endedAt || 0,
    lastEvent ? lastEvent.t : 0,
    run.startedAt || 0,
    run.queuedAt || 0,
    run.createdAt || 0,
  );
  return new Date(ts).toISOString();
}

/** Job DTOs for the runs of a store (seeded runs and B configs excluded). */
export function runsToJobs(store, prototype, t) {
  const state = store.getSnapshot();
  const now = store.now();
  return state.runs
    .filter((run) => {
      if (run.seeded || run.status === 0) return false;
      if (run.status === 3 || run.status === 4) {
        return now - (run.endedAt || 0) < RECENT_TERMINAL_MS;
      }
      return true;
    })
    .map((run) => {
      const status = jobStatus(run);
      const active = run.status === 1 || run.status === 2;
      return {
        id: `ft-${prototype}-${run.id}`,
        external: true,
        task_type: "FineTuningJob",
        job_name: run.name,
        source_label: t("fineTuning:jobs.sourceLabel", { prototype }),
        status,
        progress: Math.round((run.progress || 0) * 100),
        progress_message: progressMessage(run, t),
        last_update: lastUpdate(run),
        href: RUN_HREF[prototype](run),
        onCancel: active ? () => store.cancelRun(run.id) : undefined,
      };
    });
}

/**
 * Returns the store of prototype "A" or "B" (created on first use).
 * @param {"A"|"B"} prototype
 */
export function getPrototypeStore(prototype = "A") {
  const key = prototype === "B" ? "B" : "A";
  if (!stores[key]) {
    const store = createFineTuningStore({
      storageKey: STORAGE_KEYS[key],
      prototype: key,
    });
    stores[key] = store;
    registerExternalJobsSource(`fine-tuning-${key}`, {
      label: `fine-tuning-${key}`,
      subscribe: store.subscribe,
      getJobs: ({ t }) => runsToJobs(store, key, t),
    });
  }
  return stores[key];
}

/**
 * Optional app-start hook: instantiates the stores that already have
 * persisted data, so runs that were active before a reload keep progressing
 * and show up in the job widget even before the module is opened. Does
 * nothing for a prototype that was never used.
 */
export function ensureFineTuningJobSources() {
  let storage = null;
  try {
    storage = typeof window !== "undefined" ? window.localStorage : null;
  } catch (e) {
    storage = null;
  }
  if (!storage) return;
  ["A", "B"].forEach((key) => {
    try {
      if (storage.getItem(STORAGE_KEYS[key])) getPrototypeStore(key);
    } catch (e) {
      // ignore: storage unavailable
    }
  });
}

/** Test helper: drops the singletons (does not touch storage). */
export function resetPrototypeStoresForTests() {
  Object.keys(stores).forEach((key) => {
    stores[key].destroy();
    delete stores[key];
  });
}
