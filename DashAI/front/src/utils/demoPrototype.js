import { useSyncExternalStore } from "react";

/**
 * Which fine-tuning prototype is being presented. "all" shows every entry
 * point (development); "A" | "B" | "C" | "D" shows only that prototype's
 * cards and links in the real DashAI modules, so a demo never mixes them.
 * Persisted in localStorage; `?proto=a` in any URL also sets it.
 */

export const PROTOTYPES = ["all", "A", "B", "C", "D", "E"];
const STORAGE_KEY = "dashai:ft-proto:active:v1";

function read() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return PROTOTYPES.includes(value) ? value : "all";
  } catch {
    return "all";
  }
}

let active = typeof window !== "undefined" ? read() : "all";
const listeners = new Set();

export function setActivePrototype(value) {
  if (!PROTOTYPES.includes(value) || value === active) return;
  active = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage unavailable: keep it in memory.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useActivePrototype() {
  return useSyncExternalStore(subscribe, () => active);
}

/** True when prototype `id` should show its entry points. */
export function prototypeVisible(current, id) {
  return current === "all" || current === id;
}

/** Applies `?proto=x` from a URL search string, if present. */
export function applyPrototypeFromSearch(search) {
  const value = new URLSearchParams(search).get("proto");
  if (!value) return;
  const normalized =
    value.toLowerCase() === "all" ? "all" : value.toUpperCase();
  setActivePrototype(normalized);
}
