import { useMemo } from "react";
import PropTypes from "prop-types";
import { Box, Typography } from "@mui/material";
import { History } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFineTuningRoutes, useFineTuningStore } from "../FineTuningContext";
import { runsBySession } from "../data/selectors";
import EmptyState from "../common/EmptyState";
import RunHistoryCard from "./RunHistoryCard";
import RunComparisonTable, { bestEvalRunId } from "./RunComparisonTable";

const EMPTY = [];

/** All runs (every session), newest first. */
function allRunsDesc(state) {
  if (!state || !Array.isArray(state.runs)) return EMPTY;
  return [...state.runs].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
  );
}

/**
 * Run history of a session: card grid (status + relative time, name,
 * model · dataset, loss sparkline, loss · steps · duration) and a compact
 * comparison table below with the best eval loss marked ★.
 * Without `sessionId` it lists the runs of every session (home "recent runs").
 */
export default function RunHistory({
  sessionId,
  onOpen,
  selectedRunId,
  limit,
  showTable,
  showHeader,
  includeConfigs,
  columns,
  sx,
}) {
  const { t } = useTranslation(["fineTuning"]);
  const routes = useFineTuningRoutes();
  const navigate = useNavigate();
  const runs = useFineTuningStore((s) =>
    sessionId ? runsBySession(s, sessionId, "desc") : allRunsDesc(s),
  );

  const visible = useMemo(() => {
    const list = includeConfigs ? runs : runs.filter((r) => r.status !== 0);
    return limit ? list.slice(0, limit) : list;
  }, [runs, includeConfigs, limit]);
  const bestId = useMemo(() => bestEvalRunId(visible), [visible]);

  const open = (run) => {
    if (onOpen) onOpen(run);
    else navigate(routes.run(run.sessionId, run.id));
  };

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={History}
        title={t("fineTuning:history.emptyTitle")}
        description={t("fineTuning:history.emptyDescription")}
        minHeight={200}
        sx={sx}
      />
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 6, ...sx }}>
      <Box component="section" aria-label={t("fineTuning:history.cardsTitle")}>
        {showHeader && (
          <Box
            sx={{
              display: "flex",
              alignItems: "baseline",
              gap: 2,
              mb: 3,
              flexWrap: "wrap",
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {t("fineTuning:history.cardsTitle")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("fineTuning:history.count", { count: visible.length })}
            </Typography>
          </Box>
        )}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 3,
          }}
        >
          {visible.map((run) => (
            <RunHistoryCard
              key={run.id}
              run={run}
              selected={selectedRunId === run.id}
              best={bestId === run.id}
              onClick={open}
            />
          ))}
        </Box>
      </Box>
      {showTable && (
        <Box
          component="section"
          aria-label={t("fineTuning:history.tableTitle")}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "baseline",
              gap: 2,
              mb: 3,
              flexWrap: "wrap",
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {t("fineTuning:history.tableTitle")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("fineTuning:history.tableCaption")}
            </Typography>
          </Box>
          <RunComparisonTable
            runs={visible}
            onOpen={open}
            selectedRunId={selectedRunId}
            columns={columns}
          />
        </Box>
      )}
    </Box>
  );
}

RunHistory.propTypes = {
  sessionId: PropTypes.string,
  onOpen: PropTypes.func,
  selectedRunId: PropTypes.string,
  limit: PropTypes.number,
  showTable: PropTypes.bool,
  showHeader: PropTypes.bool,
  includeConfigs: PropTypes.bool,
  columns: PropTypes.arrayOf(PropTypes.string),
  sx: PropTypes.object,
};

RunHistory.defaultProps = {
  sessionId: null,
  onOpen: null,
  selectedRunId: null,
  limit: null,
  showTable: true,
  showHeader: true,
  includeConfigs: true,
  columns: null,
  sx: {},
};
