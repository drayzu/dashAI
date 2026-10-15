import { createFineTuningStore, isValidState } from "./store";
import {
  activeRun,
  adapterById,
  comparisonSummary,
  latestRun,
  queuedRuns,
  runById,
  runsBySession,
  sessionStats,
} from "./selectors";
import { getSampleDataset, sampleDatasetRef } from "./sampleDatasets";
import {
  getPrototypeStore,
  resetPrototypeStoresForTests,
  runsToJobs,
} from "./instances";
import { getExternalJobs } from "../../../utils/externalJobs";

const T0 = Date.UTC(2026, 9, 14, 12, 0, 0);
const KEY = "dashai:ft-proto:test:v1";

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

function setup({
  storage = memoryStorage(),
  prototype = "A",
  seed = true,
} = {}) {
  const clock = { t: T0 };
  const store = createFineTuningStore({
    storageKey: KEY,
    storage,
    now: () => clock.t,
    autoTick: false,
    prototype,
    seed,
  });
  const advance = (ms, step = 500) => {
    const end = clock.t + ms;
    while (clock.t < end) {
      clock.t = Math.min(end, clock.t + step);
      store.tick();
    }
  };
  return { store, clock, storage, advance };
}

function newReadySession(store, patch = {}) {
  const ds = getSampleDataset("fichas-soporte");
  const sid = store.createSession();
  store.selectDataset(sid, sampleDatasetRef(ds), [...ds.columns], ds.rows);
  store.updateDraft(sid, {
    checkpointId: "qwen2.5-0.5b-instruct",
    method: "qlora",
    ...patch,
  });
  store.applyPreset(sid, "quick_test");
  return sid;
}

