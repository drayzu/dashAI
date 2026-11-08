import PropTypes from "prop-types";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Typography,
} from "@mui/material";
import { Replay } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { failureInfo, phaseLabel } from "../data/labels";

/** Diagnosis code of a terminal ERROR run (failure code, or cancelled/interrupted). */
export function runDiagnosisCode(run) {
  if (!run || run.status !== 4) return null;
  if (run.failure && run.failure.code) return run.failure.code;
  if (run.terminationReason === "cancelled") return "cancelled";
  if (run.terminationReason === "interrupted") return "interrupted";
  return "unknown";
}

/**
 * Diagnosis for an ERROR run: title per code, explanation, "qué hacer" list,
 * phase reached and a "new run" call to action. No adapter was published.
 */
export default function RunErrorPanel({ run, onNewRun, newRunLabel, sx }) {
  const { t } = useTranslation(["fineTuning"]);
  const code = runDiagnosisCode(run);
  if (!code) return null;
  const params = (run.failure && run.failure.params) || {};
  const info = failureInfo(code, t, params);
  const cancelled = code === "cancelled";
  const step = run.failure && run.failure.step ? run.failure.step : run.step;

  return (
    <Alert
      severity={cancelled ? "warning" : "error"}
      variant="outlined"
      sx={{
        alignItems: "flex-start",
        "& .MuiAlert-message": { width: "100%" },
        ...sx,
      }}
    >
      <AlertTitle sx={{ fontWeight: 600 }}>{info.title}</AlertTitle>
      <Typography variant="body2" sx={{ mb: 2 }}>
        {info.explanation}
      </Typography>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          mb: info.actions.length ? 2 : 0,
        }}
      >
        {run.phase ? (
          <Chip
            size="small"
            variant="outlined"
            label={t("fineTuning:runs.error.phaseReached", {
              phase: phaseLabel(run.phase, t),
            })}
          />
        ) : (
          <Chip
            size="small"
            variant="outlined"
            label={t("fineTuning:runs.error.neverStarted")}
          />
        )}
        {run.phase === "training" && step > 0 && (
          <Chip
            size="small"
            variant="outlined"
            label={t("fineTuning:runs.error.stepReached", {
              step,
              total: run.totalSteps,
            })}
          />
        )}
        <Chip
          size="small"
          variant="outlined"
          label={t("fineTuning:runs.error.noAdapter")}
        />
      </Box>
      {info.actions.length > 0 && (
        <>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {t("fineTuning:runs.error.whatToDo")}
          </Typography>
          <Box component="ul" sx={{ m: 0, mt: 1, pl: 5 }}>
            {info.actions.map((action) => (
              <Typography component="li" variant="body2" key={action}>
                {action}
              </Typography>
            ))}
          </Box>
        </>
      )}
      {onNewRun && (
        <Box sx={{ mt: 3 }}>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<Replay fontSize="small" />}
            onClick={onNewRun}
          >
            {newRunLabel || t("fineTuning:runs.actions.newFromConfig")}
          </Button>
        </Box>
      )}
    </Alert>
  );
}

RunErrorPanel.propTypes = {
  run: PropTypes.object,
  onNewRun: PropTypes.func,
  newRunLabel: PropTypes.node,
  sx: PropTypes.object,
};

RunErrorPanel.defaultProps = {
  run: null,
  onNewRun: null,
  newRunLabel: null,
  sx: {},
};
