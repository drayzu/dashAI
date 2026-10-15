import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import {
  useFineTuningActions,
  useFineTuningRoutes,
} from "../FineTuningContext";
import { blockerLabel } from "../data/labels";
import RunConfirmDialog from "./RunConfirmDialog";

const errorCode = (e) =>
  (e && (e.code || (e.codes && e.codes[0]) || e.message)) || "unknown";
const REQUEST_REUSE_MS = 1500;

/**
 * Run actions shared by RunDetail (A and B), history cards and shells.
 * Returns handlers plus a `dialogs` element that must be rendered once.
 * @param {object|null} run
 * @param {{ onDeleted?: (run) => void, onProvenance?: (adapter) => void }} [opts]
 */
export default function useRunActions(run, opts = {}) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const store = useFineTuningActions();
  const routes = useFineTuningRoutes();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, setConfirm] = useState(null);
  const requestRef = useRef({ key: null, id: null, at: 0 });
  const { onDeleted, onProvenance } = opts;

  // Same requestId for repeated clicks within a short window (idempotent start, R52).
  const requestIdFor = useCallback((key) => {
    const now = Date.now();
    const current = requestRef.current;
    if (current.key === key && now - current.at < REQUEST_REUSE_MS)
      return current.id;
    const id = `${key}-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    requestRef.current = { key, id, at: now };
    return id;
  }, []);

  const notifyError = useCallback(
    (code) => enqueueSnackbar(blockerLabel(code, t), { variant: "error" }),
    [enqueueSnackbar, t],
  );

  const doCancel = useCallback(() => {
    if (!run) return;
    const code = store.cancelRun(run.id);
    if (code && code !== "run_not_active") notifyError(code);
    else if (!code)
      enqueueSnackbar(t("fineTuning:runs.messages.cancelled"), {
        variant: "info",
      });
  }, [run, store, notifyError, enqueueSnackbar, t]);

  const doNewFromConfig = useCallback(() => {
    if (!run) return;
    try {
      const sessionId = store.cloneRunToDraft(run.id);
      enqueueSnackbar(t("fineTuning:runs.messages.draftReplaced"), {
        variant: "success",
      });
      navigate(routes.configure(sessionId, "review"));
    } catch (e) {
      notifyError(errorCode(e));
    }
  }, [run, store, routes, navigate, enqueueSnackbar, notifyError, t]);

  /** B: train a not-started config, or retrain (clone + queue) a terminal run. */
  const train = useCallback(() => {
    if (!run) return null;
    try {
      const newId = store.trainRun(run.id, {
        requestId: requestIdFor(`train-${run.id}`),
      });
      enqueueSnackbar(t("fineTuning:runs.messages.queued"), {
        variant: "success",
      });
      if (newId && newId !== run.id) navigate(routes.run(run.sessionId, newId));
      return newId;
    } catch (e) {
      notifyError(errorCode(e));
      return null;
    }
  }, [
    run,
    store,
    routes,
    navigate,
    enqueueSnackbar,
    notifyError,
    requestIdFor,
    t,
  ]);

  const doDelete = useCallback(() => {
    if (!run) return;
    const code = store.deleteRun(run.id);
    if (code) {
      notifyError(code);
      return;
    }
    enqueueSnackbar(t("fineTuning:runs.messages.deleted"), {
      variant: "success",
    });
    if (onDeleted) onDeleted(run);
    else navigate(routes.session(run.sessionId));
  }, [
    run,
    store,
    routes,
    navigate,
    enqueueSnackbar,
    notifyError,
    onDeleted,
    t,
  ]);

  const openChat = useCallback(
    (adapter) => {
      const id = adapter ? adapter.id : run && run.adapterId;
      if (!id) return;
      try {
        const chatId = store.openChat({ kind: "adapter", id });
        navigate(routes.chat(chatId));
      } catch (e) {
        notifyError(errorCode(e));
      }
    },
    [run, store, routes, navigate, notifyError],
  );

  const compare = useCallback(
    (adapter) => {
      const id = adapter ? adapter.id : run && run.adapterId;
      if (id) navigate(routes.compare(id));
    },
    [run, routes, navigate],
  );

  const provenance = useCallback(
    (adapter) => {
      const target =
        adapter || (run && run.adapterId ? { id: run.adapterId } : null);
      if (!target) return;
      if (onProvenance) onProvenance(target);
      else navigate(routes.adapter(target.id));
    },
    [run, routes, navigate, onProvenance],
  );

  const ask = (kind) => () => setConfirm(kind);
  const close = () => setConfirm(null);
  const runConfirmed = () => {
    const kind = confirm;
    setConfirm(null);
    if (kind === "cancel") doCancel();
    else if (kind === "newFromConfig") doNewFromConfig();
    else if (kind === "delete") doDelete();
  };

  const confirmProps = {
    cancel: {
      title: t("fineTuning:runs.confirm.cancelTitle"),
      content: t("fineTuning:runs.confirm.cancelBody", {
        name: run ? run.name : "",
      }),
      confirmLabel: t("fineTuning:runs.actions.cancel"),
      confirmColor: "warning",
    },
    newFromConfig: {
      title: t("fineTuning:runs.confirm.newTitle"),
      content: t("fineTuning:runs.confirm.newBody", {
        name: run ? run.name : "",
      }),
      confirmLabel: t("fineTuning:runs.confirm.newConfirm"),
      confirmColor: "primary",
    },
    delete: {
      title: t("fineTuning:runs.confirm.deleteTitle"),
      content: t(
        run && run.adapterId
          ? "fineTuning:runs.confirm.deleteBodyAdapter"
          : "fineTuning:runs.confirm.deleteBody",
        { name: run ? run.name : "" },
      ),
      confirmLabel: t("common:delete"),
      confirmColor: "error",
    },
  };

  const dialogs = (
    <RunConfirmDialog
      open={Boolean(confirm)}
      onClose={close}
      onConfirm={runConfirmed}
      {...(confirmProps[confirm] || confirmProps.cancel)}
    />
  );

  return {
    askCancel: ask("cancel"),
    askNewFromConfig: ask("newFromConfig"),
    askDelete: ask("delete"),
    train,
    openChat,
    compare,
    provenance,
    dialogs,
  };
}
