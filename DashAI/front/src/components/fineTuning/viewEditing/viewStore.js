import { useSyncExternalStore } from "react";

/**
 * View customisation for presentations: lets the presenter hide blocks of the
 * fine-tuning prototypes (both A and B) without changing any data.
 *
 * - `level` is a preset: "essential" | "intermediate" | "full" (default).
 *   Each `Hideable` declares the minimum level at which it is shown.
 * - `overrides` are per-block manual choices (id -> true shown / false hidden)
 *   that win over the level.
 * - `editMode` is in-memory only: a reload always leaves edit mode, so the
 *   audience never sees the edit affordances by accident.
 * Persisted in localStorage; failures are ignored (the view just resets).
 */

export const VIEW_LEVELS = ["essential", "intermediate", "full"];
const STORAGE_KEY = "dashai:ft-proto:view:v1";

const rank = (level) => {
  const index = VIEW_LEVELS.indexOf(level);
  return index === -1 ? VIEW_LEVELS.length - 1 : index;
};

function load() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      level: VIEW_LEVELS.includes(parsed.level) ? parsed.level : "full",
      overrides:
        parsed.overrides && typeof parsed.overrides === "object"
          ? parsed.overrides
          : {},
    };
  } catch {
    return null;
  }
}

let state = {
  level: "full",
  overrides: {},
  editMode: false,
  ...(typeof window !== "undefined" ? load() : null),
};
// Blocks currently mounted on screen: id -> { label, level }.
let registry = {};
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

function persist() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ level: state.level, overrides: state.overrides }),
    );
  } catch {
    // Storage unavailable: keep working in memory.
  }
}

function setState(patch, { save = true } = {}) {
  state = { ...state, ...patch };
  if (save) persist();
  emit();
}

export const viewStore = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getState: () => state,
  getRegistry: () => registry,
  isVisible(id, level = "full") {
    const override = state.overrides[id];
    if (typeof override === "boolean") return override;
    return rank(state.level) >= rank(level);
  },
  setEditMode(editMode) {
    setState({ editMode: Boolean(editMode) }, { save: false });
  },
  toggleEditMode() {
    setState({ editMode: !state.editMode }, { save: false });
  },
  setVisible(id, visible, level = "full") {
    const overrides = { ...state.overrides };
    const levelDefault = rank(state.level) >= rank(level);
    // Store only deviations from the current level, so presets stay clean.
    if (visible === levelDefault) delete overrides[id];
    else overrides[id] = visible;
    setState({ overrides });
  },
  /** Applying a preset clears manual overrides. */
  setLevel(level) {
    if (!VIEW_LEVELS.includes(level)) return;
    setState({ level, overrides: {} });
  },
  showAll() {
    setState({ level: "full", overrides: {} });
  },
  register(id, meta) {
    registry = { ...registry, [id]: meta };
    emit();
    return () => {
      const next = { ...registry };
      delete next[id];
      registry = next;
      emit();
    };
  },
};

export function useViewState() {
  return useSyncExternalStore(viewStore.subscribe, viewStore.getState);
}

export function useViewRegistry() {
  return useSyncExternalStore(viewStore.subscribe, viewStore.getRegistry);
}
