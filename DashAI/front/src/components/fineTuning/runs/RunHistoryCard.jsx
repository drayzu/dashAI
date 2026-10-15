import PropTypes from "prop-types";
import {
  Box,
  Chip,
  LinearProgress,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import { Check } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useNow } from "../FineTuningContext";
import { getRunStatusColor } from "../../../utils/runStatus";
import {
  datasetName,
  methodLabel,
  statusLabel,
  reasonLabel,
} from "../data/labels";
import { isActiveStatus, runSummary } from "../data/selectors";
import Sparkline from "../common/Sparkline";
import {
  formatDateTime,
  formatDuration,
  formatMetric,
  formatRelative,
} from "./runFormat";

/**
 * Compact history card (Unsloth-like history in DashAI style): status chip +
 * relative time, run name, model · dataset, loss sparkline, loss · steps ·
 * duration. Selected: primary border + action.selected; hover: secondary.
 */
export default function RunHistoryCard({ run, selected, onClick, best, sx }) {
  const { t, i18n } = useTranslation(["fineTuning"]);
  const active = Boolean(run && isActiveStatus(run.status));
  // Ticks only while the run is active (elapsed time); otherwise static.
  const now = useNow(1000, active);
  if (!run) return null;
  const summary = runSummary(run);
  const snap = run.snapshot || {};
  const ck = snap.checkpoint || {};
  const method = snap.draft ? snap.draft.method : null;
  const when = run.endedAt || run.startedAt || run.queuedAt || run.createdAt;
  const duration =
    summary.durationSec !== null
      ? formatDuration(summary.durationSec * 1000)
      : run.startedAt
        ? formatDuration(now - run.startedAt)
        : "—";
  const statusText = run.terminationReason
    ? `${statusLabel(run.status, t)} · ${reasonLabel(run.terminationReason, t)}`
    : statusLabel(run.status, t);

  const handleKey = (e) => {
    if (onClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick(run);
    }
  };

  return (
    <Paper
      elevation={0}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? Boolean(selected) : undefined}
      onClick={onClick ? () => onClick(run) : undefined}
      onKeyDown={handleKey}
      sx={{
        position: "relative",
        p: 4,
        border: 1,
        borderColor: selected ? "primary.main" : "divider",
        bgcolor: selected ? "action.selected" : "background.paper",
        borderRadius: 1,
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minWidth: 0,
        "&:hover": onClick
          ? { borderColor: selected ? "primary.main" : "secondary.main" }
          : {},
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 2,
        },
        ...sx,
      }}
    >
      {selected && (
        <Check
          color="primary"
          fontSize="small"
          sx={{ position: "absolute", top: 8, right: 8 }}
        />
      )}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          pr: selected ? 6 : 0,
        }}
      >
        <Chip
          size="small"
          label={statusText}
          color={getRunStatusColor(run.status)}
        />
        <Tooltip title={formatDateTime(when, i18n.language)}>
          <Typography variant="caption" color="text.secondary" noWrap>
            {formatRelative(when, now, i18n.language)}
          </Typography>
        </Tooltip>
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600 }}
          noWrap
          title={run.name}
        >
          {run.name}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          component="div"
        >
          {[
            ck.name,
            method ? methodLabel(method, t) : null,
            datasetName(snap.dataset, t),
          ]
            .filter(Boolean)
            .join(" · ")}
        </Typography>
      </Box>
      {active ? (
        <Box sx={{ py: 1 }}>
          <LinearProgress
            variant={run.status === 1 ? "indeterminate" : "determinate"}
            value={Math.round((run.progress || 0) * 100)}
            sx={{ height: 4, borderRadius: 1 }}
          />
        </Box>
      ) : (
        <Sparkline
          points={run.points}
          width={260}
          height={36}
          ariaLabel={t("fineTuning:history.sparklineLabel")}
          sx={{ width: "100%" }}
        />
      )}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 3,
          alignItems: "baseline",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {t("fineTuning:history.card.loss", {
            value: formatMetric(summary.finalLoss),
          })}
        </Typography>
        {summary.finalEvalLoss !== null && (
          <Typography
            variant="caption"
            color={best ? "warning.main" : "text.secondary"}
          >
            {best ? "★ " : ""}
            {t("fineTuning:history.card.evalLoss", {
              value: formatMetric(summary.finalEvalLoss),
            })}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary">
          {t("fineTuning:history.card.steps", {
            step: summary.steps,
            total: summary.totalSteps,
          })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {duration}
        </Typography>
      </Box>
    </Paper>
  );
}

RunHistoryCard.propTypes = {
  run: PropTypes.object,
  selected: PropTypes.bool,
  onClick: PropTypes.func,
  best: PropTypes.bool,
  sx: PropTypes.object,
};

RunHistoryCard.defaultProps = {
  run: null,
  selected: false,
  onClick: null,
  best: false,
  sx: {},
};
