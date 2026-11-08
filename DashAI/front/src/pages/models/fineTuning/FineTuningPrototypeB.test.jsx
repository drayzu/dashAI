import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { SnackbarProvider } from "notistack";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import getTheme from "../../../styles/theme";
import { createFineTuningStore } from "../../../components/fineTuning/data/store";
import FineTuningPrototypeB, { parseRouteB } from "./FineTuningPrototypeB";
import { activeFineTuningSessionId } from "../../../components/fineTuning/integration/useFineTuningModelsGroups";
import {
  buildFineTuningTaskOption,
  fromFineTuningItemId,
  isFineTuningItemId,
  toFineTuningItemId,
} from "../../../components/fineTuning/integration/entryPoints";
import i18n from "../../../utils/i18n";

jest.mock("react-plotly.js", () => () => <div data-testid="plot" />);
jest.mock("../../../components/shared/PlotActions", () => () => null);

const T0 = Date.UTC(2026, 9, 14, 12, 0, 0);

// Resolve the real (English) translation so the assertions follow the merged
// locales/en/fineTuning.json; {{vars}} match any text.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const k = (key) => {
  const raw = i18n.getResource("en", "fineTuning", key);
  if (typeof raw !== "string") throw new Error(`missing i18n key ${key}`);
  const pattern = raw
    .split(/\{\{\w+\}\}/)
    .map(escapeRe)
    .join(".+");
  return new RegExp(`^${pattern}$`);
};

beforeAll(() => i18n.changeLanguage("en"));

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">{location.pathname + location.search}</div>
  );
}

function renderAt(path, { mode = "dark", store } = {}) {
  const s =
    store ||
    createFineTuningStore({
      storage: null,
      now: () => T0,
      autoTick: false,
      prototype: "B",
    });
  const utils = render(
    <ThemeProvider theme={createTheme(getTheme(mode))}>
      <SnackbarProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path="/app/models/fine-tuning/*"
              element={
                <FineTuningPrototypeB store={s} hardwareMonitoring={false} />
              }
            />
            <Route path="*" element={<div>other</div>} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </SnackbarProvider>
    </ThemeProvider>,
  );
  return { store: s, ...utils };
}

describe("prototype B routing helpers", () => {
  it("parses the Models-side routes", () => {
    expect(parseRouteB("/app/models/fine-tuning")).toEqual({
      view: "index",
      sessionId: null,
      runId: null,
    });
    expect(parseRouteB("/app/models/fine-tuning/new").view).toBe("new");
    expect(parseRouteB("/app/models/fine-tuning/session-1")).toEqual({
      view: "session",
      sessionId: "session-1",
      runId: null,
    });
    expect(parseRouteB("/app/models/fine-tuning/session-1/run/run-3")).toEqual({
      view: "run",
      sessionId: "session-1",
      runId: "run-3",
    });
    expect(parseRouteB("/app/models/sessions/3").view).toBe("unknown");
  });

  it("maps left-bar ids without touching numeric backend ids", () => {
    expect(toFineTuningItemId("session-1")).toBe("ft-B-session-1");
    expect(isFineTuningItemId("ft-B-session-1")).toBe(true);
    expect(isFineTuningItemId(12)).toBe(false);
    expect(fromFineTuningItemId("ft-B-session-1")).toBe("session-1");
    expect(
      activeFineTuningSessionId("/app/models/fine-tuning/session-1/run/run-2"),
    ).toBe("session-1");
    expect(activeFineTuningSessionId("/app/models/fine-tuning/new")).toBeNull();
    const option = buildFineTuningTaskOption((k) => k);
    expect(option.name).toBe("llm_fine_tuning_prototype");
    expect(option.dataTour).toBeUndefined();
  });
});

