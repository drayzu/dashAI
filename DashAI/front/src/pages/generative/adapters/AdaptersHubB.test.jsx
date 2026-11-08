import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { SnackbarProvider } from "notistack";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import getTheme from "../../../styles/theme";
import { createFineTuningStore } from "../../../components/fineTuning/data/store";
import AdaptersHubB, { parseAdaptersRoute } from "./AdaptersHubB";

// ChatBubble pulls react-markdown (ESM), which CRA jest does not transform.
jest.mock("../../../components/generative/ChatBubble", () => ({
  ChatBubble: ({ messages, sender }) => (
    <div data-testid="bubble">
      {sender}
      {(messages || []).map((m) => m.data).join("")}
    </div>
  ),
}));

const T0 = Date.UTC(2026, 9, 14, 12, 0, 0);
const k = (key) => new RegExp(`^(fineTuning:)?${key.split(".").join("\\.")}$`);

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">{location.pathname + location.search}</div>
  );
}

function renderAt(path, store, mode = "dark") {
  return render(
    <ThemeProvider theme={createTheme(getTheme(mode))}>
      <SnackbarProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path="/app/generative/adapters/*"
              element={
                <AdaptersHubB store={store} hardwareMonitoring={false} />
              }
            />
            <Route path="*" element={<div>other</div>} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </SnackbarProvider>
    </ThemeProvider>,
  );
}

function makeStore() {
  return createFineTuningStore({
    storage: null,
    now: () => T0,
    autoTick: false,
    prototype: "B",
  });
}

describe("AdaptersHubB", () => {
  it("parses its routes", () => {
    expect(parseAdaptersRoute("/app/generative/adapters")).toEqual({
      view: "registry",
      chatId: null,
      adapterId: null,
    });
    expect(parseAdaptersRoute("/app/generative/adapters/chat")).toEqual({
      view: "chat",
      chatId: null,
      adapterId: null,
    });
    expect(
      parseAdaptersRoute("/app/generative/adapters/chat/chat-9").chatId,
    ).toBe("chat-9");
    expect(
      parseAdaptersRoute("/app/generative/adapters/compare/adapter-4"),
    ).toEqual({
      view: "compare",
      chatId: null,
      adapterId: "adapter-4",
    });
  });

  it("lists the adapters trained in Models and shows the provenance summary of a row", () => {
    const store = makeStore();
    const adapters = store.getSnapshot().adapters;
    expect(adapters.length).toBeGreaterThan(0);
    renderAt("/app/generative/adapters", store, "light");
    expect(
      screen.getAllByText(k("shellB.adapters.trainedInLink")).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(k("shellB.adapters.summaryEmpty")),
    ).toBeInTheDocument();
    // Selecting an adapter from the left list fills the right panel.
    fireEvent.click(screen.getAllByText(adapters[0].name)[0]);
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/app/generative/adapters",
    );
  });

  it("opens a chat with an adapter and shows the generation parameters", () => {
    const store = makeStore();
    const adapter = store
      .getSnapshot()
      .adapters.find((a) => a.availability === "ready");
    const chatId = store.openChat({ kind: "adapter", id: adapter.id });
    renderAt(`/app/generative/adapters/chat/${chatId}`, store);
    expect(screen.getAllByText(adapter.name).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("slider").length).toBeGreaterThan(0);
  });

  it("renders the base vs adapted comparison", () => {
    const store = makeStore();
    const adapter = store
      .getSnapshot()
      .adapters.find((a) => a.availability === "ready");
    renderAt(`/app/generative/adapters/compare/${adapter.id}`, store);
    expect(
      screen.getAllByText(k("shellB.crumbs.compare")).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(adapter.name).length).toBeGreaterThan(0);
  });
});
