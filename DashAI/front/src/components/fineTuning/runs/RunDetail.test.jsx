import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SnackbarProvider } from "notistack";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { FineTuningProvider } from "../FineTuningContext";
import { createFineTuningStore } from "../data/store";
import RunDetail from "./RunDetail";
import RunHistory from "./RunHistory";
import RunComparisonTable, { bestEvalRunId } from "./RunComparisonTable";
import getTheme from "../../../styles/theme";

jest.mock("react-plotly.js", () => () => <div data-testid="plot" />);
jest.mock("../../shared/PlotActions", () => () => null);

const T0 = Date.UTC(2026, 9, 14, 12, 0, 0);

function setup(prototype = "A", mode = "dark") {
  const store = createFineTuningStore({
    storage: null,
    now: () => T0,
    autoTick: false,
    prototype,
  });
  const utils = (ui) =>
    render(
      <ThemeProvider theme={createTheme(getTheme(mode))}>
        <SnackbarProvider>
          <MemoryRouter>
            <FineTuningProvider
              store={store}
              prototype={prototype}
              hardwareMonitoring={false}
            >
              {ui}
            </FineTuningProvider>
          </MemoryRouter>
        </SnackbarProvider>
      </ThemeProvider>,
    );
  return { store, renderUi: utils };
}

describe("RunDetail", () => {
  it("renders the stacked variant for every seeded run", () => {
    const { store, renderUi } = setup("A");
    const runs = store.getSnapshot().runs;
    expect(runs.length).toBeGreaterThan(0);
    runs.forEach((run) => {
      const { unmount } = renderUi(<RunDetail runId={run.id} variant="A" />);
      expect(screen.getByText(run.name)).toBeInTheDocument();
      unmount();
    });
  });

  it("renders the tabbed variant and switches tabs", () => {
    const { store, renderUi } = setup("B", "light");
    const run = store.getSnapshot().runs.find((r) => r.status === 3);
    renderUi(<RunDetail runId={run.id} variant="B" />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);
    tabs.forEach((tab) => fireEvent.click(tab));
    expect(screen.getByText(run.name)).toBeInTheDocument();
  });

  it("shows a not-found state for unknown runs", () => {
    const { renderUi } = setup("A");
    renderUi(<RunDetail runId="nope" variant="A" />);
    expect(screen.getByRole("heading", { level: 6 })).toBeInTheDocument();
  });
});

describe("RunHistory", () => {
  it("renders cards and the comparison table with the best eval run marked", () => {
    const { store, renderUi } = setup("A");
    const state = store.getSnapshot();
    const sessionId = state.sessions[0].id;
    renderUi(<RunHistory sessionId={sessionId} />);
    const sessionRuns = state.runs.filter((r) => r.sessionId === sessionId);
    expect(
      screen.getAllByRole("button", { pressed: false }).length,
    ).toBeGreaterThanOrEqual(sessionRuns.length);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(bestEvalRunId(sessionRuns)).not.toBeNull();
    expect(screen.getAllByText(/★/).length).toBeGreaterThan(0);
  });

  it("comparison table shows an empty text without runs", () => {
    const { renderUi } = setup("A");
    renderUi(<RunComparisonTable runs={[]} emptyText="vacío" />);
    expect(screen.getByText("vacío")).toBeInTheDocument();
  });
});
