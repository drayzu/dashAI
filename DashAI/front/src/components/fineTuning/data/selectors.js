// Pure selectors over the prototype state (SPEC §3.2). They never mutate.
// Selectors returning arrays create a new array per call: use them through
// useFineTuningStore (shallow-equality memoized) or wrap them in useMemo.

const EMPTY = Object.freeze([]);

export const isActiveStatus = (status) => status === 1 || status === 2;

export function sessionById(state, sessionId) {
  return (state && state.sessions.find((s) => s.id === sessionId)) || null;
}

export function runById(state, runId) {
  return (state && state.runs.find((r) => r.id === runId)) || null;
}

export function checkpointById(state, checkpointId) {
  return (
    (state && state.checkpoints.find((c) => c.id === checkpointId)) || null
  );
}

export function adapterById(state, adapterId) {
  return (state && state.adapters.find((a) => a.id === adapterId)) || null;
}

export function chatById(state, chatId) {
  return (state && state.chats.find((c) => c.id === chatId)) || null;
}

export function comparisonById(state, comparisonId) {
  return (
    (state && state.comparisons.find((c) => c.id === comparisonId)) || null
  );
}

/** The run currently holding the (single, simulated) GPU, else null. */
export function activeRun(state) {
  if (!state) return null;
  return (
    state.runs.find((r) => r.status === 2) ||
    state.runs.find((r) => r.status === 1 && r.timeline) ||
    null
  );
}

/** Queued runs waiting for the GPU, in queue order. */
export function queuedRuns(state) {
  if (!state) return EMPTY;
  return state.runs
    .filter((r) => r.status === 1 && !r.timeline)
    .sort((a, b) => (a.queuedAt || 0) - (b.queuedAt || 0));
}

/** 1-based queue position of a run (0 when not waiting). */
export function queuePosition(state, runId) {
  const index = queuedRuns(state).findIndex((r) => r.id === runId);
  return index + 1;
}

/** Runs of a session. order "desc" (newest first, default) or "asc" (by number). */
export function runsBySession(state, sessionId, order = "desc") {
  if (!state) return EMPTY;
  const runs = state.runs.filter((r) => r.sessionId === sessionId);
  return runs.sort((a, b) =>
    order === "asc" ? a.number - b.number : b.number - a.number,
  );
}

/** Latest run that was actually started (status ≠ 0); else the newest config. */
export function latestRun(state, sessionId) {
  const runs = runsBySession(state, sessionId, "desc");
  return runs.find((r) => r.status !== 0) || runs[0] || null;
}

export function readyAdapters(state) {
  if (!state) return EMPTY;
  return state.adapters.filter((a) => a.availability === "ready");
}

export function adaptersBySession(state, sessionId) {
  if (!state) return EMPTY;
  return state.adapters.filter((a) => a.sessionId === sessionId);
}

export function readyCheckpoints(state) {
  if (!state) return EMPTY;
  return state.checkpoints.filter((c) => c.availability === "ready");
}

export function chatsByModelRef(state, modelRef) {
  if (!state || !modelRef) return EMPTY;
  return state.chats.filter(
    (c) =>
      c.modelRef &&
      c.modelRef.kind === modelRef.kind &&
      c.modelRef.id === modelRef.id,
  );
}

