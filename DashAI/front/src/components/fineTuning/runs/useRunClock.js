// 1 s clock for elapsed time / ETA of a run. Only ticks while the run is
// queued or running; terminal runs use their stored timestamps.

import { useNow } from "../FineTuningContext";
import { isActiveStatus } from "../data/selectors";
import { runTiming } from "../data/simulator";

/**
 * @param {object|null} run
 * @returns {{ now: number, elapsedMs: number, remainingMs: number|null, active: boolean }}
 */
export default function useRunClock(run) {
  const active = Boolean(run && isActiveStatus(run.status));
  const now = useNow(1000, active);
  if (!run) return { now, elapsedMs: 0, remainingMs: null, active: false };
  const { elapsedMs, remainingMs } = runTiming(run, now);
  return { now, elapsedMs, remainingMs, active };
}
