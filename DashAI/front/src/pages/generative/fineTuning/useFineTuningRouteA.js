import { useMemo } from "react";
import { useLocation } from "react-router-dom";

export const FINE_TUNING_BASE_A = "/app/generative/fine-tuning";

export const CONFIG_STEPS = Object.freeze([
  "model",
  "data",
  "parameters",
  "review",
]);

function decode(segment) {
  if (segment === undefined || segment === null || segment === "") return null;
  try {
    return decodeURIComponent(segment);
  } catch (e) {
    return segment;
  }
}

/**
 * Parses a prototype-A path into a view descriptor. Works whether the shell is
 * mounted at exactly the base path or under "base/*" (it never relies on
 * route params).
 *
 * @param {string} pathname
 * @param {string} [search]
 * @param {string} [base]
 * @returns {{view: "home"|"session"|"configure"|"run"|"history"|"adapters"|
 *   "chat"|"compare"|"notFound", sessionId: string|null, step: string|null,
 *   runId: string|null, adapterId: string|null, chatId: string|null,
 *   comparisonId: string|null, datasetId: string|null}}
 */
export function parseFineTuningPath(
  pathname,
  search = "",
  base = FINE_TUNING_BASE_A,
) {
  const params = new URLSearchParams(search || "");
  const result = {
    view: "home",
    sessionId: null,
    step: null,
    runId: null,
    adapterId: null,
    chatId: null,
    comparisonId: params.get("comparison") || null,
    datasetId: params.get("datasetId") || null,
  };
  const path = String(pathname || "");
  const rest = path.startsWith(base) ? path.slice(base.length) : "";
  const parts = rest.split("/").filter(Boolean);
  if (parts.length === 0) return result;

  const [head, a, b, c] = parts;
  switch (head) {
    case "sessions":
      if (!a) return { ...result, view: "home" };
      result.sessionId = decode(a);
      if (!b) return { ...result, view: "session" };
      if (b === "configure") {
        const step = decode(c);
        return {
          ...result,
          view: "configure",
          step: CONFIG_STEPS.includes(step) ? step : null,
        };
      }
      if (b === "runs") return { ...result, view: "run", runId: decode(c) };
      if (b === "history") return { ...result, view: "history" };
      return { ...result, view: "notFound" };
    case "adapters":
      return { ...result, view: "adapters", adapterId: decode(a) };
    case "chat":
      return { ...result, view: "chat", chatId: decode(a) };
    case "compare":
      return { ...result, view: "compare", adapterId: decode(a) };
    default:
      return { ...result, view: "notFound" };
  }
}

/** Current prototype-A view, derived from the URL. */
export function useFineTuningRouteA() {
  const location = useLocation();
  return useMemo(
    () => parseFineTuningPath(location.pathname, location.search),
    [location.pathname, location.search],
  );
}

export default useFineTuningRouteA;
