import { createDemoStore, prepareExamples, validateDraft } from "./store";
import { datasets, defaultDraft } from "./fixtures";
import { DEMO_STORAGE_KEY } from "./config";

function setup() {
  let time = 100000000;
  const data = new Map();
  const storage = {
    getItem: (k) => data.get(k),
    setItem: (k, v) => data.set(k, v),
  };
  const now = () => time;
  const store = createDemoStore({ storage, now });
  return {
    store,
    storage,
    now,
    advance: (ms) => {
      time += ms;
      store.tick();
    },
  };
}

test("recognizes all three supervised formats including nested conversation JSON", () => {
  const { store } = setup();
  for (const dataset of datasets) {
    store.selectDataset("session-1", dataset.id);
    expect(store.validate("session-1").ready).toBe(true);
    expect(store.validate("session-1").examples[0].messages.at(-1).role).toBe(
      "assistant",
    );
  }
});

test("invalid mappings and malformed or unsupported conversations block training", () => {
  const { store } = setup();
  store.updateDraft("session-1", {
    mapping: { instruction: "output", response: "missing" },
  });
  expect(store.validate("session-1").errors).toContain("invalid_data");
  expect(() => store.startRun("session-1")).toThrow("invalid_data");
  const draft = {
    ...defaultDraft(),
    format: "messages",
    mapping: { messages: "messages" },
  };
  for (const value of [
    "{broken",
    JSON.stringify([{ role: "user", content: "hello" }]),
    JSON.stringify([{ role: "tool", content: "hello" }]),
  ]) {
    expect(() =>
      prepareExamples({ rows: [{ messages: value }] }, draft),
    ).toThrow();
  }
});

test.each([0, -1, 1.5, NaN])(
  "invalid integer batch %s blocks the run",
  (batch) => {
    const { store } = setup();
    const state = store.getSnapshot();
    const draft = {
      ...defaultDraft(),
      parameters: { ...defaultDraft().parameters, batch },
    };
    expect(validateDraft(draft, state).errors).toContain("parameters");
  },
);

test("an accepted run freezes data, config, exact example revision and split indices", () => {
  const { store } = setup();
  const id = store.startRun("session-1");
  const snapshot = JSON.stringify(
    store.getSnapshot().runs.find((r) => r.id === id).snapshot,
  );
  store.selectDataset("session-1", 103);
  store.updateDraft("session-1", {
    parameters: { ...defaultDraft().parameters, learningRate: 0.004 },
  });
  store.getSnapshot().datasets[0].rows[0].instruction = "Changed source";
  expect(
    JSON.stringify(store.getSnapshot().runs.find((r) => r.id === id).snapshot),
  ).toBe(snapshot);
  const run = store.getSnapshot().runs.find((r) => r.id === id);
  expect(run.snapshot.draft.parameters.epochs).toBeUndefined();
  expect(
    new Set([...run.snapshot.splits.train, ...run.snapshot.splits.evaluation])
      .size,
  ).toBe(32);
});

test("epochs mode does not retain an active step limit", () => {
  const { store } = setup();
  store.updateDraft("session-1", { durationMode: "epochs" });
  const id = store.startRun("session-1");
  expect(
    store.getSnapshot().runs.find((r) => r.id === id).snapshot.draft.parameters
      .steps,
  ).toBeUndefined();
});

test("large step settings keep chart data bounded", () => {
  const { store, advance } = setup();
  store.updateDraft("session-1", {
    parameters: { ...defaultDraft().parameters, steps: 1000000 },
  });
  store.startRun("session-1");
  advance(40000);
  expect(store.getSnapshot().runs[0].metrics).toHaveLength(200);
  expect(store.getSnapshot().runs[0].metrics.at(-1).step).toBe(1000000);
  expect(store.getSnapshot().runs[0].metrics.at(-1).train).toBeLessThan(1.8);
});

test("successful run publishes one adapter only after saving finishes", () => {
  const { store, advance } = setup();
  const id = store.startRun("session-1");
  expect(store.getSnapshot().runs[0].queueStatus).toBe("not_started");
  advance(38000);
  expect(store.getSnapshot().runs[0].phase).toBe("saving");
  expect(
    store.getSnapshot().adaptedModels.filter((a) => a.runId === id),
  ).toHaveLength(0);
  advance(2000);
  advance(1000);
  expect(store.getSnapshot().runs[0].status).toBe("FINISHED");
  expect(
    store.getSnapshot().adaptedModels.filter((a) => a.runId === id),
  ).toHaveLength(1);
  store.cancelRun(id);
  expect(store.getSnapshot().runs[0].status).toBe("FINISHED");
});

