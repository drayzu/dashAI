import { useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import {
  prototypeVisible,
  useActivePrototype,
} from "../../../utils/demoPrototype";
import { getPrototypeStore } from "../data/instances";

/**
 * Prototype E's trained adapters as items for DashAI's real model pickers
 * (ComponentSelector), grouped under "Mis modelos adaptados". The adapters
 * are simulated and live only in the browser, so the backend never sees
 * them: a picker that offers them must handle the selection itself.
 */
export const ADAPTER_PREFIX = "ft-proto-adapter:";

const noopSubscribe = () => () => {};
const noSnapshot = () => null;

/** True when a picker item is one of the prototype's adapters. */
export const isPrototypeAdapter = (item) =>
  Boolean(item?.name?.startsWith(ADAPTER_PREFIX));

/**
 * @param {string} categoryKey - Item field the picker groups by.
 * @returns {Array<object>} Available adapters, empty when prototype E is off.
 */
export default function usePrototypeAdapterItems(categoryKey) {
  const { t } = useTranslation(["generative"]);
  const enabled = prototypeVisible(useActivePrototype(), "E");
  const store = enabled ? getPrototypeStore("E") : null;
  const state = useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    store ? store.getSnapshot : noSnapshot,
  );

  return useMemo(() => {
    if (!state) return [];
    const baseName = (id) =>
      state.checkpoints.find((ck) => ck.id === id)?.name || id;
    return state.adapters
      .filter((a) => a.availability !== "missing")
      .map((a) => ({
        name: `${ADAPTER_PREFIX}${a.id}`,
        adapterId: a.id,
        display_name: a.name,
        description: t("generative:adaptedModels.description", {
          base: baseName(a.checkpointId),
          method: String(a.method || "").toUpperCase(),
        }),
        baseName: baseName(a.checkpointId),
        [categoryKey]: t("generative:adaptedModels.group"),
      }));
  }, [state, categoryKey, t]);
}
