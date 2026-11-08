import { act, fireEvent, render, screen } from "@testing-library/react";
import Hideable from "./Hideable";
import ViewEditingLayer from "./ViewEditingLayer";
import { viewStore } from "./viewStore";

const STORAGE_KEY = "dashai:ft-proto:view:v1";

function Blocks({ onParentClick }) {
  return (
    <div onClick={onParentClick} role="presentation">
      <Hideable id="t.essential" label="Essential block" level="essential">
        <p>essential content</p>
      </Hideable>
      <Hideable
        id="t.intermediate"
        label="Intermediate block"
        level="intermediate"
      >
        <p>intermediate content</p>
      </Hideable>
      <Hideable id="t.full" label="Full block" level="full">
        <p>full content</p>
      </Hideable>
    </div>
  );
}

const shown = (text) => screen.queryByText(text) !== null;

beforeEach(() => {
  window.localStorage.clear();
  act(() => {
    viewStore.showAll();
    viewStore.setEditMode(false);
  });
});

describe("viewStore", () => {
  it("shows blocks according to the level preset", () => {
    expect(viewStore.getState().level).toBe("full");
    expect(viewStore.isVisible("x", "essential")).toBe(true);
    expect(viewStore.isVisible("x", "intermediate")).toBe(true);
    expect(viewStore.isVisible("x", "full")).toBe(true);

    viewStore.setLevel("intermediate");
    expect(viewStore.isVisible("x", "essential")).toBe(true);
    expect(viewStore.isVisible("x", "intermediate")).toBe(true);
    expect(viewStore.isVisible("x", "full")).toBe(false);

    viewStore.setLevel("essential");
    expect(viewStore.isVisible("x", "essential")).toBe(true);
    expect(viewStore.isVisible("x", "intermediate")).toBe(false);
    expect(viewStore.isVisible("x", "full")).toBe(false);

    viewStore.setLevel("bogus");
    expect(viewStore.getState().level).toBe("essential");
  });

  it("keeps only deviations as overrides, persists them and clears them on presets", () => {
    viewStore.setVisible("a", false, "essential");
    expect(viewStore.isVisible("a", "essential")).toBe(false);
    expect(viewStore.getState().overrides).toEqual({ a: false });

    // Same as the level default: no override stored.
    viewStore.setVisible("a", true, "essential");
    expect(viewStore.getState().overrides).toEqual({});

    viewStore.setLevel("essential");
    viewStore.setVisible("b", true, "full");
    expect(viewStore.isVisible("b", "full")).toBe(true);
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(saved).toEqual({ level: "essential", overrides: { b: true } });

    viewStore.setLevel("intermediate");
    expect(viewStore.getState().overrides).toEqual({});
    expect(viewStore.isVisible("b", "full")).toBe(false);

    viewStore.showAll();
    expect(viewStore.getState().level).toBe("full");
  });

  it("never persists edit mode", () => {
    viewStore.toggleEditMode();
    expect(viewStore.getState().editMode).toBe(true);
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    expect(saved.editMode).toBeUndefined();
    viewStore.toggleEditMode();
    expect(viewStore.getState().editMode).toBe(false);
  });
});

