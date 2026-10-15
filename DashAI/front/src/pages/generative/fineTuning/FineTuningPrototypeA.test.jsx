import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { SnackbarProvider } from "notistack";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import getTheme from "../../../styles/theme";
import { createFineTuningStore } from "../../../components/fineTuning/data/store";
import FineTuningPrototypeA from "./FineTuningPrototypeA";
import { parseFineTuningPath } from "./useFineTuningRouteA";
import i18n from "../../../utils/i18n";

jest.mock("react-plotly.js", () => () => <div data-testid="plot" />);
jest.mock("../../../components/shared/PlotActions", () => () => null);
// ChatBubble pulls react-markdown (ESM), which CRA jest does not transform.
jest.mock("../../../components/generative/ChatBubble", () => ({
  ChatBubble: ({ sender }) => <div data-testid="bubble">{sender}</div>,
}));

const T0 = Date.UTC(2026, 9, 14, 12, 0, 0);
const BASE = "/app/generative/fine-tuning";

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

beforeAll(() => {
  if (!global.ResizeObserver) {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!Element.prototype.scrollIntoView)
    Element.prototype.scrollIntoView = () => {};
});

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">{`${location.pathname}${location.search}`}</div>
  );
}

function setup(path, mode = "dark") {
  const store = createFineTuningStore({
    storage: null,
    now: () => T0,
    autoTick: false,
    prototype: "A",
  });
  const utils = render(
    <ThemeProvider theme={createTheme(getTheme(mode))}>
      <SnackbarProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path={`${BASE}/*`}
              element={
                <FineTuningPrototypeA
                  store={store}
                  hardwareMonitoring={false}
                />
              }
            />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </SnackbarProvider>
    </ThemeProvider>,
  );
  return { store, ...utils };
}

const location = () => screen.getByTestId("location").textContent;

describe("parseFineTuningPath", () => {
  it("parses every view", () => {
    expect(parseFineTuningPath(BASE).view).toBe("home");
    expect(parseFineTuningPath(`${BASE}/`).view).toBe("home");
    expect(parseFineTuningPath(`${BASE}/sessions/session-1`)).toMatchObject({
      view: "session",
      sessionId: "session-1",
    });
    expect(
      parseFineTuningPath(`${BASE}/sessions/s/configure/data`, "?datasetId=7"),
    ).toMatchObject({
      view: "configure",
      step: "data",
      datasetId: "7",
    });
    expect(
      parseFineTuningPath(`${BASE}/sessions/s/configure/bogus`).step,
    ).toBeNull();
    expect(parseFineTuningPath(`${BASE}/sessions/s/runs/run-3`)).toMatchObject({
      view: "run",
      runId: "run-3",
    });
    expect(parseFineTuningPath(`${BASE}/sessions/s/history`).view).toBe(
      "history",
    );
    expect(parseFineTuningPath(`${BASE}/adapters/a-1`)).toMatchObject({
      view: "adapters",
      adapterId: "a-1",
    });
    expect(parseFineTuningPath(`${BASE}/chat`)).toMatchObject({
      view: "chat",
      chatId: null,
    });
    expect(
      parseFineTuningPath(`${BASE}/compare/a-1`, "?comparison=c-2"),
    ).toMatchObject({
      view: "compare",
      adapterId: "a-1",
      comparisonId: "c-2",
    });
    expect(parseFineTuningPath(`${BASE}/nope`).view).toBe("notFound");
  });
});

describe("FineTuningPrototypeA", () => {
  it("renders the home at exactly the base path with the seeded session", () => {
    const { store } = setup(BASE);
    const session = store.getSnapshot().sessions[0];
    expect(screen.getAllByText(session.name).length).toBeGreaterThan(0);
    expect(screen.getByText(k("shellA.home.title"))).toBeInTheDocument();
  });

  it("shows a not-found state for an unknown session", () => {
    const { store } = setup(`${BASE}/sessions/session-placeholder`, "light");
    expect(
      screen.getAllByText(k("shellA.session.notFoundTitle")).length,
    ).toBeGreaterThan(0);
    expect(store.getSnapshot().sessions.length).toBeGreaterThan(0);
  });

  it("opens the configure view of the seeded session (light theme)", async () => {
    const store0 = createFineTuningStore({
      storage: null,
      now: () => T0,
      autoTick: false,
      prototype: "A",
    });
    const sid = store0.getSnapshot().sessions[0].id;
    store0.destroy();
    setup(`${BASE}/sessions/${sid}`, "light");
    await waitFor(() =>
      expect(location()).toMatch(
        new RegExp(`/sessions/${sid}/(configure|runs)/`),
      ),
    );
    expect(screen.getAllByRole("tab").length).toBeGreaterThanOrEqual(3);
  });

  it("renders a seeded run and its history", async () => {
    const store0 = createFineTuningStore({
      storage: null,
      now: () => T0,
      autoTick: false,
      prototype: "A",
    });
    const run = store0.getSnapshot().runs.find((r) => r.status === 3);
    store0.destroy();
    setup(`${BASE}/sessions/${run.sessionId}/runs/${run.id}`);
    expect(screen.getAllByText(run.name).length).toBeGreaterThan(0);
    fireEvent.click(
      screen.getByRole("tab", { name: k("shellA.tabs.history") }),
    );
    await waitFor(() =>
      expect(location()).toBe(`${BASE}/sessions/${run.sessionId}/history`),
    );
  });

  it("shows not-found states for unknown run, chat and route", () => {
    const store0 = createFineTuningStore({
      storage: null,
      now: () => T0,
      autoTick: false,
      prototype: "A",
    });
    const sid = store0.getSnapshot().sessions[0].id;
    store0.destroy();
    const { unmount } = setup(`${BASE}/sessions/${sid}/runs/run-999`);
    expect(
      screen.getAllByText(k("shellA.session.runNotFoundTitle")).length,
    ).toBeGreaterThan(0);
    unmount();
    const second = setup(`${BASE}/chat/chat-999`);
    expect(
      screen.getAllByText(k("shellA.views.chatNotFoundTitle")).length,
    ).toBeGreaterThan(0);
    second.unmount();
    setup(`${BASE}/whatever`);
    expect(
      screen.getAllByText(k("shellA.notFound.title")).length,
    ).toBeGreaterThan(0);
  });

  it("renders adapters and compare views", () => {
    const { store, unmount } = setup(`${BASE}/adapters`);
    const adapter = store.getSnapshot().adapters[0];
    expect(screen.getAllByText(adapter.name).length).toBeGreaterThan(0);
    unmount();
    setup(`${BASE}/compare/${adapter.id}`);
    expect(screen.getAllByText(adapter.name).length).toBeGreaterThan(0);
  });

  it("clears ?datasetId= when the dataset cannot be found", async () => {
    const store0 = createFineTuningStore({
      storage: null,
      now: () => T0,
      autoTick: false,
      prototype: "A",
    });
    const sid = store0.getSnapshot().sessions[0].id;
    store0.destroy();
    setup(`${BASE}/sessions/${sid}/configure/data?datasetId=42`);
    await waitFor(() =>
      expect(location()).toBe(`${BASE}/sessions/${sid}/configure/data`),
    );
  });

  it("creates a session from the left bar", async () => {
    const { store } = setup(BASE);
    const before = store.getSnapshot().sessions.length;
    fireEvent.click(
      screen.getAllByRole("button", {
        name: k("shellA.leftBar.newSession"),
      })[0],
    );
    expect(store.getSnapshot().sessions.length).toBe(before + 1);
    await waitFor(() => expect(location()).toMatch(/\/configure\/model$/));
  });
});
