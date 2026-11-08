import { useMemo } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useFineTuningStore } from "../FineTuningContext";
import { methodLabel, statusLabel } from "../data/labels";
import { runSummary } from "../data/selectors";
import { formatBytes } from "../data/catalog";
import RunStatusDot from "../../shared/RunStatusDot";
import { formatDuration, formatGb, formatLr, formatMetric } from "./runFormat";

export const COMPARISON_COLUMNS = Object.freeze([
  "name",
  "checkpoint",
  "method",
  "rank",
  "lr",
  "steps",
  "finalLoss",
  "evalLoss",
  "duration",
  "peakVram",
  "size",
  "status",
]);

export const DEFAULT_COLUMNS = Object.freeze([
  "name",
  "method",
  "rank",
  "lr",
  "steps",
  "finalLoss",
  "evalLoss",
  "duration",
  "peakVram",
  "size",
]);

/** Id of the finished run with the lowest final eval loss (or null). */
export function bestEvalRunId(runs) {
  let best = null;
  (runs || []).forEach((run) => {
    if (!run || run.status !== 3) return;
    const value = runSummary(run).finalEvalLoss;
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      (!best || value < best.value)
    ) {
      best = { id: run.id, value };
    }
  });
  return best ? best.id : null;
}

const NUMERIC = new Set([
  "rank",
  "lr",
  "steps",
  "finalLoss",
  "evalLoss",
  "duration",
  "peakVram",
  "size",
]);

/**
 * Compact comparison table of runs (Ejecución, Método, r, LR, Pasos, Pérdida
 * final, Pérdida eval ★, Duración, VRAM pico, Tamaño). Reusable by both
 * prototypes; `columns` picks and orders the columns (see COMPARISON_COLUMNS).
 */
export default function RunComparisonTable({
  runs,
  onOpen,
  columns,
  selectedRunId,
  emptyText,
  sx,
}) {
  const { t } = useTranslation(["fineTuning"]);
  const adapters = useFineTuningStore((s) => s.adapters);
  const bestId = useMemo(() => bestEvalRunId(runs), [runs]);
  const cols = (columns && columns.length ? columns : DEFAULT_COLUMNS).filter(
    (c) => COMPARISON_COLUMNS.includes(c),
  );

  const cell = (key, run, summary, adapter) => {
    const snap = run.snapshot || {};
    const draft = snap.draft || {};
    const p = draft.parameters || {};
    switch (key) {
      case "name":
        return (
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}
          >
            <RunStatusDot status={run.status} />
            <Typography
              variant="body2"
              noWrap
              title={run.name}
              sx={{ maxWidth: 240 }}
            >
              {run.name}
            </Typography>
          </Box>
        );
      case "checkpoint":
        return snap.checkpoint ? snap.checkpoint.name : "—";
      case "method":
        return draft.method ? methodLabel(draft.method, t) : "—";
      case "rank":
        return p.loraR ? `${p.loraR} / ${p.loraAlpha ?? "—"}` : "—";
      case "lr":
        return formatLr(p.learningRate);
      case "steps":
        return run.status === 0
          ? `${summary.totalSteps}`
          : `${summary.steps} / ${summary.totalSteps}`;
      case "finalLoss":
        return formatMetric(summary.finalLoss);
      case "evalLoss":
        if (run.id === bestId) {
          return (
            <Tooltip title={t("fineTuning:history.table.best")}>
              <Box
                component="span"
                sx={{ color: "warning.main", fontWeight: 600 }}
              >
                {`★ ${formatMetric(summary.finalEvalLoss)}`}
              </Box>
            </Tooltip>
          );
        }
        return formatMetric(summary.finalEvalLoss);
      case "duration":
        return summary.durationSec !== null
          ? formatDuration(summary.durationSec * 1000)
          : "—";
      case "peakVram":
        return summary.peakVramGb ? formatGb(summary.peakVramGb) : "—";
      case "size":
        return adapter ? formatBytes(adapter.sizeBytes) : "—";
      case "status":
        return statusLabel(run.status, t);
      default:
        return "—";
    }
  };

  if (!runs || runs.length === 0) {
    return (
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textAlign: "center", py: 4, ...sx }}
      >
        {emptyText || t("fineTuning:history.table.empty")}
      </Typography>
    );
  }

  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "background.box",
        ...sx,
      }}
    >
      <Table size="small" aria-label={t("fineTuning:history.table.ariaLabel")}>
        <TableHead>
          <TableRow>
            {cols.map((key) => (
              <TableCell
                key={key}
                align={NUMERIC.has(key) ? "right" : "left"}
                sx={{
                  py: 2,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  color: "text.secondary",
                }}
              >
                {t(`fineTuning:history.table.${key}`)}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {runs.map((run) => {
            const summary = runSummary(run);
            const adapter = run.adapterId
              ? adapters.find((a) => a.id === run.adapterId)
              : null;
            return (
              <TableRow
                key={run.id}
                hover={Boolean(onOpen)}
                selected={selectedRunId === run.id}
                onClick={onOpen ? () => onOpen(run) : undefined}
                onKeyDown={
                  onOpen
                    ? (e) => {
                        if (e.key === "Enter") onOpen(run);
                      }
                    : undefined
                }
                tabIndex={onOpen ? 0 : undefined}
                sx={{
                  cursor: onOpen ? "pointer" : "default",
                  "&:last-child td": { borderBottom: 0 },
                }}
              >
                {cols.map((key) => (
                  <TableCell
                    key={key}
                    align={NUMERIC.has(key) ? "right" : "left"}
                    sx={{
                      py: 1,
                      whiteSpace: "nowrap",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {cell(key, run, summary, adapter)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

RunComparisonTable.propTypes = {
  runs: PropTypes.arrayOf(PropTypes.object),
  onOpen: PropTypes.func,
  columns: PropTypes.arrayOf(PropTypes.oneOf(COMPARISON_COLUMNS)),
  selectedRunId: PropTypes.string,
  emptyText: PropTypes.node,
  sx: PropTypes.object,
};

RunComparisonTable.defaultProps = {
  runs: [],
  onOpen: null,
  columns: null,
  selectedRunId: null,
  emptyText: null,
  sx: {},
};
