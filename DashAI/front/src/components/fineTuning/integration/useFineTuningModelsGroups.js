// Extra group "Ajuste fino de LLM (prototipo)" for the Models left bar
// (SPEC-B "Left panel"). Reads prototype B's store directly (the Models left
// bar also renders outside the fine-tuning provider) and returns items with
// string ids ("ft-B-<sessionId>") plus type-dispatched handlers, so the real
// backend sessions (numeric ids) keep their own handlers untouched.

import {
  prototypeVisible,
  useActivePrototype,
} from "../../../utils/demoPrototype";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";
import { getPrototypeStore } from "../data/instances";
import { datasetName } from "../data/labels";
import {
  FINE_TUNING_B_BASE,
  FINE_TUNING_B_NEW,
  fromFineTuningItemId,
  isFineTuningItemId,
  toFineTuningItemId,
} from "./entryPoints";

const SESSION_PATH = new RegExp(`^${FINE_TUNING_B_BASE}/([^/]+)`);

/** Session id of the prototype B route currently shown, or null. */
export function activeFineTuningSessionId(pathname) {
  const match = SESSION_PATH.exec(pathname || "");
  if (!match || match[1] === "new") return null;
  try {
    return decodeURIComponent(match[1]);
  } catch (e) {
    return match[1];
  }
}

/**
 * @param {object} [options]
 * @param {object} [options.store] prototype B store (defaults to the singleton)
 * @param {string} [options.searchQuery] filters items by name
 * @returns {{
 *   groupName: string,
 *   items: {id: string, sessionId: string, name: string, description: string}[],
 *   allItemsCount: number,
 *   selectedItemId: string|null,
 *   isActive: boolean,
 *   owns: (id) => boolean,
 *   onItemClick: (id) => void,
 *   onItemEdit: (id, name) => void,
 *   onItemDelete: (id) => boolean,
 *   onBulkDelete: (ids) => boolean,
 * }}
 */
export function useFineTuningModelsGroups({
  store: storeProp,
  searchQuery = "",
} = {}) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const activePrototype = useActivePrototype();
  const navigate = useNavigate();
  const location = useLocation();
  const { enqueueSnackbar } = useSnackbar();
  const store = useMemo(() => storeProp || getPrototypeStore("B"), [storeProp]);
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );

  const sessions = state.sessions;
  const runs = state.runs;

  const allItems = useMemo(
    () =>
      [...sessions]
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .map((session) => {
          const count = runs.filter((r) => r.sessionId === session.id).length;
          const ds = session.draft && session.draft.dataset;
          return {
            id: toFineTuningItemId(session.id),
            sessionId: session.id,
            name: session.name,
            description: ds
              ? t("fineTuning:shellB.leftBar.itemDescription", {
                  count,
                  dataset: datasetName(ds, t),
                })
              : t("fineTuning:shellB.leftBar.itemDescriptionNoData", { count }),
          };
        }),
    [sessions, runs, t],
  );

  const items = useMemo(() => {
    const q = String(searchQuery || "")
      .trim()
      .toLowerCase();
    if (!q) return allItems;
    return allItems.filter((item) => item.name.toLowerCase().includes(q));
  }, [allItems, searchQuery]);

  const activeSessionId = activeFineTuningSessionId(location.pathname);
  const isActive = location.pathname.startsWith(FINE_TUNING_B_BASE);
  const selectedItemId = activeSessionId
    ? toFineTuningItemId(activeSessionId)
    : null;

  const onItemClick = useCallback(
    (id) => {
      const sessionId = fromFineTuningItemId(id);
      if (sessionId) navigate(`${FINE_TUNING_B_BASE}/${sessionId}`);
    },
    [navigate],
  );

  const onItemEdit = useCallback(
    (id, name) => {
      const sessionId = fromFineTuningItemId(id);
      if (!sessionId) return;
      const code = store.renameSession(sessionId, name);
      if (code)
        enqueueSnackbar(t("fineTuning:shellB.messages.renameEmpty"), {
          variant: "error",
        });
    },
    [store, enqueueSnackbar, t],
  );

  const deleteOne = useCallback(
    (sessionId) => {
      const code = store.deleteSession(sessionId);
      if (code) {
        enqueueSnackbar(
          t(
            code === "session_has_active_run"
              ? "fineTuning:shellB.messages.deleteActive"
              : "fineTuning:shellB.messages.deleteFailed",
          ),
          { variant: "error" },
        );
        return false;
      }
      return true;
    },
    [store, enqueueSnackbar, t],
  );

  const onItemDelete = useCallback(
    (id) => {
      const sessionId = fromFineTuningItemId(id);
      if (!sessionId) return false;
      const ok = deleteOne(sessionId);
      if (ok) {
        enqueueSnackbar(t("fineTuning:shellB.messages.sessionDeleted"), {
          variant: "success",
        });
        if (sessionId === activeSessionId) navigate(FINE_TUNING_B_NEW);
      }
      return ok;
    },
    [deleteOne, enqueueSnackbar, t, activeSessionId, navigate],
  );

  const onBulkDelete = useCallback(
    (ids) => {
      let ok = true;
      let removedActive = false;
      (ids || []).filter(isFineTuningItemId).forEach((id) => {
        const sessionId = fromFineTuningItemId(id);
        if (deleteOne(sessionId)) {
          if (sessionId === activeSessionId) removedActive = true;
        } else {
          ok = false;
        }
      });
      if (removedActive) navigate(FINE_TUNING_B_NEW);
      return ok;
    },
    [deleteOne, activeSessionId, navigate],
  );

  // Hidden while presenting another prototype (see utils/demoPrototype).
  const visible = prototypeVisible(activePrototype, "B");
  return {
    groupName: t("fineTuning:shellB.leftBar.group"),
    items: visible ? items : [],
    allItemsCount: visible ? allItems.length : 0,
    selectedItemId,
    isActive,
    owns: isFineTuningItemId,
    onItemClick,
    onItemEdit,
    onItemDelete,
    onBulkDelete,
  };
}

export default useFineTuningModelsGroups;
