import { useCallback, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Box, Button, Divider, Typography } from "@mui/material";
import { PlayArrow } from "@mui/icons-material";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import CenterPanel from "../../../components/threeSectionLayout/panels/CenterPanel";
import RightPanel from "../../../components/threeSectionLayout/panels/RightPanel";
import {
  useFineTuningActions,
  useFineTuningRoutes,
  useFineTuningStore,
} from "../../../components/fineTuning/FineTuningContext";
import PrototypeBHeader from "../../../components/fineTuning/integration/PrototypeBHeader";
import EmptyState from "../../../components/fineTuning/common/EmptyState";
import RunComparisonTable, {
  COMPARISON_COLUMNS,
  bestEvalRunId,
} from "../../../components/fineTuning/runs/RunComparisonTable";
import {
  runsBySession,
  sessionById,
} from "../../../components/fineTuning/data/selectors";
import {
  blockerLabel,
  datasetName,
  formatLabel,
} from "../../../components/fineTuning/data/labels";
import RunConfigCard from "./RunConfigCard";
import BaseModelsPanel from "./BaseModelsPanel";
import RunConfigDialog, { CONFIG_STEPS } from "./RunConfigDialog";
import DataPrepDialog from "./DataPrepDialog";
import Hideable from "../../../components/fineTuning/viewEditing/Hideable";

const TRAIN_REUSE_MS = 1500;

/** Session-level header data: run count and the data fingerprint. */
function useSessionFingerprint(session) {
  const store = useFineTuningActions();
  const sessionId = session ? session.id : null;
  // The draft only changes when the session is edited (not on run ticks).
  const draft = session ? session.draft : null;
  return useMemo(() => {
    if (!sessionId || !draft || !draft.dataset) return null;
    try {
      const pf = store.preflight(sessionId, { scope: "config" });
      return pf && pf.prepared ? pf.prepared.fingerprint : null;
    } catch (e) {
      return null;
    }
  }, [store, sessionId, draft]);
}

/** Session not found (deleted or unknown id). */
export function SessionNotFound() {
  const { t } = useTranslation(["fineTuning", "common"]);
  const navigate = useNavigate();
  const routes = useFineTuningRoutes();
  return (
    <CenterPanel>
      <Box sx={{ px: 4, pt: 4 }}>
        <PrototypeBHeader
          crumbs={[
            { label: t("common:models"), path: "/app/models" },
            {
              label: t("fineTuning:shellB.crumbs.fineTuning"),
              path: routes.home(),
            },
            { label: t("fineTuning:shellB.session.notFoundCrumb"), path: null },
          ]}
        />
        <EmptyState
          size="page"
          minHeight="50vh"
          title={t("fineTuning:shellB.session.notFound")}
          description={t("fineTuning:shellB.session.notFoundHelp")}
          action={
            <Button
              variant="outlined"
              size="small"
              onClick={() => navigate(routes.home())}
            >
              {t("fineTuning:shellB.session.newSession")}
            </Button>
          }
        />
      </Box>
    </CenterPanel>
  );
}

/**
 * `/app/models/fine-tuning/:sessionId`: session visualization like Models'
 * SessionVisualization: header (name, "N configuraciones | Dataset …",
 * Entrenar todas, Editar preparación de datos), run configuration cards,
 * "Comparación de configuraciones" table; right panel "Modelos base
 * entrenables" opens RunConfigDialog. `?config=<step>` also opens it.
 */
