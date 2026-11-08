// Registry of frontend-only job sources shown in the global JobQueueWidget
// next to the real backend jobs (SPEC §7). A source is any module with its
// own state (e.g. the simulated fine-tuning runs) that can describe its work
// as job DTOs:
//   { id, external: true, task_type, job_name, status, progress (0..100),
//     progress_message (already translated), last_update (ISO), href,
//     onCancel?, source_label? }
// status ∈ not_started | started | finished | error | cancelled | killed.
// Real jobs are never touched by this module.

import { useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

const sources = new Map(); // key -> { getJobs, unsubscribe, label }
const listeners = new Set();
let version = 0;

function notify() {
  version += 1;
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      // ignore listener errors
    }
  });
}

/**
 * Registers (or replaces) a source.
 * @param {string} key unique source key, e.g. "fine-tuning-A"
 * @param {{subscribe?: (fn: Function) => Function,
 *   getJobs: (ctx: {t: Function}) => object[], label?: string}} source
 * @returns {Function} unregister
 */
export function registerExternalJobsSource(key, source) {
  if (!key || !source || typeof source.getJobs !== "function") return () => {};
  const previous = sources.get(key);
  if (previous && previous.unsubscribe) previous.unsubscribe();
  const unsubscribe =
    typeof source.subscribe === "function" ? source.subscribe(notify) : null;
  sources.set(key, {
    getJobs: source.getJobs,
    unsubscribe,
    label: source.label,
  });
  notify();
  return () => unregisterExternalJobsSource(key);
}

export function unregisterExternalJobsSource(key) {
  const entry = sources.get(key);
  if (!entry) return;
  if (entry.unsubscribe) entry.unsubscribe();
  sources.delete(key);
  notify();
}

export function hasExternalJobsSource(key) {
  return sources.has(key);
}

export function subscribeExternalJobs(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getVersion() {
  return version;
}

/** Merged jobs of every source (newest update first). */
export function getExternalJobs(t = (key) => key) {
  const jobs = [];
  sources.forEach((entry) => {
    try {
      const list = entry.getJobs({ t });
      if (Array.isArray(list)) {
        list.forEach((job) => {
          if (job && job.id !== undefined)
            jobs.push({ ...job, external: true });
        });
      }
    } catch (e) {
      // A broken source must not break the job widget.
    }
  });
  return jobs.sort(
    (a, b) => Date.parse(b.last_update || 0) - Date.parse(a.last_update || 0),
  );
}

/**
 * React hook: merged external jobs, re-computed when a source changes or
 * the language changes. The returned array is stable between changes.
 */
export function useExternalJobs() {
  const { t, i18n } = useTranslation(["fineTuning", "common"]);
  const current = useSyncExternalStore(
    subscribeExternalJobs,
    getVersion,
    getVersion,
  );
  const language = i18n ? i18n.language : "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getExternalJobs(t), [current, t, language]);
}
