import { useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  IconButton,
  LinearProgress,
  Paper,
  Tab,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CompareArrows,
  DeleteOutline,
  Forum,
  PlayArrow,
  Replay,
  Stop,
  ContentCopy,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import PillTabs from "../../shared/PillTabs";
import { useFineTuningStore } from "../FineTuningContext";
import {
  adapterById,
  checkpointById,
  isActiveStatus,
  queuePosition,
  runById,
} from "../data/selectors";
import { failureInfo, methodLabel } from "../data/labels";
import { formatBytes } from "../data/catalog";
import RunStatusChips, { isWaitingForGpu } from "../common/RunStatusChips";
import PhaseTimeline from "../common/PhaseTimeline";
import LossChart from "../common/LossChart";
import ResourcePanel from "./ResourcePanel";
import RunErrorPanel from "./RunErrorPanel";
import AdapterResultCard, { adapterUseBlocker } from "./AdapterResultCard";
import EventLog from "./EventLog";
import FrozenConfigAccordion, {
  FrozenConfigContent,
} from "./FrozenConfigAccordion";
import FrozenDataPanel from "./FrozenDataPanel";
import useRunClock from "./useRunClock";
import useRunActions from "./useRunActions";
import {
  formatDateTime,
  formatDuration,
  formatLr,
  formatMetric,
  formatRelative,
  shortHash,
} from "./runFormat";

export const RUN_DETAIL_TABS = Object.freeze([
  "metrics",
  "data",
  "resources",
  "log",
  "provenance",
]);

const cardSx = { p: 4, border: 1, borderColor: "divider", borderRadius: 2 };

// ---------------------------------------------------------------- blocks --

/** Header: name, model · method, status chips, times and actions. */
export function RunHeader({ run, variant, actions, extraActions }) {
  const { t, i18n } = useTranslation(["fineTuning", "common"]);
  const { now, elapsedMs } = useRunClock(run);
  const adapter = useFineTuningStore((s) =>
    run && run.adapterId ? adapterById(s, run.adapterId) : null,
  );
  const checkpoint = useFineTuningStore((s) =>
    adapter ? checkpointById(s, adapter.checkpointId) : null,
  );
  if (!run) return null;
  const active = isActiveStatus(run.status);
  const ck = (run.snapshot && run.snapshot.checkpoint) || {};
  const method =
    run.snapshot && run.snapshot.draft ? run.snapshot.draft.method : null;
  const chatBlocker = adapterUseBlocker(adapter, checkpoint, t);
  const finished = run.status === 3;

  const tip = (title, node) =>
    title ? (
      <Tooltip title={title}>
        <span>{node}</span>
      </Tooltip>
    ) : (
      node
    );

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 4,
        flexWrap: "wrap",
      }}
    >
      <Box sx={{ flex: 1, minWidth: 240 }}>
        <Typography
          variant="h5"
          component="h2"
          sx={{ fontWeight: 700, wordBreak: "break-word" }}
        >
          {run.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {[ck.name, method ? methodLabel(method, t) : null]
            .filter(Boolean)
            .join(" · ")}
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
            mt: 2,
          }}
        >
          <RunStatusChips run={run} />
          <Tooltip title={formatDateTime(run.createdAt, i18n.language)}>
            <Typography variant="caption" color="text.secondary">
              {t("fineTuning:runs.header.created", {
                when: formatRelative(run.createdAt, now, i18n.language),
              })}
            </Typography>
          </Tooltip>
          {run.startedAt && (
            <Typography variant="caption" color="text.secondary">
              {t(
                active
                  ? "fineTuning:runs.header.elapsed"
                  : "fineTuning:runs.header.duration",
                {
                  value: formatDuration(elapsedMs),
                },
              )}
            </Typography>
          )}
        </Box>
      </Box>
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}
      >
        {extraActions}
        {variant === "A" && (
          <>
            {active && (
              <Button
                size="small"
                variant="outlined"
                color="warning"
                startIcon={<Stop fontSize="small" />}
                onClick={actions.askCancel}
              >
                {t("fineTuning:runs.actions.cancel")}
              </Button>
            )}
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopy fontSize="small" />}
              onClick={actions.askNewFromConfig}
            >
              {t("fineTuning:runs.actions.newFromConfig")}
            </Button>
            {finished && run.adapterId && (
              <>
                {tip(
                  adapter && adapter.availability !== "ready"
                    ? chatBlocker
                    : null,
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<CompareArrows fontSize="small" />}
                    disabled={!adapter || adapter.availability !== "ready"}
                    onClick={() => actions.compare(adapter)}
                  >
                    {t("fineTuning:runs.actions.compare")}
                  </Button>,
                )}
                {tip(
                  chatBlocker,
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<Forum fontSize="small" />}
                    disabled={Boolean(chatBlocker)}
                    onClick={() => actions.openChat(adapter)}
                  >
                    {t("fineTuning:runs.actions.chat")}
                  </Button>,
                )}
              </>
            )}
          </>
        )}
        {variant === "B" && (
          <>
            {active ? (
              <>
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  startIcon={<Stop fontSize="small" />}
                  onClick={actions.askCancel}
                >
                  {t("fineTuning:runs.actions.cancel")}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="warning"
                  disabled
                  startIcon={<Stop fontSize="small" />}
                >
                  {t("common:running")}
                </Button>
              </>
            ) : (
              <Button
                size="small"
                variant="contained"
                startIcon={
                  run.status === 0 ? (
                    <PlayArrow fontSize="small" />
                  ) : (
                    <Replay fontSize="small" />
                  )
                }
                onClick={actions.train}
              >
                {run.status === 0
                  ? t("fineTuning:runs.actions.train")
                  : t("fineTuning:runs.actions.retrain")}
              </Button>
            )}
            {!active && (
              <Tooltip title={t("common:delete")}>
                <IconButton
                  size="small"
                  color="error"
                  aria-label={t("common:delete")}
                  onClick={actions.askDelete}
                >
                  <DeleteOutline fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}

RunHeader.propTypes = {
  run: PropTypes.object,
  variant: PropTypes.oneOf(["A", "B"]).isRequired,
  actions: PropTypes.object.isRequired,
  extraActions: PropTypes.node,
};

RunHeader.defaultProps = { run: null, extraActions: null };

/** Progress block: bar, step, elapsed, ETA; queue / GPU wait; download bytes. */
export function RunProgressBlock({ run, sx }) {
  const { t } = useTranslation(["fineTuning"]);
  const { elapsedMs, remainingMs } = useRunClock(run);
  const position = useFineTuningStore((s) =>
    run && run.status === 1 ? queuePosition(s, run.id) : 0,
  );
  if (!run) return null;
  const pct = Math.round((run.progress || 0) * 100);
  const waitingGpu = isWaitingForGpu(run);
  const ck = (run.snapshot && run.snapshot.checkpoint) || {};
  const downloading =
    run.status === 2 && run.phase === "downloading" && run.download;

  let headline;
  if (run.status === 0) headline = t("fineTuning:runs.progress.notStarted");
  else if (run.status === 1) {
    headline = waitingGpu
      ? t("fineTuning:runs.progress.waitingGpu")
      : position > 0
        ? t("fineTuning:runs.progress.queuedPosition", { position })
        : t("fineTuning:runs.progress.queued");
  } else if (run.status === 2) {
    headline =
      run.phase === "training" || run.step > 0
        ? t("fineTuning:runs.progress.step", {
            step: run.step,
            total: run.totalSteps,
          })
        : t("fineTuning:runs.progress.preparingPhase");
  } else if (run.status === 3)
    headline = t("fineTuning:runs.progress.finished", {
      step: run.step,
      total: run.totalSteps,
    });
  else
    headline = t("fineTuning:runs.progress.stopped", {
      step: run.step,
      total: run.totalSteps,
    });

  return (
    <Paper elevation={0} sx={{ ...cardSx, ...sx }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
          mb: 2,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }} aria-live="polite">
          {headline}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {run.status === 0 ? "" : `${pct} %`}
        </Typography>
      </Box>
      <LinearProgress
        variant={run.status === 1 ? "indeterminate" : "determinate"}
        value={pct}
        color={
          run.status === 4
            ? run.terminationReason === "failed"
              ? "error"
              : "warning"
            : run.status === 3
              ? "success"
              : "primary"
        }
        sx={{ height: 6, borderRadius: 1 }}
        aria-label={t("fineTuning:runs.progress.ariaLabel")}
      />
      <Box sx={{ display: "flex", gap: 6, mt: 2, flexWrap: "wrap" }}>
        <Typography variant="caption" color="text.secondary">
          {t("fineTuning:runs.progress.elapsed", {
            value: run.startedAt ? formatDuration(elapsedMs) : "—",
          })}
        </Typography>
        {isActiveStatus(run.status) && (
          <Typography variant="caption" color="text.secondary">
            {t("fineTuning:runs.progress.eta", {
              value:
                remainingMs === null || !run.startedAt
                  ? "—"
                  : formatDuration(remainingMs),
            })}
          </Typography>
        )}
        {run.snapshot && run.snapshot.effectiveBatch && (
          <Typography variant="caption" color="text.secondary">
            {t("fineTuning:runs.progress.effectiveBatch", {
              value: run.snapshot.effectiveBatch,
            })}
          </Typography>
        )}
      </Box>
      {downloading && (
        <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: "divider" }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              gap: 2,
              flexWrap: "wrap",
              mb: 1,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {t("fineTuning:runs.progress.downloading", {
                name: ck.name || ck.repository,
              })}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {`${formatBytes(run.download.doneBytes)} / ${formatBytes(run.download.totalBytes)}`}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={
              run.download.totalBytes
                ? (run.download.doneBytes / run.download.totalBytes) * 100
                : 0
            }
            color="info"
            sx={{ height: 4, borderRadius: 1 }}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 1, fontFamily: "monospace" }}
          >
            {`~/.DashAI/llm_models/${ck.repository || ck.id}@${shortHash(ck.revision)}`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("fineTuning:runs.progress.downloadPathNote")}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

RunProgressBlock.propTypes = { run: PropTypes.object, sx: PropTypes.object };
RunProgressBlock.defaultProps = { run: null, sx: {} };

/** Latest loss / eval loss / LR / grad norm. */
export function RunMetricsStrip({ run, sx }) {
  const { t } = useTranslation(["fineTuning"]);
  const points = (run && run.points) || [];
  const last = points[points.length - 1] || {};
  const evalPoints = points.filter((p) => typeof p.evalLoss === "number");
  const lastEval = evalPoints[evalPoints.length - 1];
  const items = [
    ["loss", formatMetric(last.loss)],
    ["evalLoss", lastEval ? formatMetric(lastEval.evalLoss) : "—"],
    ["lr", typeof last.lr === "number" ? formatLr(last.lr) : "—"],
    [
      "gradNorm",
      typeof last.gradNorm === "number"
        ? formatMetric(last.gradNorm, 3)
        : last.gradNorm
          ? String(last.gradNorm)
          : "—",
    ],
    ["step", run ? `${run.step || 0} / ${run.totalSteps || 0}` : "—"],
  ];
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 6,
        px: 3,
        py: 2,
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        ...sx,
      }}
    >
      {items.map(([key, value]) => (
        <Box
          key={key}
          sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}
        >
          <Typography variant="caption" color="text.secondary">
            {t(`fineTuning:runs.metrics.${key}`)}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

RunMetricsStrip.propTypes = { run: PropTypes.object, sx: PropTypes.object };
RunMetricsStrip.defaultProps = { run: null, sx: {} };

/** grad_norm health warning (R58): the run may finish, but not "healthy". */
export function RunHealthAlert({ run, sx }) {
  const { t } = useTranslation(["fineTuning"]);
  const warnings = (run && run.healthWarnings) || [];
  if (!warnings.length) return null;
  const info = failureInfo("grad_norm_warning", t);
  return (
    <Alert severity="warning" sx={sx}>
      <AlertTitle sx={{ fontWeight: 600 }}>{info.title}</AlertTitle>
      {info.explanation}
      <Typography variant="body2" sx={{ mt: 1 }}>
        {t("fineTuning:runs.health.steps", {
          count: warnings.length,
          steps: warnings.map((w) => w.step).join(", "),
        })}
      </Typography>
    </Alert>
  );
}

RunHealthAlert.propTypes = { run: PropTypes.object, sx: PropTypes.object };
RunHealthAlert.defaultProps = { run: null, sx: {} };

/** Metrics strip + loss chart (+ LR) + the "loss is not proof" caption. */
export function RunLossSection({ run, showLr }) {
  const { t } = useTranslation(["fineTuning"]);
  if (!run) return null;
  const notStarted = run.status === 0 || (run.status === 1 && !run.startedAt);
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <RunMetricsStrip run={run} />
      <LossChart
        points={run.points}
        showEval={run.snapshot ? run.snapshot.dataset?.useEval !== false : true}
        showLr={showLr}
        filename={`${run.name || run.id}-loss`}
        emptyText={
          notStarted
            ? t("fineTuning:charts.notStarted")
            : t("fineTuning:charts.empty")
        }
      />
      <Typography variant="caption" color="text.secondary">
        {t("fineTuning:charts.lossDisclaimer")}
      </Typography>
    </Box>
  );
}

RunLossSection.propTypes = { run: PropTypes.object, showLr: PropTypes.bool };
RunLossSection.defaultProps = { run: null, showLr: true };

/** Error diagnosis or published adapter, depending on the outcome. */
export function RunOutcome({ run, variant, actions }) {
  const { t } = useTranslation(["fineTuning"]);
  if (!run) return null;
  if (run.status === 4) {
    return (
      <RunErrorPanel
        run={run}
        onNewRun={variant === "B" ? actions.train : actions.askNewFromConfig}
        newRunLabel={
          variant === "B"
            ? t("fineTuning:runs.actions.retrain")
            : t("fineTuning:runs.actions.newFromConfig")
        }
      />
    );
  }
  if (run.status === 3 && run.adapterId) {
    return (
      <AdapterResultCard
        adapterId={run.adapterId}
        onChat={actions.openChat}
        onCompare={actions.compare}
        onProvenance={actions.provenance}
        chatLabel={
          variant === "B"
            ? t("fineTuning:runs.actions.useInGenerative")
            : t("fineTuning:runs.actions.chat")
        }
      />
    );
  }
  return null;
}

RunOutcome.propTypes = {
  run: PropTypes.object,
  variant: PropTypes.oneOf(["A", "B"]).isRequired,
  actions: PropTypes.object.isRequired,
};
RunOutcome.defaultProps = { run: null };

/** Timing rows for provenance (created / queued / started / ended / duration). */
export function RunTimingList({ run }) {
  const { t, i18n } = useTranslation(["fineTuning"]);
  if (!run) return null;
  const rows = [
    ["created", formatDateTime(run.createdAt, i18n.language)],
    ["queued", formatDateTime(run.queuedAt, i18n.language)],
    ["started", formatDateTime(run.startedAt, i18n.language)],
    ["ended", formatDateTime(run.endedAt, i18n.language)],
    [
      "duration",
      run.startedAt && run.endedAt
        ? formatDuration(run.endedAt - run.startedAt)
        : "—",
    ],
  ];
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: "grid",
        gridTemplateColumns: "minmax(120px, 38%) 1fr",
        columnGap: 3,
        rowGap: 1.5,
      }}
    >
      {rows.map(([key, value]) => (
        <Box key={key} sx={{ display: "contents" }}>
          <Typography component="dt" variant="body2" color="text.secondary">
            {t(`fineTuning:runs.timing.${key}`)}
          </Typography>
          <Typography component="dd" variant="body2" sx={{ m: 0 }}>
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

RunTimingList.propTypes = { run: PropTypes.object };
RunTimingList.defaultProps = { run: null };

// ------------------------------------------------------------- variants --

function StackedBody({ run, actions }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <PhaseTimeline run={run} />
      <RunProgressBlock run={run} />
      <RunHealthAlert run={run} />
      <RunOutcome run={run} variant="A" actions={actions} />
      <RunLossSection run={run} showLr />
      <ResourcePanel run={run} />
      <EventLog events={run.events} />
      <FrozenConfigAccordion run={run} />
    </Box>
  );
}

StackedBody.propTypes = {
  run: PropTypes.object.isRequired,
  actions: PropTypes.object.isRequired,
};

function TabsBody({ run, actions, tab, onTabChange, renderExample }) {
  const { t } = useTranslation(["fineTuning"]);
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <RunOutcome run={run} variant="B" actions={actions} />
      <PillTabs
        value={tab}
        onChange={(e, value) => onTabChange(value)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label={t("fineTuning:runs.tabs.ariaLabel")}
        sx={{ alignSelf: "flex-start", maxWidth: "100%" }}
      >
        {RUN_DETAIL_TABS.map((key) => (
          <Tab key={key} value={key} label={t(`fineTuning:runs.tabs.${key}`)} />
        ))}
      </PillTabs>
      <Box
        role="tabpanel"
        hidden={tab !== "metrics"}
        sx={{
          display: tab === "metrics" ? "flex" : "none",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <PhaseTimeline run={run} />
        <RunProgressBlock run={run} />
        <RunHealthAlert run={run} />
        <RunLossSection run={run} showLr />
      </Box>
      {tab === "data" && (
        <FrozenDataPanel run={run} renderExample={renderExample} />
      )}
      {tab === "resources" && <ResourcePanel run={run} />}
      {tab === "log" && <EventLog events={run.events} maxHeight={480} />}
      {tab === "provenance" && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Paper elevation={0} sx={cardSx}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: "block", letterSpacing: 1, mb: 1 }}
            >
              {t("fineTuning:runs.timing.title")}
            </Typography>
            <RunTimingList run={run} />
          </Paper>
          <Paper elevation={0} sx={cardSx}>
            <FrozenConfigContent run={run} />
          </Paper>
          {run.adapterId && (
            <Box>
              <Button
                size="small"
                variant="outlined"
                onClick={() => actions.provenance()}
              >
                {t("fineTuning:runs.actions.adapterProvenance")}
              </Button>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

TabsBody.propTypes = {
  run: PropTypes.object.isRequired,
  actions: PropTypes.object.isRequired,
  tab: PropTypes.oneOf(RUN_DETAIL_TABS).isRequired,
  onTabChange: PropTypes.func.isRequired,
  renderExample: PropTypes.func,
};

TabsBody.defaultProps = { renderExample: null };

/**
 * Run detail. Variant "A": stacked layout. Variant "B": header + outcome +
 * PillTabs (Métricas en vivo · Datos SFT · Recursos · Registro · Procedencia).
 * Live updates come from the store subscription.
 */
export default function RunDetail({
  runId,
  variant,
  tab: controlledTab,
  onTabChange,
  onDeleted,
  onProvenance,
  extraActions,
  renderExample,
  sx,
}) {
  const { t } = useTranslation(["fineTuning"]);
  const run = useFineTuningStore((s) => runById(s, runId));
  const actions = useRunActions(run, { onDeleted, onProvenance });
  const [innerTab, setInnerTab] = useState("metrics");
  const tab = controlledTab || innerTab;
  const setTab = (value) => {
    if (onTabChange) onTabChange(value);
    if (!controlledTab) setInnerTab(value);
  };

  if (!run) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 240,
          p: 4,
          ...sx,
        }}
      >
        <Typography variant="h6" color="text.secondary">
          {t("fineTuning:runs.notFound")}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4, ...sx }}>
      <RunHeader
        run={run}
        variant={variant}
        actions={actions}
        extraActions={extraActions}
      />
      {variant === "B" ? (
        <TabsBody
          run={run}
          actions={actions}
          tab={tab}
          onTabChange={setTab}
          renderExample={renderExample}
        />
      ) : (
        <StackedBody run={run} actions={actions} />
      )}
      {actions.dialogs}
    </Box>
  );
}

RunDetail.propTypes = {
  runId: PropTypes.string,
  variant: PropTypes.oneOf(["A", "B"]),
  tab: PropTypes.oneOf(RUN_DETAIL_TABS),
  onTabChange: PropTypes.func,
  onDeleted: PropTypes.func,
  onProvenance: PropTypes.func,
  extraActions: PropTypes.node,
  renderExample: PropTypes.func,
  sx: PropTypes.object,
};

RunDetail.defaultProps = {
  runId: null,
  variant: "A",
  tab: undefined,
  onTabChange: undefined,
  onDeleted: undefined,
  onProvenance: undefined,
  extraActions: null,
  renderExample: null,
  sx: {},
};
