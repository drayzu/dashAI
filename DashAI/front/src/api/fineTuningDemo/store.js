import { DEMO_STORAGE_KEY } from "./config";
import { checkpoints, datasets, defaultDraft, mappingFor } from "./fixtures";

const copy = (value) => JSON.parse(JSON.stringify(value));
const active = (run) => ["DELIVERED", "STARTED"].includes(run.status);
const failureTimes = { incomplete_download: 0.2, oom: 0.42, interrupted: 0.5 };
export const scenarios = [
  "success",
  "invalid_data",
  "incompatible",
  "incomplete_download",
  "oom",
  "interrupted",
  "missing_adapter",
];

export function prepareExamples(dataset, draft) {
  return dataset.rows.map((row, index) => {
    if (draft.format === "messages") {
      const value = row[draft.mapping.messages];
      const messages = typeof value === "string" ? JSON.parse(value) : value;
      if (
        !Array.isArray(messages) ||
        !messages.length ||
        messages.some(
          (m) =>
            !["system", "user", "assistant"].includes(m.role) ||
            typeof m.content !== "string" ||
            !m.content.trim(),
        ) ||
        !messages.some((m) => m.role === "assistant")
      )
        throw new Error(`invalid_row:${index + 1}`);
      return { messages, loss: "assistant" };
    }
    const instruction = row[draft.mapping.instruction];
    const response = row[draft.mapping.response];
    if (
      typeof instruction !== "string" ||
      !instruction.trim() ||
      typeof response !== "string" ||
      !response.trim()
    ) {
      throw new Error(`invalid_row:${index + 1}`);
    }
    const input =
      draft.format === "alpaca" && draft.mapping.input
        ? row[draft.mapping.input]
        : "";
    return {
      messages: [
        {
          role: "user",
          content: [instruction, input].filter(Boolean).join("\n\n"),
        },
        { role: "assistant", content: response },
      ],
      loss: "completion",
    };
  });
}

export function validateDraft(draft, state) {
  const errors = [];
  const checkpoint = state.checkpoints.find((c) => c.id === draft.checkpointId);
  const dataset = state.datasets.find((d) => d.id === draft.datasetId);
  const p = draft.parameters;
  if (!checkpoint || !checkpoint.methods.includes(draft.method))
    errors.push("incompatible");
  if (!dataset) errors.push("dataset_missing");
  const positiveInts = [
    "maxLength",
    "batch",
    "accumulation",
    "rank",
    draft.durationMode === "steps" ? "steps" : "epochs",
  ];
  if (
    [...positiveInts, "learningRate", "alpha", "dropout"].some(
      (k) => p[k] === null || p[k] === "",
    ) ||
    positiveInts.some(
      (k) => !Number.isInteger(Number(p[k])) || Number(p[k]) <= 0,
    ) ||
    !Number.isFinite(Number(p.learningRate)) ||
    Number(p.learningRate) <= 0 ||
    Number(p.learningRate) >= 1 ||
    !Number.isFinite(Number(p.alpha)) ||
    Number(p.alpha) <= 0 ||
    !Number.isFinite(Number(p.dropout)) ||
    Number(p.dropout) < 0 ||
    Number(p.dropout) >= 1 ||
    !Number.isFinite(Number(draft.validation)) ||
    draft.validation < 0 ||
    draft.validation >= 0.5 ||
    !Number.isInteger(Number(draft.seed)) ||
    Number(draft.seed) < 0
  )
    errors.push("parameters");
  let examples = [];
  if (dataset) {
    try {
      examples = prepareExamples(dataset, draft);
    } catch {
      errors.push("invalid_data");
    }
  }
  if (["invalid_data", "incompatible"].includes(draft.scenario))
    errors.push(draft.scenario);
  if (
    checkpoint?.availability === "invalid" &&
    draft.scenario !== "incomplete_download"
  )
    errors.push("checkpoint_invalid");
  const evaluation = Math.floor(examples.length * Number(draft.validation));
  if (examples.length && draft.validation > 0 && evaluation === 0)
    errors.push("split_small");
  return {
    ready: errors.length === 0,
    errors: [...new Set(errors)],
    examples,
    train: examples.length - evaluation,
    evaluation,
  };
}

