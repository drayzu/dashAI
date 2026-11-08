import { useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Chip,
  IconButton,
  LinearProgress,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import {
  ChevronRight,
  Delete,
  Edit,
  PlayArrow,
  Replay,
} from "@mui/icons-material";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import { useTranslation } from "react-i18next";
import RunStatusDot from "../../../components/shared/RunStatusDot";
import DeleteConfirmationModal from "../../../components/threeSectionLayout/DeleteConfirmationModal";
import Sparkline from "../../../components/fineTuning/common/Sparkline";
import { getRunStatusColor } from "../../../utils/runStatus";
import {
  isActiveStatus,
  runSummary,
} from "../../../components/fineTuning/data/selectors";
import {
  methodLabel,
  phaseLabel,
  reasonLabel,
  statusLabel,
} from "../../../components/fineTuning/data/labels";
import {
  formatLr,
  formatMetric,
} from "../../../components/fineTuning/runs/runFormat";

/**
 * Run configuration card of a prototype B session, styled like Models'
 * ModelCardCompact: status-coloured border, model icon, name, status dot +
 * base model · method, icon buttons Entrenar / Editar (not started only) /
 * Eliminar, chips r/α · pasos · LR, mini progress while active, loss
 * sparkline when finished, and a "Métricas | Procedencia" footer.
 */
export default function RunConfigCard({
  run,
  best,
  onOpen,
  onTrain,
  onEdit,
  onDelete,
}) {
  const theme = useTheme();
  const { t } = useTranslation(["fineTuning", "common"]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const snap = run.snapshot || {};
  const draft = snap.draft || {};
  const p = draft.parameters || {};
  const ck = snap.checkpoint || {};
  const active = isActiveStatus(run.status);
  const summary = runSummary(run);

  const colorKey = getRunStatusColor(run.status);
  const statusMain =
    colorKey === "default"
      ? theme.palette.text.disabled
      : theme.palette[colorKey].main;
  const durationChip =
    draft.durationMode === "epochs"
      ? t("fineTuning:shellB.card.epochs", { count: Number(p.epochs) || 1 })
      : t("fineTuning:shellB.card.steps", {
          count: run.totalSteps || Number(p.maxSteps) || 0,
        });
  const statusText = run.terminationReason
    ? `${statusLabel(run.status, t)} · ${reasonLabel(run.terminationReason, t)}`
    : statusLabel(run.status, t);
  const stop = (e) => e.stopPropagation();

  return (
    <Paper
      elevation={0}
      role="button"
      tabIndex={0}
      aria-label={t("fineTuning:shellB.card.open", { name: run.name })}
      onClick={() => onOpen(run)}
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          onOpen(run);
        }
      }}
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        cursor: "pointer",
        border: 1,
        borderColor: alpha(statusMain, 0.35),
        transition:
          "border-color 0.15s, box-shadow 0.2s ease-out, transform 0.15s ease-out",
        "&:hover, &:focus-visible": {
          borderColor: "primary.main",
          transform: "translateY(-3px)",
          boxShadow: `0 6px 16px ${alpha(theme.palette.common.black, 0.2)}`,
          "& .card-chevron-icon": { color: "primary.main" },
        },
        outline: "none",
      }}
    >
      <Box
        sx={{
          pt: 3,
          pb: 2,
          px: 3,
          display: "flex",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Box
          sx={{
            p: 1.5,
            borderRadius: 1,
            bgcolor: "action.hover",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: "primary.main",
          }}
        >
          <PsychologyOutlinedIcon fontSize="small" />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            noWrap
            sx={{ fontWeight: 600 }}
            title={run.name}
          >
            {run.name}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Tooltip title={statusText}>
              <Box component="span" sx={{ display: "inline-flex" }}>
                <RunStatusDot status={run.status} size={6} />
              </Box>
            </Tooltip>
            <Typography variant="caption" color="text.secondary" noWrap>
              {[ck.name, draft.method ? methodLabel(draft.method, t) : null]
                .filter(Boolean)
                .join(" · ")}
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
          onClick={stop}
        >
          <Tooltip
            title={
              active
                ? t("fineTuning:shellB.card.running")
                : run.status === 0
                  ? t("fineTuning:shellB.card.train")
                  : t("fineTuning:shellB.card.retrain")
            }
          >
            <span>
              <IconButton
                size="small"
                disabled={active}
                onClick={() => onTrain(run)}
                aria-label={
                  run.status === 0
                    ? t("fineTuning:shellB.card.train")
                    : t("fineTuning:shellB.card.retrain")
                }
              >
                {run.status === 0 || active ? (
                  <PlayArrow fontSize="small" />
                ) : (
                  <Replay fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip
            title={
              run.status === 0
                ? t("common:edit")
                : t("fineTuning:shellB.card.editLocked")
            }
          >
            <span>
              <IconButton
                size="small"
                disabled={run.status !== 0}
                onClick={() => onEdit(run)}
                aria-label={t("common:edit")}
              >
                <Edit fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip
            title={
              active
                ? t("fineTuning:shellB.card.deleteLocked")
                : t("common:delete")
            }
          >
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={active}
                onClick={() => setConfirmDelete(true)}
                aria-label={t("common:delete")}
              >
                <Delete fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ px: 3, display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Chip
          size="small"
          variant="outlined"
          label={`r ${p.loraR ?? "—"} · α ${p.loraAlpha ?? "—"}`}
        />
        <Chip size="small" variant="outlined" label={durationChip} />
        <Chip
          size="small"
          variant="outlined"
          label={`LR ${formatLr(p.learningRate)}`}
        />
        {best && (
          <Chip
            size="small"
            variant="outlined"
            color="warning"
            label={t("fineTuning:shellB.card.best")}
          />
        )}
      </Box>

      <Box sx={{ px: 3, pt: 2, minHeight: 40 }} aria-live="polite">
        {active && (
          <>
            <LinearProgress
              variant={run.status === 1 ? "indeterminate" : "determinate"}
              value={Math.round((run.progress || 0) * 100)}
              sx={{ borderRadius: 1 }}
            />
            <Typography variant="caption" color="text.secondary">
              {run.status === 1
                ? t("fineTuning:shellB.card.queued")
                : run.phase === "training"
                  ? t("fineTuning:shellB.card.stepProgress", {
                      step: run.step,
                      total: run.totalSteps,
                    })
                  : phaseLabel(run.phase, t)}
            </Typography>
          </>
        )}
        {run.status === 3 && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Sparkline
              points={run.points}
              width={120}
              height={24}
              ariaLabel={t("fineTuning:shellB.card.sparkline")}
            />
            <Typography variant="caption" color="text.secondary" noWrap>
              {t("fineTuning:shellB.card.finalLoss", {
                loss: formatMetric(summary.finalLoss),
                evalLoss: formatMetric(summary.finalEvalLoss),
              })}
            </Typography>
          </Box>
        )}
        {run.status === 4 && (
          <Typography variant="caption" color="error.main">
            {run.failure
              ? t(`fineTuning:failures.${run.failure.code}.title`)
              : reasonLabel(run.terminationReason || "failed", t)}
          </Typography>
        )}
        {run.status === 0 && (
          <Typography variant="caption" color="text.secondary">
            {t("fineTuning:shellB.card.notStarted")}
          </Typography>
        )}
      </Box>

      <Box sx={{ flexGrow: 1 }} />
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 3,
          pt: 1,
          pb: 2,
        }}
      >
        <Typography
          variant="overline"
          color="text.disabled"
          sx={{ lineHeight: 1.5 }}
        >
          {t("fineTuning:shellB.card.footer")}
        </Typography>
        <ChevronRight
          className="card-chevron-icon"
          fontSize="small"
          sx={{ color: "text.disabled", transition: "color 0.15s" }}
        />
      </Box>

      <Box onClick={stop}>
        <DeleteConfirmationModal
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            onDelete(run);
          }}
          content={t(
            run.adapterId
              ? "fineTuning:shellB.card.confirmDeleteAdapter"
              : "fineTuning:shellB.card.confirmDelete",
            { name: run.name },
          )}
        />
      </Box>
    </Paper>
  );
}

RunConfigCard.propTypes = {
  run: PropTypes.object.isRequired,
  best: PropTypes.bool,
  onOpen: PropTypes.func.isRequired,
  onTrain: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};
