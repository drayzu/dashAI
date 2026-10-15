import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SnackbarProvider } from "notistack";
import { FineTuningProvider } from "../FineTuningContext";
import { createFineTuningStore } from "../data/store";
import AdaptersRegistry from "../adapters/AdaptersRegistry";
import AdapterProvenanceDialog from "../adapters/AdapterProvenanceDialog";
import AdapterChat from "./AdapterChat";
import GenerationParamsPanel from "./GenerationParamsPanel";
import ComparePanel from "./ComparePanel";
import { buildComparisonCsv, blindSides } from "./compareCsv";
import { modelRefStatus } from "./modelAvailability";

// ChatBubble pulls react-markdown (ESM), which CRA jest does not transform.
jest.mock("../../generative/ChatBubble", () => ({
  ChatBubble: ({ messages, sender, isWaiting }) => (
    <div data-testid="bubble">
      {sender}
      {isWaiting ? "…" : (messages || []).map((m) => m.data).join("")}
    </div>
  ),
}));

const T0 = Date.UTC(2026, 9, 14, 12);
const t = (key) => key;

function setup(ui, store) {
  return render(
    <MemoryRouter>
      <SnackbarProvider>
        <FineTuningProvider
          store={store}
          prototype="A"
          hardwareMonitoring={false}
        >
          {ui}
        </FineTuningProvider>
      </SnackbarProvider>
    </MemoryRouter>,
  );
}

function makeStore() {
  let now = T0;
  const store = createFineTuningStore({
    storage: null,
    now: () => now,
    autoTick: false,
  });
  return {
    store,
    advance: (ms) => {
      now += ms;
      store.tick();
    },
  };
}

describe("fine-tuning inference UI", () => {
  it("lists seeded adapters and opens provenance", () => {
    const { store } = makeStore();
    const adapters = store.getSnapshot().adapters;
    expect(adapters.length).toBeGreaterThan(0);
    setup(<AdaptersRegistry />, store);
    expect(screen.getAllByRole("row").length).toBe(adapters.length + 1);
    setup(
      <AdapterProvenanceDialog
        adapterId={adapters[0].id}
        open
        onClose={() => {}}
      />,
      store,
    );
    expect(
      screen.getAllByText(adapters[0].manifestHash).length,
    ).toBeGreaterThan(0);
  });

  it("chat sends a message with a frozen snapshot and reports a missing adapter without fallback", () => {
    const { store, advance } = makeStore();
    const adapter = store.getSnapshot().adapters[0];
    const chatId = store.openChat({ kind: "adapter", id: adapter.id });
    setup(
      <>
        <AdapterChat chatId={chatId} />
        <GenerationParamsPanel chatId={chatId} />
      </>,
      store,
    );
    const input = screen.getByRole("textbox", {
      name: "fineTuning:chat.inputAria",
    });
    fireEvent.change(input, { target: { value: "No puedo subir mi CSV" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(
      store.getSnapshot().chats.find((c) => c.id === chatId).messages,
    ).toHaveLength(2);
    act(() => advance(5000));
    const msgs = store
      .getSnapshot()
      .chats.find((c) => c.id === chatId).messages;
    expect(msgs[1].status).toBe("done");
    expect(msgs[1].snapshot.modelName).toBeTruthy();
    expect(screen.getAllByTestId("message-snapshot").length).toBe(1);

    act(() => store.setAdapterAvailability(adapter.id, "missing"));
    expect(
      modelRefStatus(store.getSnapshot(), { kind: "adapter", id: adapter.id })
        .usable,
    ).toBe(false);
    expect(
      screen.getByRole("textbox", { name: "fineTuning:chat.inputAria" }),
    ).toBeDisabled();
  });

  it("comparison resolves 12 items, supports blind mode and CSV export", () => {
    const { store, advance } = makeStore();
    const adapter = store
      .getSnapshot()
      .adapters.find((a) => a.availability === "ready");
    const id = store.createComparison(adapter.id, {});
    setup(<ComparePanel adapterId={adapter.id} comparisonId={id} />, store);
    for (let i = 0; i < 40; i += 1) act(() => advance(1000));
    const comparison = store.getSnapshot().comparisons.find((c) => c.id === id);
    expect(comparison.items).toHaveLength(12);
    expect(
      comparison.items.every((it) => it.base !== null && it.adapted !== null),
    ).toBe(true);
    act(() => store.setComparisonBlind(id, true));
    expect(
      screen.getAllByText("fineTuning:compare.columns.answerA").length,
    ).toBeGreaterThan(0);
    const csv = buildComparisonCsv(
      store.getSnapshot().comparisons.find((c) => c.id === id),
      t,
    );
    expect(csv.split("\r\n")).toHaveLength(13);
    expect(["base", "adapted"]).toContain(blindSides(comparison, 0)[0]);
  });
});