// Reproducible indices are stored with the run; this is a demo split, not SFT tokenization.
export function partitionExamples(count, validation, seed) {
  const indices = Array.from({ length: count }, (_, i) => i);
  let value = Number(seed) >>> 0;
  for (let i = indices.length - 1; i > 0; i--) {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    const j = value % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const evaluation = Math.floor(count * validation);
  return {
    evaluation: indices.slice(0, evaluation),
    train: indices.slice(evaluation),
  };
}

function metrics(step, total) {
  const points = Math.min(step, 200);
  return Array.from({ length: points }, (_, i) => {
    const current =
      points === step ? i + 1 : Math.ceil(((i + 1) / points) * step);
    return {
      step: current,
      train: Number(
        (2.3 - 0.8 * (current / total) + Math.sin(i * 1.7) * 0.06).toFixed(4),
      ),
      evaluation: Number(
        (2.4 - 0.65 * (current / total) + Math.cos(i) * 0.025).toFixed(4),
      ),
    };
  });
}

function initialState(now) {
  const draft = defaultDraft();
  const snapshot = {
    draft: copy(draft),
    checkpoint: copy(checkpoints[0]),
    dataset: copy(datasets[0]),
    prepared: prepareExamples(datasets[0], draft),
    splits: partitionExamples(32, draft.validation, draft.seed),
  };
  const seedRun = (id, name, offset) => ({
    id,
    name,
    sessionId: "session-1",
    snapshot: copy(snapshot),
    status: "FINISHED",
    queueStatus: "finished",
    phase: "saving",
    terminationReason: null,
    progress: 1,
    step: 30,
    metrics: metrics(30, 30),
    startedAt: now - offset,
    updatedAt: now - offset + 40000,
    error: null,
  });
  return {
    version: 1,
    deletedJobIds: [],
    counter: 10,
    checkpoints: copy(checkpoints),
    datasets: copy(datasets),
    sessions: [
      {
        id: "session-1",
        name: "Asistente de soporte",
        draft,
        createdAt: now - 86400000,
      },
    ],
    runs: [
      seedRun("run-1", "Soporte · v1", 86400000),
      seedRun("run-2", "Soporte · v2", 3600000),
    ],
    adaptedModels: [
      {
        id: "adapter-1",
        name: "Soporte · v1",
        runId: "run-1",
        availability: "ready",
      },
      {
        id: "adapter-2",
        name: "Soporte · v2",
        runId: "run-2",
        availability: "ready",
      },
    ],
    chats: [],
    storageError: false,
  };
}

export function createDemoStore({
  storage,
  now = Date.now,
  duration = 40000,
} = {}) {
  let state = initialState(now());
  try {
    const saved = JSON.parse(storage?.getItem(DEMO_STORAGE_KEY) || "null");
    if (
      saved?.version === 1 &&
      [
        "sessions",
        "runs",
        "checkpoints",
        "datasets",
        "adaptedModels",
        "chats",
      ].every((k) => Array.isArray(saved[k]))
    )
      state = saved;
  } catch {
    /* A corrupt demo must not prevent opening DashAI. */
  }
  const listeners = new Set();
  const publish = () => {
    try {
      storage?.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    } catch {
      state.storageError = true;
    }
    listeners.forEach((listener) => listener());
  };
  const change = (fn) => {
    state = copy(state);
    fn(state);
    publish();
  };
  const find = (items, id) => {
    const result = items.find((x) => x.id === id);
    if (!result) throw new Error("not_found");
    return result;
  };
  const fail = (run, reason, error, updatedAt = now()) =>
    Object.assign(run, {
      status: "ERROR",
      terminationReason: reason,
      error,
      updatedAt,
      queueStatus:
        reason === "cancelled"
          ? "cancelled"
          : reason === "interrupted"
            ? "killed"
            : "error",
    });
  const store = {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reset: () => {
      state = initialState(now());
      publish();
    },
    createSession(name) {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("name_required");
      let id;
      change((s) => {
        id = `session-${++s.counter}`;
        s.sessions.push({
          id,
          name: trimmed,
          draft: defaultDraft(),
          createdAt: now(),
        });
      });
      return id;
    },
    renameSession(id, name) {
      if (!name.trim()) throw new Error("name_required");
      change((s) => {
        find(s.sessions, id).name = name.trim();
      });
    },
    updateDraft(id, patch) {
      change((s) => {
        const session = find(s.sessions, id);
        session.draft = { ...session.draft, ...copy(patch) };
      });
    },
    selectDataset(id, datasetId) {
      const dataset = find(state.datasets, datasetId);
      store.updateDraft(id, {
        datasetId,
        format: dataset.format,
        mapping: mappingFor(dataset),
      });
    },
    importExample(format) {
      let id;
      change((s) => {
        const source = s.datasets.find((d) => d.format === format);
        id = ++s.counter + 1000;
        s.datasets.push({
          ...copy(source),
          id,
          name: `${source.name} · importado`,
          fingerprint: `demo:import:${id}`,
        });
      });
      return id;
    },
    validate: (id) => validateDraft(find(state.sessions, id).draft, state),
    downloadCheckpoint(id) {
      change((s) => {
        const c = find(s.checkpoints, id);
        c.availability = "downloading";
        c.downloadStartedAt = now();
      });
    },
    startRun(id) {
      const session = find(state.sessions, id);
      const report = store.validate(id);
      if (!report.ready) throw new Error(report.errors[0]);
      if (state.runs.some(active)) throw new Error("queue_busy");
      let runId;
      change((s) => {
        const checkpoint = find(s.checkpoints, session.draft.checkpointId);
        const dataset = find(s.datasets, session.draft.datasetId);
        const draft = copy(session.draft);
        // Only the chosen duration limit belongs to the immutable execution config.
        if (draft.durationMode === "steps") delete draft.parameters.epochs;
        else delete draft.parameters.steps;
        runId = `run-${++s.counter}`;
        s.runs.unshift({
          id: runId,
          sessionId: id,
          name: `${session.name} · ${
            s.runs.filter((r) => r.sessionId === id).length + 1
          }`,
          snapshot: {
            draft,
            checkpoint: copy(checkpoint),
            dataset: copy(dataset),
            prepared: copy(report.examples),
            splits: partitionExamples(
              dataset.rows.length,
              draft.validation,
              draft.seed,
            ),
          },
          status: "DELIVERED",
          queueStatus: "not_started",
          phase: "preparing",
          terminationReason: null,
          progress: 0,
          step: 0,
          metrics: [],
          startedAt: now(),
          updatedAt: now(),
          error: null,
        });
      });
      return runId;
    },
    cancelRun(id) {
      change((s) => {
        const run = find(s.runs, id);
        if (active(run)) fail(run, "cancelled", "cancelled");
      });
    },
    removeJob(id) {
      change((s) => {
        const run = find(s.runs, id);
        if (active(run)) fail(run, "cancelled", "cancelled");
        s.deletedJobIds = [...new Set([...(s.deletedJobIds || []), id])];
      });
    },
    clearJobs() {
      const count = state.runs.filter(active).length;
      change((s) => {
        s.runs
          .filter(active)
          .forEach((run) => fail(run, "cancelled", "cancelled"));
        s.deletedJobIds = s.runs.map((r) => r.id);
      });
      return count;
    },
    setAdapterAvailability(id, availability) {
      change((s) => {
        find(s.adaptedModels, id).availability = availability;
      });
    },
    tick() {
      const pendingChats = state.chats.some((chat) =>
        chat.messages.some((m) => m.status === "pending"),
      );
      if (
        !state.runs.some(active) &&
        !state.checkpoints.some((c) => c.availability === "downloading") &&
        !pendingChats
      )
        return;
      change((s) => {
        s.checkpoints.forEach((c) => {
          if (
            c.availability === "downloading" &&
            now() - c.downloadStartedAt >= 3000
          )
            c.availability = "ready";
        });
        s.runs.filter(active).forEach((run) => {
          const scenario = run.snapshot.draft.scenario;
          const failureTime = failureTimes[scenario];
          // A delayed tick or reload must not advance beyond a simulated failure.
          const elapsed = Math.max(
            0,
            Math.min((now() - run.startedAt) / duration, failureTime ?? 1),
          );
          run.progress = elapsed;
          run.updatedAt = run.startedAt + elapsed * duration;
          if (elapsed < 0.05) return;
          run.status = "STARTED";
          run.queueStatus = "started";
          run.phase =
            elapsed < 0.1
              ? "preparing"
              : elapsed < 0.2
                ? "downloading"
                : elapsed < 0.27
                  ? "validating"
                  : elapsed < 0.35
                    ? "loading"
                    : elapsed < 0.94
                      ? "training"
                      : "saving";
          const total =
            run.snapshot.draft.durationMode === "steps"
              ? Number(run.snapshot.draft.parameters.steps)
              : Math.ceil(
                  run.snapshot.splits.train.length /
                    (run.snapshot.draft.parameters.batch *
                      run.snapshot.draft.parameters.accumulation),
                ) * run.snapshot.draft.parameters.epochs;
          run.step = Math.min(
            total,
            Math.floor(Math.max(0, (elapsed - 0.35) / 0.59) * total),
          );
          run.metrics = metrics(run.step, total);
          if (failureTime !== undefined && elapsed >= failureTime) {
            if (scenario === "incomplete_download") run.phase = "downloading";
            fail(
              run,
              scenario === "interrupted" ? "interrupted" : "failed",
              scenario,
              run.updatedAt,
            );
            return;
          }
          if (elapsed >= 1) {
            run.status = "FINISHED";
            run.queueStatus = "finished";
            run.phase = "saving";
            const checkpoint = find(s.checkpoints, run.snapshot.checkpoint.id);
            checkpoint.availability = "ready";
            s.adaptedModels.push({
              id: `adapter-${run.id}`,
              name: run.name,
              runId: run.id,
              availability:
                scenario === "missing_adapter" ? "missing" : "ready",
            });
          }
        });
        s.chats.forEach((chat) =>
          chat.messages.forEach((message) => {
            if (
              message.status !== "pending" ||
              now() - message.createdAt < 1400
            )
              return;
            const adapter = s.adaptedModels.find(
              (a) => a.id === message.snapshot.adapterId,
            );
            const base = s.checkpoints.find(
              (c) => c.id === message.snapshot.checkpointId,
            );
            if (
              adapter?.availability !== "ready" ||
              base?.availability !== "ready"
            ) {
              message.status = "error";
              message.error = "missing_adapter";
              return;
            }
            message.status = "finished";
            const input = message.input.toLowerCase();
            message.outputKey = input.includes("contrase")
              ? "passwordResponse"
              : input.includes("devol")
                ? "returnResponse"
                : "genericResponse";
          }),
        );
      });
    },
    openChat(adapterId) {
      const adapter = find(state.adaptedModels, adapterId);
      const run = find(state.runs, adapter.runId);
      if (
        adapter.availability !== "ready" ||
        find(state.checkpoints, run.snapshot.checkpoint.id).availability !==
          "ready"
      )
        throw new Error("missing_adapter");
      const existing = state.chats.find((c) => c.adapterId === adapterId);
      if (existing) return existing.id;
      let id;
      change((s) => {
        id = `chat-${++s.counter}`;
        s.chats.push({
          id,
          name: adapter.name,
          adapterId,
          parameters: { temperature: 0.7, maxTokens: 256, topP: 0.9 },
          messages: [],
        });
      });
      return id;
    },
    updateChat(id, patch) {
      change((s) => {
        Object.assign(find(s.chats, id), copy(patch));
      });
    },
    sendMessage(id, input) {
      if (!input.trim()) return;
      const chat = find(state.chats, id);
      const adapter = find(state.adaptedModels, chat.adapterId);
      const run = find(state.runs, adapter.runId);
      if (
        adapter.availability !== "ready" ||
        find(state.checkpoints, run.snapshot.checkpoint.id).availability !==
          "ready"
      )
        throw new Error("missing_adapter");
      change((s) => {
        find(s.chats, id).messages.push({
          id: `message-${++s.counter}`,
          input: input.trim(),
          status: "pending",
          createdAt: now(),
          snapshot: {
            adapterId: adapter.id,
            adapterName: adapter.name,
            checkpointId: run.snapshot.checkpoint.id,
            revision: run.snapshot.checkpoint.revision,
            parameters: copy(chat.parameters),
          },
        });
      });
    },
    jobs() {
      return state.runs.map((run) => ({
        id: run.id,
        task_type: "FineTuningJob",
        status: (state.deletedJobIds || []).includes(run.id)
          ? "deleted"
          : run.queueStatus,
        name: run.name,
        job_name: run.name,
        entity_name: run.name,
        progress: run.progress,
        progress_message: run.phase,
        created_at: new Date(run.startedAt).toISOString(),
        updated_at: new Date(run.updatedAt).toISOString(),
        last_update: new Date(run.updatedAt).toISOString(),
        kwargs: { run_id: run.id },
        entity_id: run.id,
      }));
    },
  };
  return store;
}

let browserStorage;
try {
  browserStorage = window.localStorage;
} catch {
  /* In-memory demo still works. */
}
export const fineTuningDemoStore = createDemoStore({ storage: browserStorage });
