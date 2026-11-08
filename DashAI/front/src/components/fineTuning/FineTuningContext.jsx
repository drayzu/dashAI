// React binding of the fine-tuning prototype store (SPEC §3.3).
// <FineTuningProvider store routes prototype> + hooks. Shared components get
// routes from here and never hard-code paths.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { getPrototypeStore } from "./data/instances";
import {
  HardwareProfileContext,
  useHardwareProfileSource,
} from "./hooks/useHardwareProfile";

const FineTuningContext = createContext(null);

function withReturn(path, returnPath) {
  const params = new URLSearchParams({ returnTo: "fine-tuning", returnPath });
  return `${path}?${params.toString()}`;
}

/** Default routes of prototype A (SPEC §5). */
export function buildRoutesA(base = "/app/generative/fine-tuning") {
  return {
    home: () => base,
    session: (sessionId) => `${base}/sessions/${sessionId}`,
    configure: (sessionId, step = "model") =>
      `${base}/sessions/${sessionId}/configure/${step}`,
    run: (sessionId, runId) => `${base}/sessions/${sessionId}/runs/${runId}`,
    history: (sessionId) => `${base}/sessions/${sessionId}/history`,
    adapters: () => `${base}/adapters`,
    adapter: (adapterId) => `${base}/adapters/${adapterId}`,
    chat: (chatId) => (chatId ? `${base}/chat/${chatId}` : `${base}/chat`),
    compare: (adapterId, comparisonId) =>
      comparisonId
        ? `${base}/compare/${adapterId}?comparison=${comparisonId}`
        : `${base}/compare/${adapterId}`,
    uploadDataset: (sessionId) =>
      withReturn(
        "/app/data/new",
        `${base}/sessions/${sessionId}/configure/data`,
      ),
  };
}

/** Default routes of prototype B (SPEC-B "Routes"). */
export function buildRoutesB(
  base = "/app/models/fine-tuning",
  generativeBase = "/app/generative/adapters",
) {
  return {
    home: () => `${base}/new`,
    session: (sessionId) => `${base}/${sessionId}`,
    configure: (sessionId, step = "model") =>
      `${base}/${sessionId}?config=${step}`,
    run: (sessionId, runId) => `${base}/${sessionId}/run/${runId}`,
    history: (sessionId) => `${base}/${sessionId}`,
    adapters: () => generativeBase,
    adapter: (adapterId) => `${generativeBase}?adapter=${adapterId}`,
    chat: (chatId) =>
      chatId ? `${generativeBase}/chat/${chatId}` : `${generativeBase}/chat`,
    compare: (adapterId, comparisonId) =>
      comparisonId
        ? `${generativeBase}/compare/${adapterId}?comparison=${comparisonId}`
        : `${generativeBase}/compare/${adapterId}`,
    uploadDataset: () => withReturn("/app/data/new", `${base}/new`),
  };
}

export function defaultRoutes(prototype = "A") {
  return prototype === "B" ? buildRoutesB() : buildRoutesA();
}

/**
 * @param {object} props
 * @param {object} [props.store] store from getPrototypeStore (defaults to the
 *   prototype's singleton)
 * @param {object} [props.routes] routes contract (SPEC §3.3)
 * @param {"A"|"B"} [props.prototype]
 * @param {boolean} [props.hardwareMonitoring] open DashAI's hardware monitor
 *   (default: true outside tests)
 */
export function FineTuningProvider({
  store,
  routes,
  prototype = "A",
  hardwareMonitoring,
  children,
}) {
  const resolvedStore = useMemo(
    () => store || getPrototypeStore(prototype),
    [store, prototype],
  );
  const resolvedRoutes = useMemo(
    () => routes || defaultRoutes(prototype),
    [routes, prototype],
  );
  const hardware = useHardwareProfileSource(
    hardwareMonitoring === undefined
      ? undefined
      : { enabled: Boolean(hardwareMonitoring) },
  );

  useEffect(() => {
    resolvedStore.setHardwareProfile(hardware.profile);
  }, [resolvedStore, hardware.profile]);

  const value = useMemo(
    () => ({ store: resolvedStore, routes: resolvedRoutes, prototype }),
    [resolvedStore, resolvedRoutes, prototype],
  );

  return (
    <FineTuningContext.Provider value={value}>
      <HardwareProfileContext.Provider value={hardware}>
        {children}
      </HardwareProfileContext.Provider>
    </FineTuningContext.Provider>
  );
}

function useFineTuningContextValue() {
  const ctx = useContext(FineTuningContext);
  // Outside a provider (isolated renders) fall back to prototype A.
  return ctx || { store: getPrototypeStore("A"), routes: null, prototype: "A" };
}

/** Shallow equality for selector results (arrays and plain objects). */
export function shallowEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  )
    return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1)
      if (!Object.is(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(
    (k) => Object.prototype.hasOwnProperty.call(b, k) && Object.is(a[k], b[k]),
  );
}

const identity = (s) => s;

/**
 * Subscribes to the store. `selector(state)` result is memoized: the
 * component re-renders only when the selection changes (shallow equality by
 * default), so selectors may return new arrays/objects.
 */
export function useFineTuningStore(
  selector = identity,
  isEqual = shallowEqual,
) {
  const { store } = useFineTuningContextValue();
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const cacheRef = useRef({
    has: false,
    state: undefined,
    selector: undefined,
    value: undefined,
  });
  const getSelection = useCallback(() => {
    const state = store.getSnapshot();
    const cache = cacheRef.current;
    const currentSelector = selectorRef.current;
    if (
      cache.has &&
      cache.state === state &&
      cache.selector === currentSelector
    )
      return cache.value;
    const next = currentSelector(state);
    if (cache.has && isEqual(cache.value, next)) {
      cacheRef.current = {
        has: true,
        state,
        selector: currentSelector,
        value: cache.value,
      };
      return cache.value;
    }
    cacheRef.current = {
      has: true,
      state,
      selector: currentSelector,
      value: next,
    };
    return next;
  }, [store, isEqual]);
  return useSyncExternalStore(store.subscribe, getSelection, getSelection);
}

/** The store object (all actions: startRun, cancelRun, sendMessage, …). */
export function useFineTuningActions() {
  return useFineTuningContextValue().store;
}

/** Routes contract (SPEC §3.3); defaults to the prototype's routes. */
export function useFineTuningRoutes() {
  const { routes, prototype } = useFineTuningContextValue();
  return useMemo(() => routes || defaultRoutes(prototype), [routes, prototype]);
}

/** "A" | "B" */
export function usePrototype() {
  return useFineTuningContextValue().prototype;
}

/**
 * Current time that refreshes every `intervalMs` while `enabled` (for
 * relative times and elapsed counters). Uses the store clock.
 */
export function useNow(intervalMs = 1000, enabled = true) {
  const store = useFineTuningActions();
  const [value, setValue] = useState(() => store.now());
  useEffect(() => {
    if (!enabled) return undefined;
    setValue(store.now());
    const id = setInterval(() => setValue(store.now()), intervalMs);
    return () => clearInterval(id);
  }, [store, intervalMs, enabled]);
  return value;
}

export default FineTuningContext;