export default function SessionViewB({ sessionId }) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const store = useFineTuningActions();
  const routes = useFineTuningRoutes();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams, setSearchParams] = useSearchParams();
  const session = useFineTuningStore((s) => sessionById(s, sessionId));
  const runs = useFineTuningStore((s) => runsBySession(s, sessionId, "asc"));
  const fingerprint = useSessionFingerprint(session);
  const [dialog, setDialog] = useState(null); // { checkpointId?, runId?, step? }
  const [dataOpen, setDataOpen] = useState(false);
  const trainRef = useRef({ runId: null, id: null, at: 0 });

  const configParam = searchParams.get("config");
  const urlDialog =
    configParam && CONFIG_STEPS.includes(configParam)
      ? { step: configParam }
      : null;
  const activeDialog = dialog || urlDialog;

  const closeDialog = () => {
    setDialog(null);
    if (configParam) {
      const next = new URLSearchParams(searchParams);
      next.delete("config");
      setSearchParams(next, { replace: true });
    }
  };

  const bestId = useMemo(() => bestEvalRunId(runs), [runs]);
  const notStarted = runs.filter((r) => r.status === 0).length;

  const notifyError = useCallback(
    (e) =>
      enqueueSnackbar(
        blockerLabel((e && (e.code || e.message)) || "unknown", t),
        { variant: "error" },
      ),
    [enqueueSnackbar, t],
  );

  const train = (run) => {
    // Same requestId for repeated clicks on the same card (idempotent).
    const now = Date.now();
    const prev = trainRef.current;
    const reuse = prev.runId === run.id && now - prev.at < TRAIN_REUSE_MS;
    const requestId = reuse ? prev.id : `train-${run.id}-${now.toString(36)}`;
    trainRef.current = {
      runId: run.id,
      id: requestId,
      at: reuse ? prev.at : now,
    };
    try {
      const id = store.trainRun(run.id, { requestId });
      enqueueSnackbar(
        t(
          id !== run.id
            ? "fineTuning:shellB.session.retrainQueued"
            : "fineTuning:shellB.session.trainQueued",
          { name: run.name },
        ),
        { variant: "success" },
      );
    } catch (e) {
      notifyError(e);
    }
  };

  const trainAll = () => {
    const { queued, skipped } = store.trainAll(sessionId);
    if (queued.length > 0) {
      enqueueSnackbar(
        t("fineTuning:shellB.session.trainAllQueued", { count: queued.length }),
        { variant: "success" },
      );
    }
    if (skipped.length > 0) {
      enqueueSnackbar(
        t("fineTuning:shellB.session.trainAllSkipped", {
          count: skipped.length,
          reason: blockerLabel(skipped[0].code, t),
        }),
        { variant: "warning" },
      );
    }
  };

  const remove = (run) => {
    const code = store.deleteRun(run.id);
    if (code) notifyError({ code });
    else
      enqueueSnackbar(
        t("fineTuning:shellB.session.deleted", { name: run.name }),
        { variant: "success" },
      );
  };

  const openRun = (run) => navigate(routes.run(sessionId, run.id));

  if (!session) return <SessionNotFound />;

  const ds = session.draft.dataset;
  const configCount = t("fineTuning:shellB.session.configCount", {
    count: runs.length,
  });
  const dataParts = ds
    ? [
        t("fineTuning:shellB.session.dataset", { name: datasetName(ds, t) }),
        formatLabel(session.draft.format, t),
        fingerprint
          ? t("fineTuning:shellB.session.fingerprint", {
              value: fingerprint.slice(0, 8),
            })
          : null,
      ].filter(Boolean)
    : [t("fineTuning:shellB.session.noDataset")];

  return (
    <>
      <CenterPanel>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "auto",
          }}
        >
          <Box sx={{ px: 4, pt: 4 }}>
            <PrototypeBHeader
              crumbs={[
                { label: t("common:models"), path: "/app/models" },
                {
                  label: t("fineTuning:shellB.crumbs.fineTuning"),
                  path: routes.home(),
                },
                { label: session.name, path: null },
              ]}
            />
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                flexWrap: "wrap",
                gap: 2,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="h5"
                  component="h1"
                  sx={{ fontWeight: 700, mb: 0.5, wordBreak: "break-word" }}
                >
                  {session.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {`${configCount} | ${dataParts.join(" · ")}`}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <Hideable
                  id="b.session.editDataButton"
                  label={t(
                    "fineTuning:viewEditing.sections.bSessionEditDataButton",
                  )}
                  level="essential"
                >
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<EditNoteOutlinedIcon />}
                    onClick={() => setDataOpen(true)}
                  >
                    {t("fineTuning:shellB.session.editData")}
                  </Button>
                </Hideable>
                <Hideable
                  id="b.session.trainAll"
                  label={t("fineTuning:viewEditing.sections.bSessionTrainAll")}
                  level="full"
                >
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PlayArrow />}
                    disabled={notStarted === 0}
                    onClick={trainAll}
                  >
                    {t("fineTuning:shellB.session.trainAll")}
                  </Button>
                </Hideable>
              </Box>
            </Box>
          </Box>

          <Box sx={{ p: 4 }}>
            {runs.length === 0 ? (
              <EmptyState
                icon={PsychologyOutlinedIcon}
                minHeight="40vh"
                size="page"
                title={t("fineTuning:shellB.session.emptyTitle")}
                description={t("fineTuning:shellB.session.emptyDescription")}
              />
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gap: 3,
                  gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                }}
              >
                {runs.map((run) => (
                  <RunConfigCard
                    key={run.id}
                    run={run}
                    best={run.id === bestId}
                    onOpen={openRun}
                    onTrain={train}
                    onEdit={(r) => setDialog({ runId: r.id, step: "model" })}
                    onDelete={remove}
                  />
                ))}
              </Box>
            )}
          </Box>

          <Hideable
            id="b.session.comparisonTable"
            label={t("fineTuning:viewEditing.sections.bSessionComparisonTable")}
            level="intermediate"
          >
            <Divider sx={{ my: 2 }} />

            <Box sx={{ flexShrink: 0, p: 4 }}>
              <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
                {t("fineTuning:shellB.session.comparisonTitle")}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {t("fineTuning:shellB.session.comparisonHelp")}
              </Typography>
              <Box sx={{ overflowX: "auto" }}>
                <RunComparisonTable
                  runs={runs}
                  columns={[...COMPARISON_COLUMNS]}
                  onOpen={openRun}
                  emptyText={t("fineTuning:shellB.session.comparisonEmpty")}
                />
              </Box>
            </Box>
          </Hideable>
        </Box>
      </CenterPanel>
      <RightPanel toggleButtonTop="50%">
        <BaseModelsPanel
          parameters={session.draft.parameters}
          onSelect={(checkpointId) =>
            setDialog({ checkpointId, step: "model" })
          }
        />
      </RightPanel>
      <RunConfigDialog
        open={Boolean(activeDialog)}
        onClose={closeDialog}
        session={session}
        checkpointId={activeDialog ? activeDialog.checkpointId : undefined}
        runId={activeDialog ? activeDialog.runId : undefined}
        initialStep={activeDialog ? activeDialog.step : undefined}
      />
      <DataPrepDialog
        open={dataOpen}
        onClose={() => setDataOpen(false)}
        session={session}
      />
    </>
  );
}

SessionViewB.propTypes = {
  sessionId: PropTypes.string.isRequired,
};