describe("FineTuningPrototypeB", () => {
  it("renders the create form with creation disabled until the data is ready", () => {
    renderAt("/app/models/fine-tuning/new", { mode: "light" });
    expect(screen.getByText(k("shellB.create.title"))).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: k("shellB.create.submit") }),
    ).toBeDisabled();
    expect(screen.getByText(k("shellB.preview.title"))).toBeInTheDocument();
    // Fallback left bar lists the seeded B session.
    expect(screen.getAllByText("Asistente de soporte").length).toBeGreaterThan(
      0,
    );
  });

  it("redirects the index route to the latest session", () => {
    const { store } = renderAt("/app/models/fine-tuning");
    const sessionId = store.getSnapshot().sessions[0].id;
    expect(screen.getByTestId("location")).toHaveTextContent(
      `/app/models/fine-tuning/${sessionId}`,
    );
  });

  it("shows the session cards, comparison and trains a not-started configuration", () => {
    const store = createFineTuningStore({
      storage: null,
      now: () => T0,
      autoTick: false,
      prototype: "B",
    });
    const state = store.getSnapshot();
    const session = state.sessions[0];
    const config = state.runs.find((r) => r.status === 0);
    expect(config).toBeTruthy();
    renderAt(`/app/models/fine-tuning/${session.id}`, { store });

    expect(
      screen.getByRole("heading", { level: 1, name: session.name }),
    ).toBeInTheDocument();
    const cards = screen.getAllByRole("button", {
      name: k("shellB.card.open"),
    });
    expect(cards).toHaveLength(
      state.runs.filter((r) => r.sessionId === session.id).length,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();

    const configCard = cards.find((c) => within(c).queryByText(config.name));
    fireEvent.click(
      within(configCard).getByRole("button", { name: k("shellB.card.train") }),
    );
    // Queued (1) and, with the simulated GPU free, possibly already started (2).
    expect([1, 2]).toContain(
      store.getSnapshot().runs.find((r) => r.id === config.id).status,
    );
  });

  it("opens the run configuration dialog from the base models panel and creates a configuration", () => {
    const { store } = renderAt("/app/models/fine-tuning/session-1");
    const session = store.getSnapshot().sessions[0];
    expect(session.id).toBe("session-1");
    const before = store.getSnapshot().runs.length;
    fireEvent.click(
      screen.getAllByRole("button", {
        name: k("shellB.baseModels.rowAria"),
      })[0],
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(k("shellB.dialog.title")),
    ).toBeInTheDocument();
    // Modelo y método → Parámetros → Revisión → Crear configuración
    act(() => {
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: /^(common:next|next|siguiente)$/i,
        }),
      );
    });
    act(() => {
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: /^(common:next|next|siguiente)$/i,
        }),
      );
    });
    const create = within(dialog).getByRole("button", {
      name: k("shellB.dialog.create"),
    });
    expect(create).toBeEnabled();
    act(() => {
      fireEvent.click(create);
    });
    const after = store.getSnapshot().runs;
    expect(after).toHaveLength(before + 1);
    expect(after[after.length - 1].status).toBe(0);
  });

  it("renders a run detail with the five result tabs", () => {
    const store = createFineTuningStore({
      storage: null,
      now: () => T0,
      autoTick: false,
      prototype: "B",
    });
    const run = store.getSnapshot().runs.find((r) => r.status === 3);
    renderAt(`/app/models/fine-tuning/${run.sessionId}/run/${run.id}`, {
      store,
      mode: "light",
    });
    expect(screen.getAllByText(run.name).length).toBeGreaterThan(0);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);
    fireEvent.click(tabs[4]);
    expect(screen.getByTestId("location")).toHaveTextContent("tab=provenance");
    expect(screen.getByText(k("shellB.runInfo.title"))).toBeInTheDocument();
  });

  it("shows a not-found state for unknown sessions", () => {
    renderAt("/app/models/fine-tuning/nope");
    expect(
      screen.getAllByText(k("shellB.session.notFound")).length,
    ).toBeGreaterThan(0);
  });
});
