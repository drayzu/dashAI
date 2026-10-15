import { useCallback, useState } from "react";
import PropTypes from "prop-types";
import { Box, Button, Chip, Divider, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SideBar from "../../../components/threeSectionLayout/panelContainers/SideBar";
import KeyValueList from "../../../components/fineTuning/common/KeyValueList";
import RunStatusChips from "../../../components/fineTuning/common/RunStatusChips";
import RunPreviewPanel from "../../../components/fineTuning/summary/RunPreviewPanel";
import GenerationParamsPanel from "../../../components/fineTuning/inference/GenerationParamsPanel";
import AdapterProvenanceDialog from "../../../components/fineTuning/adapters/AdapterProvenanceDialog";
import { FrozenConfigContent } from "../../../components/fineTuning/runs/FrozenConfigAccordion";
import {
  formatDuration,
  formatGb,
  formatMetric,
  formatRelative,
} from "../../../components/fineTuning/runs/runFormat";
import {
  useFineTuningRoutes,
  useFineTuningStore,
  useNow,
} from "../../../components/fineTuning/FineTuningContext";
import useHardwareProfile from "../../../components/fineTuning/hooks/useHardwareProfile";
import {
  adapterById,
  checkpointById,
  runById,
  runSummary,
  sessionById,
  sessionStats,
} from "../../../components/fineTuning/data/selectors";
import {
  adapterAvailabilityLabel,
  availabilityColor,
  methodLabel,
} from "../../../components/fineTuning/data/labels";
import { formatBytes } from "../../../components/fineTuning/data/catalog";
import Hideable from "../../../components/fineTuning/viewEditing/Hideable";

const NS = "fineTuning:shellA.right";

function PanelHeader({ title, action = null }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        p: 4,
        height: 64,
        boxSizing: "border-box",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        borderBottom: `1px solid ${
          theme.palette.ui ? theme.palette.ui.border : theme.palette.divider
        }`,
      }}
    >
      <Typography variant="h6" component="h2" color="text.primary" noWrap>
        {title}
      </Typography>
      {action}
    </Box>
  );
}

PanelHeader.propTypes = {
  title: PropTypes.node.isRequired,
  action: PropTypes.node,
};

function PanelBody({ children = null }) {
  return (
    <Box
      sx={{
        flex: 1,
        overflowY: "auto",
        pt: 4,
        px: 4,
        pb: 10,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {children}
    </Box>
  );
}

PanelBody.propTypes = { children: PropTypes.node };

function PanelEmpty({ text }) {
  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 4,
      }}
    >
      <Typography variant="body2" color="text.secondary" textAlign="center">
        {text}
      </Typography>
    </Box>
  );
}

PanelEmpty.propTypes = { text: PropTypes.node.isRequired };

/** Compact adapter summary + provenance dialog (adapters, compare, run). */
function AdapterSummary({ adapterId = null, showOpen = false }) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const navigate = useNavigate();
  const routes = useFineTuningRoutes();
  const [open, setOpen] = useState(false);
  const adapter = useFineTuningStore((s) => adapterById(s, adapterId));
  const checkpoint = useFineTuningStore((s) =>
    adapter ? checkpointById(s, adapter.checkpointId) : null,
  );
  const run = useFineTuningStore((s) =>
    adapter ? runById(s, adapter.runId) : null,
  );

  if (!adapter) return <PanelEmpty text={t(`${NS}.adapterMissing`)} />;
  const metrics = adapter.metrics || {};

  return (
    <>
      <Box>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, wordBreak: "break-word" }}
        >
          {adapter.name}
        </Typography>
        <Chip
          size="small"
          variant="outlined"
          color={availabilityColor(adapter.availability)}
          label={adapterAvailabilityLabel(adapter.availability, t)}
          sx={{ mt: 1 }}
        />
      </Box>
      <KeyValueList
        dense
        rows={[
          {
            label: t(`${NS}.fields.baseModel`),
            value: checkpoint ? checkpoint.name : adapter.checkpointId,
          },
          {
            label: t(`${NS}.fields.method`),
            value: methodLabel(adapter.method, t),
          },
          {
            label: t(`${NS}.fields.size`),
            value: formatBytes(adapter.sizeBytes),
          },
          {
            label: t(`${NS}.fields.finalLoss`),
            value: formatMetric(metrics.finalLoss),
            mono: true,
          },
          {
            label: t(`${NS}.fields.finalEvalLoss`),
            value: formatMetric(metrics.finalEvalLoss),
            mono: true,
          },
          { label: t(`${NS}.fields.sourceRun`), value: run ? run.name : null },
        ]}
      />
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Hideable
          id="shared.provenance.openButton"
          label={t("fineTuning:viewEditing.sections.provenanceOpenButton")}
          level="intermediate"
        >
          <Button
            size="small"
            variant="outlined"
            startIcon={<ReceiptLongIcon fontSize="small" />}
            onClick={() => setOpen(true)}
          >
            {t(`${NS}.provenance`)}
          </Button>
        </Hideable>
        {showOpen && (
          <Button
            size="small"
            variant="text"
            onClick={() => navigate(routes.adapter(adapter.id))}
          >
            {t(`${NS}.openAdapter`)}
          </Button>
        )}
      </Box>
      <AdapterProvenanceDialog
        adapterId={adapter.id}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