describe("seeds", () => {
  it("builds the reference session with two finished runs and one OOM failure", () => {
    const { store } = setup();
    const s = store.getSnapshot();
    expect(isValidState(s)).toBe(true);
    expect(s.sessions).toHaveLength(1);
    const session = s.sessions[0];
    expect(session.name).toBe("Asistente de soporte");
    expect(session.draft).toMatchObject({
      checkpointId: "qwen2.5-0.5b-instruct",
      method: "qlora",
      preset: "balanced",
      format: "alpaca",
      formatConfirmed: true,
    });
    expect(session.draft.dataset).toMatchObject({
      source: "sample",
      id: "fichas-soporte",
    });

    const runs = runsBySession(s, session.id, "asc");
    expect(runs.map((r) => r.status)).toEqual([3, 3, 4]);
    expect(runs[0].snapshot.draft.parameters).toMatchObject({
      loraR: 8,
      maxSteps: 60,
    });
    expect(runs[1].snapshot.draft.parameters).toMatchObject({
      loraR: 16,
      maxSteps: 120,
    });
    expect(runs[0].snapshot.draft.parameters.epochs).toBeUndefined();
    expect(runs[2]).toMatchObject({
      terminationReason: "failed",
      phase: "training",
    });
    expect(runs[2].failure.code).toBe("oom");
    expect(runs[2].snapshot.draft.method).toBe("lora");
    expect(runs[2].snapshot.checkpoint.id).toBe("qwen2.5-1.5b-instruct");
    expect(runs[0].points.length).toBe(60);
    expect(runs[0].points[0].loss).toBeGreaterThan(2);
    expect(runs[1].points[runs[1].points.length - 1].loss).toBeLessThan(1);
    expect(runs[0].createdAt).toBeLessThan(T0 - 4 * 24 * 3600 * 1000);

    expect(s.adapters).toHaveLength(2);
    s.adapters.forEach((a) => {
      expect(a.availability).toBe("ready");
      expect(a.files.map((f) => f.name)).toContain("adapter_model.safetensors");
      expect(a.manifestHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    });
    expect(adapterById(s, runs[1].adapterId).sizeBytes).toBeGreaterThan(30e6);

    const ck = Object.fromEntries(
      s.checkpoints.map((c) => [c.id, c.availability]),
    );
    expect(ck).toEqual({
      "qwen2.5-0.5b-instruct": "ready",
      "qwen2.5-1.5b-instruct": "missing",
      "llama-3.2-1b-instruct": "missing",
      "smollm2-360m-instruct": "ready",
      "phi-3.5-mini-instruct": "missing",
    });
    expect(store.isTicking()).toBe(false);
  });

  it("adds a not-started configuration for prototype B", () => {
    const { store } = setup({ prototype: "B" });
    const runs = store.getSnapshot().runs;
    expect(runs.map((r) => r.status)).toEqual([3, 3, 4, 0]);
    expect(runs[3].name).toBe("Qwen2.5 1.5B · QLoRA r16");
  });
});

describe("startRun", () => {
  it("is idempotent per requestId and validates the draft", () => {
    const { store } = setup();
    const empty = store.createSession();
    expect(() => store.startRun(empty, { requestId: "x" })).toThrow(
      "no_checkpoint",
    );
    try {
      store.startRun(empty, { requestId: "x" });
    } catch (e) {
      expect(e.codes).toEqual(
        expect.arrayContaining(["no_checkpoint", "no_dataset"]),
      );
    }
    const sid = newReadySession(store);
    const a = store.startRun(sid, { requestId: "req-1" });
    const b = store.startRun(sid, { requestId: "req-1" });
    expect(a).toBe(b);
    expect(
      store.getSnapshot().runs.filter((r) => r.sessionId === sid),
    ).toHaveLength(1);
    const run = runById(store.getSnapshot(), a);
    expect(run.status).toBe(2);
    expect(run.snapshot.dataset.preparedPreview.length).toBeLessThanOrEqual(3);
    expect(run.snapshot.dataset.rows).toBeUndefined();
  });

  it("blocks invalid data and unconfirmed downloads", () => {
    const { store } = setup();
    const ds = getSampleDataset("instrucciones-con-errores");
    const sid = store.createSession("Errores");
    store.selectDataset(sid, sampleDatasetRef(ds), [...ds.columns], ds.rows);
    store.updateDraft(sid, { checkpointId: "qwen2.5-1.5b-instruct" });
    try {
      store.startRun(sid, {});
      throw new Error("should have thrown");
    } catch (e) {
      expect(e.codes).toEqual(
        expect.arrayContaining(["data_invalid", "download_not_confirmed"]),
      );
      expect(e.details.issues.find((i) => i.code === "empty_value").count).toBe(
        3,
      );
    }
  });

  it("requires format confirmation when detection confidence is not high", () => {
    const { store } = setup();
    const ds = getSampleDataset("qa-pares");
    const sid = store.createSession();
    store.selectDataset(sid, sampleDatasetRef(ds), [...ds.columns], ds.rows);
    store.updateDraft(sid, { checkpointId: "qwen2.5-0.5b-instruct" });
    expect(() => store.startRun(sid, {})).toThrow("format_not_confirmed");
    store.updateDraft(sid, { formatConfirmed: true });
    expect(typeof store.startRun(sid, {})).toBe("string");
  });

  it("downloads the checkpoint only when it is missing", () => {
    const { store, advance } = setup();
    const sid = newReadySession(store, {
      checkpointId: "qwen2.5-1.5b-instruct",
      downloadConfirmed: true,
    });
    const id = store.startRun(sid, {});
    advance(2500);
    expect(runById(store.getSnapshot(), id).phase).toBe("downloading");
    const ck = () =>
      store
        .getSnapshot()
        .checkpoints.find((c) => c.id === "qwen2.5-1.5b-instruct");
    expect(ck().availability).toBe("downloading");
    advance(60000);
    expect(runById(store.getSnapshot(), id).status).toBe(3);
    expect(ck().availability).toBe("ready");
    expect(runById(store.getSnapshot(), id).events.map((e) => e.key)).toContain(
      "downloadDone",
    );

    const second = store.startRun(sid, {});
    advance(1000);
    expect(
      runById(store.getSnapshot(), second).timeline.plannedPhases,
    ).not.toContain("downloading");
  });
});

describe("single-GPU queue", () => {
  it("runs one at a time, in queue order, starting the next when the GPU frees", () => {
    const { store, advance, clock } = setup();
    const sid = newReadySession(store);
    const first = store.startRun(sid, { requestId: "a" });
    clock.t += 100;
    const second = store.startRun(sid, { requestId: "b" });
    clock.t += 100;
    const third = store.startRun(sid, { requestId: "c" });
    let s = store.getSnapshot();
    expect(activeRun(s).id).toBe(first);
    expect(queuedRuns(s).map((r) => r.id)).toEqual([second, third]);
    expect(runById(s, second).events.map((e) => e.key)).toEqual([
      "created",
      "queued",
      "waitingForRun",
    ]);

    advance(40000);
    s = store.getSnapshot();
    const r1 = runById(s, first);
    expect(r1.status).toBe(3);
    expect(runById(s, second).status).toBe(2);
    expect(runById(s, second).startedAt).toBe(r1.endedAt);
    expect(runById(s, third).status).toBe(1);

    advance(80000);
    s = store.getSnapshot();
    expect([first, second, third].map((id) => runById(s, id).status)).toEqual([
      3, 3, 3,
    ]);
    expect(runById(s, third).startedAt).toBe(runById(s, second).endedAt);
    expect(s.adapters.filter((a) => a.sessionId === sid)).toHaveLength(3);
  });

  it("waits while the demo GPU is busy", () => {
    const { store, advance } = setup();
    store.setDemo({ gpuBusy: true });
    const sid = newReadySession(store);
    const id = store.startRun(sid, {});
    advance(5000);
    let run = runById(store.getSnapshot(), id);
    expect(run.status).toBe(1);
    expect(run.events.map((e) => e.key)).toContain("gpuWaiting");
    store.setDemo({ gpuBusy: false });
    advance(500);
    run = runById(store.getSnapshot(), id);
    expect(run.status).toBe(2);
  });

  it("cancels an active run and a queued run", () => {
    const { store, advance } = setup();
    const sid = newReadySession(store);
    const first = store.startRun(sid, { requestId: "a" });
    const second = store.startRun(sid, { requestId: "b" });
    advance(6500);
    expect(store.cancelRun(second)).toBeNull();
    let s = store.getSnapshot();
    expect(runById(s, second)).toMatchObject({
      status: 4,
      terminationReason: "cancelled",
      phase: null,
    });
    expect(runById(s, second).events.map((e) => e.key)).toContain(
      "cancelledQueued",
    );

    const phase = runById(s, first).phase;
    expect(store.cancelRun(first)).toBeNull();
    s = store.getSnapshot();
    expect(runById(s, first)).toMatchObject({
      status: 4,
      terminationReason: "cancelled",
      phase,
    });
    expect(runById(s, first).resources.vramGb).toBe(0);
    expect(store.cancelRun(first)).toBe("run_not_active");
    advance(60000);
    expect(runById(store.getSnapshot(), first).status).toBe(4);
    expect(
      store.getSnapshot().adapters.filter((a) => a.sessionId === sid),
    ).toHaveLength(0);
  });

  it("takes the scenario from demo.nextFailure once", () => {
    const { store, advance } = setup();
    store.setDemo({ nextFailure: "nan_loss" });
    const sid = newReadySession(store);
    const id = store.startRun(sid, {});
    expect(store.getSnapshot().demo.nextFailure).toBeNull();
    advance(60000);
    const run = runById(store.getSnapshot(), id);
    expect(run).toMatchObject({ status: 4, terminationReason: "failed" });
    expect(run.failure.code).toBe("nan_loss");
    const next = store.startRun(sid, {});
    advance(60000);
    expect(runById(store.getSnapshot(), next).status).toBe(3);
  });

  it("marks the adapter missing after a missing_adapter run (run stays finished)", () => {
    const { store, advance } = setup();
    store.setDemo({ nextFailure: "missing_adapter" });
    const sid = newReadySession(store);
    const id = store.startRun(sid, {});
    advance(60000);
    const s = store.getSnapshot();
    const run = runById(s, id);
    expect(run.status).toBe(3);
    expect(adapterById(s, run.adapterId).availability).toBe("missing");
    expect(run.events.map((e) => e.key)).toContain("adapterMissing");
  });

  it("speeds up an active run when the demo speed changes", () => {
    const { store, advance } = setup();
    const sid = newReadySession(store);
    const id = store.startRun(sid, {});
    advance(9000);
    const before = runById(store.getSnapshot(), id);
    store.setDemo({ speed: 20 });
    const after = runById(store.getSnapshot(), id);
    expect(after.step).toBe(before.step);
    advance(3000);
    expect(runById(store.getSnapshot(), id).status).toBe(3);
  });
});

describe("prototype B support", () => {
  it("creates, edits, trains and retrains run configurations", () => {
    const { store, advance } = setup({ prototype: "B" });
    const sid = store.getSnapshot().sessions[0].id;
    const cfg = store.createRunConfig(sid, {
      checkpointId: "smollm2-360m-instruct",
      method: "lora",
      preset: "quick_test",
      parameters: { maxSteps: 10, loraR: 8, loraAlpha: 16 },
      runName: "SmolLM2 · LoRA r8",
    });
    let run = runById(store.getSnapshot(), cfg);
    expect(run).toMatchObject({ status: 0, name: "SmolLM2 · LoRA r8" });
    expect(run.snapshot.checkpoint.id).toBe("smollm2-360m-instruct");
    expect(run.snapshot.dataset.id).toBe("fichas-soporte");

    expect(() =>
      store.createRunConfig(sid, {
        checkpointId: "smollm2-360m-instruct",
        method: "qlora",
      }),
    ).toThrow("method_unsupported");

    store.updateRunConfig(cfg, { parameters: { maxSteps: 12 } });
    run = runById(store.getSnapshot(), cfg);
    expect(run.snapshot.draft.parameters.maxSteps).toBe(12);
    expect(run.snapshot.draft.parameters.loraR).toBe(8);

    const { queued, skipped } = store.trainAll(sid);
    expect(skipped).toEqual([]);
    expect(queued).toHaveLength(2);
    expect(store.trainRun(queued[0])).toBe(queued[0]);
    expect(() =>
      store.updateRunConfig(cfg, { parameters: { maxSteps: 5 } }),
    ).toThrow("not_editable");
    const s = store.getSnapshot();
    // The seeded 1.5B config (number 4) queued before the new one (number 5).
    expect(activeRun(s).number).toBe(4);
    expect(queuedRuns(s).map((r) => r.id)).toEqual([cfg]);

    advance(200000);
    expect(runById(store.getSnapshot(), cfg).status).toBe(3);

    const retrain = store.trainRun(cfg, { requestId: "retrain-1" });
    expect(retrain).not.toBe(cfg);
    expect(store.trainRun(cfg, { requestId: "retrain-1" })).toBe(retrain);
    expect(runById(store.getSnapshot(), retrain)).toMatchObject({
      status: 2,
      clonedFromRunId: cfg,
    });
    expect(sessionStats(store.getSnapshot(), sid).notStartedCount).toBe(0);
  });

  it("refuses to queue a gated checkpoint without credential", () => {
    const { store } = setup({ prototype: "B" });
    const sid = store.getSnapshot().sessions[0].id;
    const cfg = store.createRunConfig(sid, {
      checkpointId: "llama-3.2-1b-instruct",
      method: "qlora",
    });
    expect(() => store.trainRun(cfg)).toThrow("credential_required");
    store.setDemo({ hfCredential: true });
    expect(store.trainRun(cfg)).toBe(cfg);
  });
});

describe("sessions and drafts", () => {
  it("deep-merges parameters, switches to custom and resets mapping on format change", () => {
    const { store } = setup();
    const sid = store.getSnapshot().sessions[0].id;
    store.updateDraft(sid, { parameters: { learningRate: 1e-4 } });
    let draft = store.getSnapshot().sessions[0].draft;
    expect(draft.preset).toBe("custom");
    expect(draft.parameters).toMatchObject({
      learningRate: 1e-4,
      maxSteps: 60,
      loraR: 16,
    });
    store.updateDraft(sid, { format: "prompt_completion" });
    draft = store.getSnapshot().sessions[0].draft;
    expect(draft.mapping).toEqual({
      prompt: "instruction",
      completion: "output",
    });
    expect(draft.formatConfirmed).toBe(false);
    store.applyPreset(sid, "qlora_8gb");
    draft = store.getSnapshot().sessions[0].draft;
    expect(draft.parameters).toMatchObject({
      maxSteps: 120,
      maxLength: 1024,
      batchSize: 1,
      gradAccum: 8,
    });
  });

  it("gives unique default names and blocks deleting a session with an active run", () => {
    const { store } = setup({ seed: false });
    const a = store.createSession();
    const b = store.createSession();
    const names = store.getSnapshot().sessions.map((s) => s.name);
    expect(names).toEqual(["Sesión 1", "Sesión 2"]);
    const sid = newReadySession(store);
    store.startRun(sid, {});
    expect(store.deleteSession(sid)).toBe("session_has_active_run");
    expect(store.deleteSession(a)).toBeNull();
    expect(store.getSnapshot().sessions.map((s) => s.id)).not.toContain(a);
    expect(b).toBeTruthy();
  });

  it("clones a run configuration back into the draft", () => {
    const { store } = setup();
    const s = store.getSnapshot();
    const sid = s.sessions[0].id;
    const failed = runsBySession(s, sid, "asc")[2];
    store.cloneRunToDraft(failed.id);
    const draft = store.getSnapshot().sessions[0].draft;
    expect(draft).toMatchObject({
      checkpointId: "qwen2.5-1.5b-instruct",
      method: "lora",
      downloadConfirmed: false,
    });
    expect(draft.parameters.epochs).toBe(1);
    expect(latestRun(store.getSnapshot(), sid).id).toBe(failed.id);
  });
});

describe("chat", () => {
  it("resolves with a frozen snapshot even if the model changes", () => {
    const { store, advance } = setup();
    const adapter = store.getSnapshot().adapters[1];
    const chatId = store.openChat({ kind: "adapter", id: adapter.id });
    expect(store.openChat({ kind: "adapter", id: adapter.id })).toBe(chatId);
    const msgId = store.sendMessage(
      chatId,
      "El modelo base no está descargado y el chat con mi adaptador no funciona.",
    );
    store.setChatModel(chatId, { kind: "base", id: "qwen2.5-0.5b-instruct" });
    advance(3000);
    const chat = store.getSnapshot().chats.find((c) => c.id === chatId);
    const msg = chat.messages.find((m) => m.id === msgId);
    expect(msg.status).toBe("done");
    expect(msg.snapshot.modelRef).toEqual({ kind: "adapter", id: adapter.id });
    expect(JSON.parse(msg.text).categoria).toBe("inferencia");
    expect(chat.modelRef.kind).toBe("base");
  });

  it("never falls back to the base model when the adapter is missing", () => {
    const { store, advance } = setup();
    const adapter = store.getSnapshot().adapters[0];
    const chatId = store.openChat({ kind: "adapter", id: adapter.id });
    const msgId = store.sendMessage(chatId, "Hola");
    store.setAdapterAvailability(adapter.id, "missing");
    advance(3000);
    const msg = store
      .getSnapshot()
      .chats.find((c) => c.id === chatId)
      .messages.find((m) => m.id === msgId);
    expect(msg).toMatchObject({
      status: "error",
      errorCode: "adapter_missing",
      text: "",
    });
  });

  it("reports base_missing and gpu_busy", () => {
    const { store, advance } = setup();
    const chatId = store.openChat({
      kind: "base",
      id: "phi-3.5-mini-instruct",
    });
    const m1 = store.sendMessage(chatId, "Hola");
    advance(3000);
    const get = (id) =>
      store
        .getSnapshot()
        .chats.find((c) => c.id === chatId)
        .messages.find((m) => m.id === id);
    expect(get(m1).errorCode).toBe("base_missing");
    store.setChatModel(chatId, { kind: "base", id: "qwen2.5-0.5b-instruct" });
    store.setDemo({ gpuBusy: true });
    const m2 = store.sendMessage(chatId, "Hola");
    advance(3000);
    expect(get(m2)).toMatchObject({ status: "error", errorCode: "gpu_busy" });
    expect(get(m2).errorParams.cause).toBe("external");
    store.setDemo({ gpuBusy: false });
    const m3 = store.sendMessage(chatId, "Hola");
    advance(3000);
    expect(get(m3).status).toBe("done");
  });
});

describe("comparison", () => {
  it("generates 12 held-out items progressively with format/category checks", () => {
    const { store, advance } = setup();
    const adapter = store.getSnapshot().adapters[1];
    const id = store.createComparison(adapter.id, {
      params: { temperature: 0.2 },
    });
    let cmp = store.getSnapshot().comparisons.find((c) => c.id === id);
    expect(cmp.items).toHaveLength(12);
    expect(
      cmp.items.every((it) => it.base === null && it.adapted === null),
    ).toBe(true);
    advance(1000, 100);
    cmp = store.getSnapshot().comparisons.find((c) => c.id === id);
    const doneSides = cmp.items.reduce(
      (n, it) => n + (it.base !== null) + (it.adapted !== null),
      0,
    );
    expect(doneSides).toBe(3);
    advance(8000);
    cmp = store.getSnapshot().comparisons.find((c) => c.id === id);
    const count = (key) => cmp.items.filter((it) => it.auto[key]).length;
    expect(count("adaptedJsonValid")).toBe(12);
    expect(count("adaptedCategoryOk")).toBe(11);
    expect(count("baseJsonValid")).toBe(3);
    expect(count("baseCategoryOk")).toBeLessThan(8);
    const summary = comparisonSummary(cmp);
    expect(summary.adapted.jsonValidRate).toBe(1);
    expect(summary.adapted.byCategory.entrenamiento).toEqual({
      total: 4,
      correct: 3,
    });
    expect(summary.base.jsonValidRate).toBeCloseTo(0.25);
    expect(summary.pending).toBe(false);
    expect(cmp.order).toHaveLength(12);
    expect([...cmp.rowOrder].sort((a, b) => a - b)).toEqual([
      ...Array(12).keys(),
    ]);
    store.scoreComparisonItem(id, cmp.items[0].id, "adapted", 2);
    store.setComparisonBlind(id, true);
    cmp = store.getSnapshot().comparisons.find((c) => c.id === id);
    expect(cmp.items[0].scores.adapted).toBe(2);
    expect(cmp.blind).toBe(true);
    expect(store.isTicking()).toBe(false);
  });
});

describe("persistence", () => {
  it("falls back to seeds on corrupt JSON or wrong version", () => {
    const corrupt = setup({ storage: memoryStorage({ [KEY]: "{not json" }) });
    expect(corrupt.store.getSnapshot().sessions[0].name).toBe(
      "Asistente de soporte",
    );
    const wrong = setup({
      storage: memoryStorage({
        [KEY]: JSON.stringify({ version: 2, runs: [] }),
      }),
    });
    expect(wrong.store.getSnapshot().runs).toHaveLength(3);
  });

  it("keeps working in memory when setItem throws", () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    const { store } = setup({ storage });
    const id = store.createSession("En memoria");
    expect(store.getSnapshot().storageError).toBe(true);
    expect(store.getSnapshot().sessions.find((s) => s.id === id).name).toBe(
      "En memoria",
    );
  });

  it("does not throw when localStorage itself is unavailable", () => {
    const storage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(() => setup({ storage })).not.toThrow();
  });

  it("continues an active run after a reload", () => {
    const storage = memoryStorage();
    const first = setup({ storage });
    const sid = newReadySession(first.store);
    const id = first.store.startRun(sid, {});
    first.advance(8000);
    first.store.flush();
    first.store.destroy();
    // Reload 10 s later: progress is derived from the stored timeline.
    const clock = { t: first.clock.t + 10000 };
    const reloaded = createFineTuningStore({
      storageKey: KEY,
      storage,
      now: () => clock.t,
      autoTick: false,
    });
    const run = runById(reloaded.getSnapshot(), id);
    expect(run.status).toBe(2);
    expect(run.phase).toBe("training");
    expect(run.step).toBeGreaterThan(0);
    clock.t += 60000;
    reloaded.tick();
    expect(runById(reloaded.getSnapshot(), id).status).toBe(3);
  });

  it("only ticks while something is time-dependent", () => {
    jest.useFakeTimers();
    try {
      const storage = memoryStorage();
      const store = createFineTuningStore({
        storageKey: KEY,
        storage,
        autoTick: true,
      });
      expect(store.isTicking()).toBe(false);
      const adapter = store.getSnapshot().adapters[0];
      const chatId = store.openChat({ kind: "adapter", id: adapter.id });
      expect(store.isTicking()).toBe(false);
      store.sendMessage(chatId, "Hola");
      expect(store.isTicking()).toBe(true);
      jest.advanceTimersByTime(3000);
      expect(store.isTicking()).toBe(false);
      store.destroy();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("instances and job registry", () => {
  afterEach(() => resetPrototypeStoresForTests());

  it("creates lazy singletons and exposes non-seeded runs as external jobs", () => {
    window.localStorage.clear();
    const a = getPrototypeStore("A");
    expect(getPrototypeStore("A")).toBe(a);
    expect(getPrototypeStore("B")).not.toBe(a);
    expect(a.isTicking()).toBe(false);
    const t = (key, opts) => (opts && opts.step ? `${key}:${opts.step}` : key);
    expect(runsToJobs(a, "A", t)).toEqual([]);
    const sid = a.getSnapshot().sessions[0].id;
    a.updateDraft(sid, { downloadConfirmed: true });
    const runId = a.startRun(sid, { requestId: "job-1" });
    const jobs = getExternalJobs(t).filter((j) => j.id.startsWith("ft-A-"));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      id: `ft-A-${runId}`,
      external: true,
      task_type: "FineTuningJob",
      status: "started",
      href: `/app/generative/fine-tuning/sessions/${sid}/runs/${runId}`,
    });
    jobs[0].onCancel();
    const cancelled = getExternalJobs(t).find((j) => j.id === `ft-A-${runId}`);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.onCancel).toBeUndefined();
    a.destroy();
  });
});
