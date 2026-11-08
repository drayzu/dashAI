import React, { useState } from "react";
import fs from "fs";
import path from "path";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import getTheme from "../../../styles/theme";
import i18n from "../../../utils/i18n";
import { FineTuningProvider } from "../FineTuningContext";
import { createFineTuningStore } from "../data/store";
import { getSampleDataset, sampleDatasetRef } from "../data/sampleDatasets";
import DataStep from "../steps/DataStep";
import { buildDatasetPatch, useDataPreparation } from "./useDataPreparation";

jest.mock("../../../api/datasets", () => ({
  getDatasetSample: jest.fn(() => Promise.reject(new Error("offline"))),
}));

const T0 = Date.UTC(2026, 9, 14, 12);

// The merged fineTuning namespace is produced by the integration step; load
// the part files directly when they are available.
function loadParts() {
  const dir = path.resolve(
    __dirname,
    "../../../../../../.claude/ft-proto/i18n",
  );
  ["core.json", "ui-data.json"].forEach((file) => {
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) return;
    const part = JSON.parse(fs.readFileSync(full, "utf8"));
    Object.entries(part).forEach(([lng, res]) => {
      i18n.addResourceBundle(lng, "fineTuning", res, true, false);
    });
  });
}

beforeAll(async () => {
  loadParts();
  await i18n.changeLanguage("es");
});

function makeStore() {
  return createFineTuningStore({
    storage: null,
    now: () => T0,
    autoTick: false,
  });
}

describe("useDataPreparation (store-free)", () => {
  function useHarness(initial) {
    const [dataPrep, setPrep] = useState(initial);
    const prep = useDataPreparation({
      dataPrep,
      onChange: (patch) => setPrep((prev) => ({ ...prev, ...patch })),
    });
    return { prep, dataPrep };
  }

  it("selects a sample dataset, detects Alpaca and becomes ready", async () => {
    const { result } = renderHook(() => useHarness({ dataset: null }));
    expect(result.current.prep.blockingIssues).toEqual(["no_dataset"]);
    const ds = getSampleDataset("fichas-soporte");
    await act(async () => {
      await result.current.prep.selectDataset(sampleDatasetRef(ds));
    });
    await waitFor(() =>
      expect(result.current.prep.datasetState.status).toBe("ready"),
    );
    const { prep } = result.current;
    expect(prep.format).toBe("alpaca");
    expect(prep.autoConfirmed).toBe(true);
    expect(prep.blockingIssues).toEqual([]);
    expect(prep.ready).toBe(true);
    expect(prep.renderedExamples).toHaveLength(2);
    expect(prep.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(prep.splitCounts.train + prep.splitCounts.eval).toBe(ds.rows.length);
  });

  it("requires confirmation for medium-confidence formats", async () => {
    const ds = getSampleDataset("qa-pares");
    const initial = buildDatasetPatch(
      sampleDatasetRef(ds),
      ds.columns,
      ds.rows,
    );
    const { result } = renderHook(() => useHarness(initial));
    await waitFor(() =>
      expect(result.current.prep.datasetState.status).toBe("ready"),
    );
    expect(result.current.prep.blockingIssues).toContain(
      "format_not_confirmed",
    );
  });

  it("blocks text-only datasets as out of scope", async () => {
    const ds = getSampleDataset("solo-texto");
    const initial = buildDatasetPatch(
      sampleDatasetRef(ds),
      ds.columns,
      ds.rows,
    );
    const { result } = renderHook(() => useHarness(initial));
    await waitFor(() =>
      expect(result.current.prep.datasetState.status).toBe("ready"),
    );
    expect(result.current.prep.textOnly).toBe(true);
    expect(result.current.prep.blockingIssues).toContain("format_text_only");
  });

  it("reports blocking validation issues", async () => {
    const ds = getSampleDataset("instrucciones-con-errores");
    const initial = buildDatasetPatch(
      sampleDatasetRef(ds),
      ds.columns,
      ds.rows,
    );
    const { result } = renderHook(() => useHarness(initial));
    await waitFor(() => expect(result.current.prep.validation).not.toBeNull());
    expect(result.current.prep.blockingIssues).toContain("data_invalid");
  });

  it("falls back to stored rows when a DashAI dataset cannot be read", async () => {
    const ds = getSampleDataset("fichas-soporte");
    const dataset = {
      source: "dashai",
      id: 7,
      name: "real",
      totalRows: 300,
      columns: ds.columns,
    };
    const initial = {
      ...buildDatasetPatch(dataset, ds.columns, ds.rows.slice(0, 10)),
    };
    const { result } = renderHook(() => {
      const [dataPrep, setPrep] = useState(initial);
      return useDataPreparation({
        dataPrep,
        onChange: (patch) => setPrep((prev) => ({ ...prev, ...patch })),
        fallbackRows: ds.rows.slice(0, 10),
      });
    });
    await waitFor(() =>
      expect(result.current.datasetState.status).toBe("ready"),
    );
    expect(result.current.datasetState.offline).toBe(true);
    expect(result.current.datasetState.sampled).toBe(true);
    expect(result.current.datasetState.totalRows).toBe(300);
  });
});

describe("DataStep", () => {
  it.each(["dark", "light"])(
    "renders the seeded session with validation, splits and SFT preview (%s)",
    async (mode) => {
      const store = makeStore();
      const session = store.getSnapshot().sessions[0];
      render(
        <ThemeProvider theme={createTheme(getTheme(mode))}>
          <MemoryRouter>
            <FineTuningProvider
              store={store}
              prototype="A"
              hardwareMonitoring={false}
            >
              <DataStep session={session} />
            </FineTuningProvider>
          </MemoryRouter>
        </ThemeProvider>,
      );
      expect(
        await screen.findAllByText(/Aporta a la pérdida/),
      ).not.toHaveLength(0);
      expect(screen.getAllByText(/Sin pérdida/).length).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole("button", { name: /Ver dataset/ }));
      expect(await screen.findByText(/Mostrando 10 de/)).toBeInTheDocument();
    },
  );

  it("shows an empty state without a session", () => {
    render(
      <MemoryRouter>
        <FineTuningProvider
          store={makeStore()}
          prototype="A"
          hardwareMonitoring={false}
        >
          <DataStep session={null} />
        </FineTuningProvider>
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: /Ver dataset/ })).toBeNull();
  });
});