AdapterSummary.propTypes = {
  adapterId: PropTypes.string,
  showOpen: PropTypes.bool,
};

function RunInfo({ runId = null }) {
  const { t, i18n } = useTranslation(["fineTuning", "common"]);
  const run = useFineTuningStore((s) => runById(s, runId));
  const active = Boolean(run && (run.status === 1 || run.status === 2));
  const now = useNow(1000, active);

  if (!run) return <PanelEmpty text={t(`${NS}.runEmpty`)} />;
  const summary = runSummary(run) || {};
  const elapsedMs = run.startedAt ? (run.endedAt || now) - run.startedAt : null;

  return (
    <PanelBody>
      <Box aria-live="polite">
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, mb: 1, wordBreak: "break-word" }}
        >
          {run.name}
        </Typography>
        <RunStatusChips run={run} size="small" />
      </Box>
      <KeyValueList
        dense
        rows={[
          {
            label: t(`${NS}.fields.created`),
            value: formatRelative(run.createdAt, now, i18n.language),
          },
          {
            label: t(`${NS}.fields.elapsed`),
            value: elapsedMs !== null ? formatDuration(elapsedMs) : null,
          },
          {
            label: t(`${NS}.fields.steps`),
            value: run.totalSteps
              ? `${run.step || 0} / ${run.totalSteps}`
              : null,
          },
          {
            label: t(`${NS}.fields.finalLoss`),
            value: formatMetric(summary.finalLoss),
            mono: true,
          },
          {
            label: t(`${NS}.fields.peakVram`),
            value: summary.peakVramGb ? formatGb(summary.peakVramGb) : null,
          },
        ]}
      />
      <Hideable
        id="shared.run.frozenConfig"
        label={t("fineTuning:viewEditing.sections.runFrozenConfig")}
        level="full"
        sx={{ display: "flex", flexDirection: "column", gap: 4 }}
      >
        <Divider />
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ letterSpacing: 1, lineHeight: 1.5 }}
        >
          {t(`${NS}.frozenConfig`)}
        </Typography>
        <FrozenConfigContent run={run} showJsonToggle={false} />
      </Hideable>
      {run.adapterId && (
        <>
          <Divider />
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ letterSpacing: 1, lineHeight: 1.5 }}
          >
            {t(`${NS}.adapterTitle`)}
          </Typography>
          <AdapterSummary adapterId={run.adapterId} showOpen />
        </>
      )}
    </PanelBody>
  );
}

RunInfo.propTypes = { runId: PropTypes.string };

function SessionSummary({ sessionId = null }) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const session = useFineTuningStore((s) => sessionById(s, sessionId));
  const stats = useFineTuningStore((s) =>
    session ? sessionStats(s, sessionId) : null,
  );
  const bestRunName = useFineTuningStore((s) => {
    const st = stats && stats.bestRunId ? runById(s, stats.bestRunId) : null;
    return st ? st.name : null;
  });
  const lastSummary = stats && stats.lastRun ? runSummary(stats.lastRun) : null;

  if (!session || !stats) return <PanelEmpty text={t(`${NS}.sessionEmpty`)} />;
  return (
    <PanelBody>
      <Typography
        variant="body2"
        sx={{ fontWeight: 600, wordBreak: "break-word" }}
      >
        {session.name}
      </Typography>
      <KeyValueList
        dense
        rows={[
          { label: t(`${NS}.fields.runs`), value: String(stats.runCount) },
          {
            label: t(`${NS}.fields.finished`),
            value: String(stats.finishedCount),
          },
          { label: t(`${NS}.fields.failed`), value: String(stats.errorCount) },
          { label: t(`${NS}.fields.active`), value: String(stats.activeCount) },
          {
            label: t(`${NS}.fields.adapters`),
            value: String(stats.adapterCount),
          },
          {
            label: t(`${NS}.fields.bestEval`),
            value:
              stats.bestEvalLoss !== null
                ? `${formatMetric(stats.bestEvalLoss)} ★`
                : null,
            hint: bestRunName,
            mono: true,
          },
          {
            label: t(`${NS}.fields.lastDuration`),
            value:
              lastSummary && lastSummary.durationSec !== null
                ? formatDuration(lastSummary.durationSec * 1000)
                : null,
          },
        ]}
      />
      <Hideable
        id="a.right.historyHint"
        label={t("fineTuning:viewEditing.sections.aRightHistoryHint")}
        level="full"
      >
        <Typography variant="caption" color="text.secondary">
          {t(`${NS}.historyHint`)}
        </Typography>
      </Hideable>
    </PanelBody>
  );
}