test.each(["incomplete_download", "oom", "interrupted"])(
  "%s never publishes a partial adapter",
  (scenario) => {
    const { store, advance } = setup();
    store.updateDraft("session-1", { scenario });
    const id = store.startRun("session-1");
    advance(21000);
    const run = store.getSnapshot().runs[0];
    expect(run.status).toBe("ERROR");
    expect(run.error).toBe(scenario);
    expect(run.queueStatus).toBe(
      scenario === "interrupted" ? "killed" : "error",
    );
    const failureTime = {
      incomplete_download: 0.2,
      oom: 0.42,
      interrupted: 0.5,
    }[scenario];
    expect(run.progress).toBe(failureTime);
    expect(run.updatedAt - run.startedAt).toBe(40000 * failureTime);
    expect(run.phase).toBe(
      scenario === "incomplete_download" ? "downloading" : "training",
    );
    expect(run.step === 0).toBe(scenario === "incomplete_download");
    expect(run.metrics.length === 0).toBe(scenario === "incomplete_download");
    expect(store.getSnapshot().adaptedModels.some((a) => a.runId === id)).toBe(
      false,
    );
    advance(120000);
    expect(store.getSnapshot().runs[0]).toEqual(run);
  },
);

test.each([0, 12000])(
  "cancellation at %s ms is terminal and preserves other results",
  (time) => {
    const { store, advance } = setup();
    const id = store.startRun("session-1");
    advance(time);
    store.cancelRun(id);
    advance(45000);
    expect(store.getSnapshot().runs[0].terminationReason).toBe("cancelled");
    expect(store.getSnapshot().runs[0].queueStatus).toBe("cancelled");
    expect(store.getSnapshot().adaptedModels).toHaveLength(2);
  },
);

test("double start cannot enqueue duplicate active runs", () => {
  const { store } = setup();
  store.startRun("session-1");
  expect(() => store.startRun("session-1")).toThrow("queue_busy");
});

test("clearing the global queue preserves run history and adapters", () => {
  const { store } = setup();
  const id = store.startRun("session-1");
  expect(store.clearJobs()).toBe(1);
  expect(
    store.getSnapshot().runs.find((r) => r.id === id).terminationReason,
  ).toBe("cancelled");
  expect(store.getSnapshot().adaptedModels).toHaveLength(2);
  expect(store.jobs().every((j) => j.status === "deleted")).toBe(true);
});

test("published-but-missing artifact changes availability, not training history", () => {
  const { store } = setup();
  store.setAdapterAvailability("adapter-1", "missing");
  expect(store.getSnapshot().runs.find((r) => r.id === "run-1").status).toBe(
    "FINISHED",
  );
  expect(() => store.openChat("adapter-1")).toThrow("missing_adapter");
});

test("chat snapshots retain adapter and parameters after switching within the same component", () => {
  const { store, advance } = setup();
  const id = store.openChat("adapter-1");
  store.sendMessage(id, "password");
  store.updateChat(id, {
    adapterId: "adapter-2",
    parameters: { temperature: 0.2, maxTokens: 99, topP: 0.7 },
  });
  advance(1500);
  let chat = store.getSnapshot().chats[0];
  expect(chat.messages[0].snapshot.adapterId).toBe("adapter-1");
  expect(chat.messages[0].snapshot.parameters.temperature).toBe(0.7);
  expect(chat.messages[0].status).toBe("finished");
  store.sendMessage(id, "another question");
  chat = store.getSnapshot().chats[0];
  expect(chat.messages[1].snapshot.adapterId).toBe("adapter-2");
});

test("a missing adapter while a message is pending produces an error, not a base-only answer", () => {
  const { store, advance } = setup();
  const id = store.openChat("adapter-1");
  store.sendMessage(id, "hello");
  store.setAdapterAvailability("adapter-1", "missing");
  advance(1500);
  expect(store.getSnapshot().chats[0].messages[0].status).toBe("error");
});

test("reload preserves pending runs, drafts, datasets and chat history", () => {
  const { store, storage, now, advance } = setup();
  const runId = store.startRun("session-1");
  const id = store.openChat("adapter-1");
  store.sendMessage(id, "hello");
  advance(10000);
  const restored = createDemoStore({ storage, now });
  expect(restored.getSnapshot().runs[0].id).toBe(runId);
  expect(restored.getSnapshot().chats[0].messages).toHaveLength(1);
});

test("reset touches only the namespaced demo storage", () => {
  const { store, storage } = setup();
  storage.setItem("real-data", "keep");
  store.createSession("New session");
  store.reset();
  expect(store.getSnapshot().sessions).toHaveLength(1);
  expect(storage.getItem("real-data")).toBe("keep");
  expect(JSON.parse(storage.getItem(DEMO_STORAGE_KEY)).version).toBe(1);
});

test("corrupt or unavailable browser storage does not prevent demo use", () => {
  const storage = {
    getItem: () => "{broken",
    setItem: () => {
      throw new Error("Quota");
    },
  };
  const store = createDemoStore({ storage });
  store.createSession("Memory only");
  expect(store.getSnapshot().sessions).toHaveLength(2);
  expect(store.getSnapshot().storageError).toBe(true);
});

test("rename and example import persist without discarding a session draft", () => {
  const { store } = setup();
  store.updateDraft("session-1", { method: "lora" });
  store.renameSession("session-1", "Updated");
  const id = store.importExample("messages");
  store.selectDataset("session-1", id);
  const session = store.getSnapshot().sessions[0];
  expect(session.name).toBe("Updated");
  expect(session.draft.method).toBe("lora");
  expect(store.validate(session.id).ready).toBe(true);
});