export function comparisonsByAdapter(state, adapterId) {
  if (!state) return EMPTY;
  return state.comparisons
    .filter((c) => c.adapterId === adapterId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Summary numbers for a session (left list descriptions, history header). */
export function sessionStats(state, sessionId) {
  const runs = runsBySession(state, sessionId, "desc");
  let best = null;
  runs.forEach((r) => {
    if (r.status !== 3) return;
    const evalPoints = (r.points || []).filter(
      (p) => typeof p.evalLoss === "number",
    );
    const value = evalPoints.length
      ? evalPoints[evalPoints.length - 1].evalLoss
      : null;
    if (value !== null && (best === null || value < best.value))
      best = { runId: r.id, value };
  });
  return {
    runCount: runs.filter((r) => r.status !== 0).length,
    configCount: runs.length,
    notStartedCount: runs.filter((r) => r.status === 0).length,
    activeCount: runs.filter((r) => isActiveStatus(r.status)).length,
    finishedCount: runs.filter((r) => r.status === 3).length,
    errorCount: runs.filter((r) => r.status === 4).length,
    adapterCount: adaptersBySession(state, sessionId).length,
    lastRun: runs.find((r) => r.status !== 0) || null,
    bestEvalLoss: best ? best.value : null,
    bestRunId: best ? best.runId : null,
  };
}

/** Final metrics of a run (last loss, last eval loss, duration in s). */
export function runSummary(run) {
  if (!run) return null;
  const points = run.points || [];
  const last = points[points.length - 1];
  const evalPoints = points.filter((p) => typeof p.evalLoss === "number");
  const lastEval = evalPoints[evalPoints.length - 1];
  return {
    finalLoss: last ? last.loss : null,
    finalEvalLoss: lastEval ? lastEval.evalLoss : null,
    durationSec:
      run.startedAt && run.endedAt
        ? Math.round((run.endedAt - run.startedAt) / 1000)
        : null,
    steps: run.step || 0,
    totalSteps: run.totalSteps || 0,
    peakVramGb: run.resources ? run.resources.peakVramGb : null,
    peakRamGb: run.resources ? run.resources.peakRamGb : null,
  };
}

/** True while a comparison still has outputs being generated. */
export function comparisonPending(comparison) {
  return Boolean(
    comparison &&
    comparison.items.some(
      (it) =>
        (it.base === null && !it.baseError) ||
        (it.adapted === null && !it.adaptedError),
    ),
  );
}

/** True when something in the state changes with time (drives auto-tick). */
export function isTimeDependent(state) {
  if (!state) return false;
  if (state.runs.some((r) => isActiveStatus(r.status))) return true;
  if (
    state.runs.some(
      (r) =>
        r.status === 3 &&
        r.timeline &&
        r.timeline.adapterMissingAt &&
        !r.adapterMissingApplied,
    )
  ) {
    return true;
  }
  if (state.checkpoints.some((c) => c.availability === "downloading"))
    return true;
  if (state.chats.some((c) => c.messages.some((m) => m.status === "pending")))
    return true;
  return state.comparisons.some(comparisonPending);
}

/** Whether the simulated GPU is busy with a training run (blocks inference). */
export function gpuBusyByTraining(state) {
  const run = activeRun(state);
  return Boolean(
    run &&
    run.status === 2 &&
    ["loading", "training", "evaluating", "saving"].includes(run.phase),
  );
}

/**
 * Aggregates of a base-vs-adapted comparison (R83): per side, share of valid
 * JSON tickets and correct categories (overall and per category), mean
 * manual content score (0–2, scored items only) and mean simulated latency.
 */
export function comparisonSummary(comparison) {
  if (!comparison) return null;
  const items = comparison.items || [];
  const side = (key) => {
    const done = items.filter(
      (it) => it[key] !== null && it[key] !== undefined,
    );
    const pct = (n, d) => (d ? n / d : null);
    const byCategory = {};
    ["datos", "entrenamiento", "inferencia"].forEach((cat) => {
      const inCat = done.filter(
        (it) => it.reference && it.reference.categoria === cat,
      );
      byCategory[cat] = {
        total: inCat.length,
        correct: inCat.filter((it) => it.auto && it.auto[`${key}CategoryOk`])
          .length,
      };
    });
    const scored = items.filter(
      (it) => it.scores && typeof it.scores[key] === "number",
    );
    const latencies = done
      .map((it) => it.latency && it.latency[key])
      .filter((v) => typeof v === "number");
    return {
      done: done.length,
      errors: items.filter((it) => it[`${key}Error`]).length,
      jsonValidRate: pct(
        done.filter((it) => it.auto && it.auto[`${key}JsonValid`]).length,
        done.length,
      ),
      categoryRate: pct(
        done.filter((it) => it.auto && it.auto[`${key}CategoryOk`]).length,
        done.length,
      ),
      byCategory,
      meanScore: scored.length
        ? scored.reduce((sum, it) => sum + it.scores[key], 0) / scored.length
        : null,
      scoredCount: scored.length,
      meanLatencyMs: latencies.length
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null,
    };
  };
  return {
    total: items.length,
    pending: comparisonPending(comparison),
    base: side("base"),
    adapted: side("adapted"),
  };
}