SessionSummary.propTypes = { sessionId: PropTypes.string };

function ModuleSummary() {
  const { t } = useTranslation(["fineTuning", "common"]);
  const { profile } = useHardwareProfile() || {};
  const counts = useFineTuningStore((s) => ({
    sessions: s.sessions.length,
    runs: s.runs.filter((r) => r.status !== 0).length,
    active: s.runs.filter((r) => r.status === 1 || r.status === 2).length,
    adapters: s.adapters.length,
    checkpoints: s.checkpoints.filter((c) => c.availability === "ready").length,
  }));
  return (
    <PanelBody>
      <KeyValueList
        dense
        title={t(`${NS}.moduleGroup`)}
        rows={[
          { label: t(`${NS}.fields.sessions`), value: String(counts.sessions) },
          { label: t(`${NS}.fields.runs`), value: String(counts.runs) },
          { label: t(`${NS}.fields.active`), value: String(counts.active) },
          { label: t(`${NS}.fields.adapters`), value: String(counts.adapters) },
          {
            label: t(`${NS}.fields.readyCheckpoints`),
            value: String(counts.checkpoints),
          },
        ]}
      />
      {profile && (
        <Hideable
          id="a.right.moduleHardware"
          label={t("fineTuning:viewEditing.sections.aRightModuleHardware")}
          level="intermediate"
        >
          <KeyValueList
            dense
            title={t(`${NS}.hardwareGroup`)}
            rows={[
              {
                label: t(`${NS}.fields.gpu`),
                value: profile.gpuName,
                hint: t(
                  `${NS}.hardwareSource.${
                    profile.source === "detected" ? "detected" : "simulated"
                  }`,
                ),
              },
              {
                label: t(`${NS}.fields.vram`),
                value: profile.vramGb ? formatGb(profile.vramGb) : null,
              },
              {
                label: t(`${NS}.fields.ram`),
                value: profile.ramGb ? formatGb(profile.ramGb) : null,
              },
            ]}
          />
        </Hideable>
      )}
    </PanelBody>
  );
}

/**
 * Right panel of prototype A; its content follows the current view
 * (SPEC §5): configure → RunPreviewPanel; run → run info; history →
 * session summary; chat → GenerationParamsPanel; adapters/compare →
 * selected adapter summary; home → module summary.
 *
 * @param {object} props
 * @param {object} props.route result of useFineTuningRouteA()
 * @param {boolean} [props.sessionExists]
 */
export default function FineTuningRightPanel({ route, sessionExists = true }) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const navigate = useNavigate();
  const routes = useFineTuningRoutes();
  const session = useFineTuningStore((s) =>
    route.sessionId ? sessionById(s, route.sessionId) : null,
  );
  const latestRunId = useFineTuningStore((s) => {
    if (route.view !== "run" || route.runId || !route.sessionId) return null;
    const runs = s.runs.filter(
      (r) => r.sessionId === route.sessionId && r.status !== 0,
    );
    const last = runs.reduce(
      (acc, r) => (!acc || r.number > acc.number ? r : acc),
      null,
    );
    return last ? last.id : null;
  });
  const sessionId = session ? session.id : null;
  const onStart = useCallback(
    (runId) => {
      if (runId && sessionId) navigate(routes.run(sessionId, runId));
    },
    [navigate, routes, sessionId],
  );

  const { view } = route;

  if (
    (view === "configure" || view === "session") &&
    sessionExists &&
    session
  ) {
    return <RunPreviewPanel session={session} onStart={onStart} />;
  }
  if (view === "chat") {
    return <GenerationParamsPanel chatId={route.chatId || undefined} />;
  }

  let title = t(`${NS}.moduleTitle`);
  let body = <ModuleSummary />;
  if (view === "run") {
    title = t(`${NS}.runTitle`);
    body = <RunInfo runId={route.runId || latestRunId} />;
  } else if (view === "history") {
    title = t(`${NS}.sessionTitle`);
    body = <SessionSummary sessionId={route.sessionId} />;
  } else if (view === "adapters" || view === "compare") {
    title = t(`${NS}.adapterTitle`);
    body = route.adapterId ? (
      <PanelBody>
        <AdapterSummary
          adapterId={route.adapterId}
          showOpen={view === "compare"}
        />
      </PanelBody>
    ) : (
      <PanelEmpty text={t(`${NS}.adapterEmpty`)} />
    );
  } else if ((view === "configure" || view === "session") && !session) {
    title = t(`${NS}.sessionTitle`);
    body = <PanelEmpty text={t(`${NS}.sessionEmpty`)} />;
  }

  return (
    <SideBar>
      <PanelHeader title={title} />
      {body}
    </SideBar>
  );
}

FineTuningRightPanel.propTypes = {
  route: PropTypes.object.isRequired,
  sessionExists: PropTypes.bool,
};
