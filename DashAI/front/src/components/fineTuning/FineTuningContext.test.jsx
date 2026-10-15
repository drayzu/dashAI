import React from "react";
import { act, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../utils/i18n";
import {
  FineTuningProvider,
  useFineTuningActions,
  useFineTuningRoutes,
  useFineTuningStore,
  usePrototype,
} from "./FineTuningContext";
import {
  hardwareProfileFromStats,
  useHardwareProfile,
} from "./hooks/useHardwareProfile";
import { sampleToRows, useDatasetSource } from "./hooks/useDatasetSource";
import { createFineTuningStore } from "./data/store";
import { runsBySession } from "./data/selectors";
import {
  useExternalJobs,
  registerExternalJobsSource,
  unregisterExternalJobsSource,
} from "../../utils/externalJobs";

const T0 = Date.UTC(2026, 9, 14, 12);

function makeStore() {
  return createFineTuningStore({
    storage: null,
    now: () => T0,
    autoTick: false,
  });
}

describe("FineTuningProvider", () => {
  it("exposes store, routes, prototype and memoized selections", () => {
    const store = makeStore();
    const sid = store.getSnapshot().sessions[0].id;
    let renders = 0;
    function Probe() {
      renders += 1;
      const runs = useFineTuningStore((s) => runsBySession(s, sid));
      const routes = useFineTuningRoutes();
      const prototype = usePrototype();
      const actions = useFineTuningActions();
      const { profile } = useHardwareProfile();
      return (
        <div>
          <span data-testid="count">{runs.length}</span>
          <span data-testid="route">{routes.run(sid, runs[0].id)}</span>
          <span data-testid="proto">{prototype}</span>
          <span data-testid="same">{String(actions === store)}</span>
          <span data-testid="gpu">{profile.source}</span>
        </div>
      );
    }
    render(
      <FineTuningProvider
        store={store}
        prototype="B"
        hardwareMonitoring={false}
      >
        <Probe />
      </FineTuningProvider>,
    );
    expect(screen.getByTestId("count")).toHaveTextContent("3");
    expect(screen.getByTestId("proto")).toHaveTextContent("B");
    expect(screen.getByTestId("route")).toHaveTextContent(
      `/app/models/fine-tuning/${sid}/run/`,
    );
    expect(screen.getByTestId("same")).toHaveTextContent("true");
    expect(screen.getByTestId("gpu")).toHaveTextContent("simulated");

    const before = renders;
    // Unrelated change: the selected runs keep their identity → no re-render.
    act(() => {
      store.openChat({ kind: "base", id: "qwen2.5-0.5b-instruct" });
    });
    expect(renders).toBe(before);
    act(() => {
      store.createSession("Otra");
    });
    expect(renders).toBe(before);
  });
});

describe("useExternalJobs", () => {
  afterEach(() => unregisterExternalJobsSource("test-source"));

  it("merges registered sources and updates on change", () => {
    let jobs = [
      {
        id: "x-1",
        job_name: "Uno",
        status: "started",
        last_update: new Date(T0).toISOString(),
      },
    ];
    const listeners = new Set();
    registerExternalJobsSource("test-source", {
      subscribe: (fn) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      getJobs: () => jobs,
    });
    function Widget() {
      const list = useExternalJobs().filter((j) => j.id.startsWith("x-"));
      return (
        <span data-testid="jobs">
          {list.map((j) => `${j.id}:${j.status}:${j.external}`).join(",")}
        </span>
      );
    }
    const { unmount } = render(
      <I18nextProvider i18n={i18n}>
        <Widget />
      </I18nextProvider>,
    );
    expect(screen.getByTestId("jobs")).toHaveTextContent("x-1:started:true");
    act(() => {
      jobs = [{ ...jobs[0], status: "finished" }];
      listeners.forEach((fn) => fn());
    });
    expect(screen.getByTestId("jobs")).toHaveTextContent("x-1:finished:true");
    unmount();
  });
});

describe("hooks/useHardwareProfile", () => {
  it("converts the monitor payload from bytes to GB", () => {
    const stats = {
      ram: { total: 17179869184 },
      gpus: [
        {
          name: "NVIDIA GeForce GTX 1080",
          vendor: "NVIDIA",
          memory_total: 8589934592,
          memory_used: 1073741824,
        },
      ],
    };
    expect(hardwareProfileFromStats(stats)).toMatchObject({
      gpuName: "NVIDIA GeForce GTX 1080",
      vramGb: 8,
      ramGb: 16,
      accelerator: "cuda",
      source: "detected",
    });
    expect(hardwareProfileFromStats({ gpus: [] })).toBeNull();
    expect(hardwareProfileFromStats(null)).toBeNull();
  });
});

describe("hooks/useDatasetSource", () => {
  it("converts DashAI column samples to rows", () => {
    expect(sampleToRows({ a: [1, 2], b: ["x", "y"] })).toEqual({
      columns: ["a", "b"],
      rows: [
        { a: 1, b: "x" },
        { a: 2, b: "y" },
      ],
    });
  });

  it("lists sample datasets without a DashAI provider and loads their rows", async () => {
    let source;
    function Probe() {
      source = useDatasetSource();
      return <span data-testid="n">{source.datasets.length}</span>;
    }
    render(<Probe />);
    expect(screen.getByTestId("n")).toHaveTextContent("5");
    expect(source.backendAvailable).toBe(false);
    expect(source.datasets.every((d) => d.source === "sample")).toBe(true);
    const loaded = await source.loadRows(source.datasets[0].ref);
    expect(loaded).toMatchObject({ totalRows: 48, sampled: false });
    expect(loaded.columns).toEqual(["instruction", "input", "output"]);
  });
});
