import PropTypes from "prop-types";
import { Box, Tooltip, Typography } from "@mui/material";
import { alpha, keyframes, useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { phaseLabel } from "../data/labels";

export const TRACK = Object.freeze([
  "queued",
  "preparing",
  "downloading",
  "validating",
  "loading",
  "training",
  "evaluating",
  "saving",
  "published",
]);

const PHASES = TRACK.slice(1, -1);

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 var(--ft-pulse); }
  70% { box-shadow: 0 0 0 6px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
`;

/** Planned phases of a run; the nominal plan only (a planned failure never leaks). */
function plannedPhases(run) {
  if (run.timeline && Array.isArray(run.timeline.plannedPhases))
    return run.timeline.plannedPhases;
  // Not scheduled yet: download is unknown until start; evaluation depends on the split.
  const ds = (run.snapshot && run.snapshot.dataset) || {};
  const useEval =
    ds.useEval !== false && (ds.evalCount === undefined || ds.evalCount > 0);
  return PHASES.filter((p) => p !== "evaluating" || useEval);
}

/**
 * Pure: state of every track step for a run.
 * @returns {{key: string, state: "done"|"current"|"pending"|"skipped"|"failed"|"cancelled"}[]}
 */
export function phaseTrack(run) {
  if (!run) return TRACK.map((key) => ({ key, state: "pending" }));
  const planned = plannedPhases(run);
  const scheduled = Boolean(run.timeline);
  const isPlanned = (p) =>
    planned.includes(p) || (!scheduled && p === "downloading");
  const status = run.status;
  const stopIndex = run.phase ? TRACK.indexOf(run.phase) : -1;

  return TRACK.map((key, index) => {
    if (key !== "queued" && key !== "published" && !isPlanned(key)) {
      return { key, state: "skipped" };
    }
    if (status === 3) {
      return {
        key,
        state: key === "downloading" && !scheduled ? "skipped" : "done",
      };
    }
    if (status === 0) return { key, state: "pending" };
    if (status === 1) {
      return { key, state: key === "queued" ? "current" : "pending" };
    }
    if (status === 2) {
      if (key === "queued") return { key, state: "done" };
      if (index < stopIndex) return { key, state: "done" };
      if (index === stopIndex) return { key, state: "current" };
      return { key, state: "pending" };
    }
    // status 4: failed / cancelled / interrupted at run.phase (null = still queued).
    const endState =
      run.terminationReason === "failed" ? "failed" : "cancelled";
    if (stopIndex < 0) {
      return { key, state: key === "queued" ? endState : "pending" };
    }
    if (key === "queued" || index < stopIndex) return { key, state: "done" };
    if (index === stopIndex) return { key, state: endState };
    return { key, state: "pending" };
  });
}

/**
 * Compact horizontal phase track: Cola → … → Publicado. Skipped phases are
 * dimmed, the current one pulses in primary, a failed one is error-coloured.
 */
export default function PhaseTimeline({ run, dense, sx }) {
  const theme = useTheme();
  const { t } = useTranslation(["fineTuning"]);
  const steps = phaseTrack(run);

  const colorFor = (state) => {
    switch (state) {
      case "done":
        return theme.palette.success.main;
      case "current":
        return theme.palette.primary.main;
      case "failed":
        return theme.palette.error.main;
      case "cancelled":
        return theme.palette.warning.main;
      default:
        return theme.palette.text.disabled;
    }
  };

  return (
    <Box
      role="list"
      aria-label={t("fineTuning:runs.timeline.ariaLabel")}
      sx={{
        display: "flex",
        alignItems: "flex-start",
        width: "100%",
        overflowX: "auto",
        py: 1,
        ...sx,
      }}
    >
      {steps.map((step, index) => {
        const color = colorFor(step.state);
        const filled = ["done", "current", "failed", "cancelled"].includes(
          step.state,
        );
        const next = steps[index + 1];
        const connectorDone =
          next &&
          step.state === "done" &&
          next.state !== "pending" &&
          next.state !== "skipped";
        const label = phaseLabel(step.key, t);
        const stateText = t(`fineTuning:runs.timeline.state.${step.state}`);
        return (
          <Box
            key={step.key}
            role="listitem"
            aria-current={step.state === "current" ? "step" : undefined}
            sx={{
              flex: 1,
              minWidth: dense ? 56 : 72,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative",
              opacity: step.state === "skipped" ? 0.45 : 1,
            }}
          >
            {index < steps.length - 1 && (
              <Box
                sx={{
                  position: "absolute",
                  top: 5,
                  left: "50%",
                  width: "100%",
                  height: 2,
                  bgcolor: connectorDone
                    ? alpha(theme.palette.success.main, 0.6)
                    : "divider",
                }}
              />
            )}
            <Tooltip title={`${label} · ${stateText}`}>
              <Box
                sx={{
                  position: "relative",
                  zIndex: 1,
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  border: 2,
                  borderStyle: step.state === "skipped" ? "dashed" : "solid",
                  borderColor: filled ? color : theme.palette.divider,
                  bgcolor: filled ? color : theme.palette.background.paper,
                  "--ft-pulse": alpha(theme.palette.primary.main, 0.5),
                  animation:
                    step.state === "current"
                      ? `${pulse} 1.6s ease-out infinite`
                      : "none",
                  "@media (prefers-reduced-motion: reduce)": {
                    animation: "none",
                  },
                }}
              />
            </Tooltip>
            <Typography
              variant="caption"
              sx={{
                mt: 1,
                textAlign: "center",
                lineHeight: 1.2,
                color:
                  step.state === "pending" || step.state === "skipped"
                    ? "text.secondary"
                    : color,
                fontWeight: step.state === "current" ? 600 : 400,
              }}
            >
              {label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

PhaseTimeline.propTypes = {
  run: PropTypes.object,
  dense: PropTypes.bool,
  sx: PropTypes.object,
};

PhaseTimeline.defaultProps = {
  run: null,
  dense: false,
  sx: {},
};