describe("Hideable", () => {
  it("renders only the blocks of the current level, without wrappers", () => {
    const { container } = render(<Blocks />);
    expect(shown("essential content")).toBe(true);
    expect(shown("intermediate content")).toBe(true);
    expect(shown("full content")).toBe(true);
    // Outside edit mode the children are rendered as-is (no extra node).
    expect(container.firstChild.children).toHaveLength(3);

    act(() => viewStore.setLevel("intermediate"));
    expect(shown("full content")).toBe(false);
    expect(shown("intermediate content")).toBe(true);

    act(() => viewStore.setLevel("essential"));
    expect(shown("intermediate content")).toBe(false);
    expect(shown("essential content")).toBe(true);
    expect(container.firstChild.children).toHaveLength(1);
  });

  it("applies manual overrides over the level", () => {
    render(<Blocks />);
    act(() => viewStore.setVisible("t.essential", false, "essential"));
    expect(shown("essential content")).toBe(false);

    act(() => viewStore.setLevel("essential"));
    expect(shown("essential content")).toBe(true);
    act(() => viewStore.setVisible("t.full", true, "full"));
    expect(shown("full content")).toBe(true);
    expect(shown("intermediate content")).toBe(false);
  });

  it("shows hidden blocks dimmed with an eye toggle in edit mode", () => {
    const onParentClick = jest.fn();
    render(<Blocks onParentClick={onParentClick} />);
    act(() => {
      viewStore.setLevel("essential");
      viewStore.setEditMode(true);
    });

    // Every block is on screen, hidden ones marked as such.
    expect(shown("full content")).toBe(true);
    expect(shown("intermediate content")).toBe(true);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getAllByText(/hiddenChip/)).toHaveLength(2);
    expect(
      screen.getByText("full content").closest("[aria-hidden]"),
    ).toHaveAttribute("aria-hidden", "true");

    // Toggle "full" back on; the click does not reach the parent card.
    const [, , fullToggle] = screen.getAllByRole("button");
    fireEvent.click(fullToggle);
    expect(onParentClick).not.toHaveBeenCalled();
    expect(viewStore.isVisible("t.full", "full")).toBe(true);
    expect(screen.getAllByText(/hiddenChip/)).toHaveLength(1);

    // Hide "essential" and leave edit mode: it leaves no trace.
    const [essentialToggle] = screen.getAllByRole("button");
    fireEvent.click(essentialToggle);
    act(() => viewStore.setEditMode(false));
    expect(shown("essential content")).toBe(false);
    expect(shown("intermediate content")).toBe(false);
    expect(shown("full content")).toBe(true);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("registers mounted blocks and unregisters them on unmount", () => {
    const { unmount } = render(<Blocks />);
    expect(Object.keys(viewStore.getRegistry())).toEqual(
      expect.arrayContaining(["t.essential", "t.intermediate", "t.full"]),
    );
    expect(viewStore.getRegistry()["t.full"]).toEqual({
      label: "Full block",
      level: "full",
    });
    unmount();
    expect(viewStore.getRegistry()["t.full"]).toBeUndefined();
  });
});

describe("ViewEditingLayer", () => {
  const shortcut = (target = window, extra = {}) =>
    fireEvent.keyDown(target, {
      key: "E",
      ctrlKey: true,
      shiftKey: true,
      ...extra,
    });

  it("toggles edit mode with Ctrl+Shift+E (and Cmd+Shift+E)", () => {
    render(
      <>
        <ViewEditingLayer />
        <Blocks />
      </>,
    );
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();

    act(() => {
      shortcut();
    });
    expect(viewStore.getState().editMode).toBe(true);
    expect(screen.getByRole("toolbar")).toBeInTheDocument();

    act(() => {
      shortcut(window, { ctrlKey: false, metaKey: true });
    });
    expect(viewStore.getState().editMode).toBe(false);
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();

    // Plain Ctrl+E does nothing.
    act(() => {
      shortcut(window, { shiftKey: false });
    });
    expect(viewStore.getState().editMode).toBe(false);
  });

  it("ignores the shortcut while typing in a field", () => {
    render(
      <>
        <ViewEditingLayer />
        <input aria-label="field" />
      </>,
    );
    act(() => {
      shortcut(screen.getByLabelText("field"));
    });
    expect(viewStore.getState().editMode).toBe(false);
  });

  it("lists hidden blocks, restores them and applies presets", () => {
    render(
      <>
        <ViewEditingLayer />
        <Blocks />
      </>,
    );
    act(() => {
      viewStore.setLevel("essential");
      viewStore.setEditMode(true);
    });
    const toolbar = screen.getByRole("toolbar");
    expect(toolbar).toHaveTextContent("Intermediate block");
    expect(toolbar).toHaveTextContent("Full block");

    // Restore one block from its chip.
    fireEvent.click(screen.getByText("Full block"));
    expect(viewStore.isVisible("t.full", "full")).toBe(true);
    expect(toolbar).not.toHaveTextContent("Full block");

    // Presets clear manual overrides.
    fireEvent.click(screen.getByRole("button", { name: /levels.full./ }));
    expect(viewStore.getState()).toMatchObject({
      level: "full",
      overrides: {},
    });
    expect(toolbar).toHaveTextContent(/noneHidden/);

    // "Listo" leaves edit mode.
    fireEvent.click(screen.getByRole("button", { name: /viewEditing.done/ }));
    expect(viewStore.getState().editMode).toBe(false);
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
  });
});
