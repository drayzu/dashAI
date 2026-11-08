import PropTypes from "prop-types";
import { Box, Chip } from "@mui/material";
import { useTranslation } from "react-i18next";
import { getRunStatusColor } from "../../../utils/runStatus";
import { phaseLabel, reasonLabel, statusLabel } from "../data/labels";

const REASON_COLOR = {
  failed: "error",
  cancelled: "warning",
  interrupted: "warning",
};

/** True while a queued run is blocked by a busy GPU (gpuWaiting without a later gpuFree). */
export function isWaitingForGpu(run) {
  if (!run || run.status !== 1 || !Array.isArray(run.events)) return false;
  for (let i = run.events.length - 1; i >= 0; i -= 1) {
    const key = run.events[i].key;
    if (key === "gpuFree") return false;
    if (key === "gpuWaiting") return true;
  }
  return false;
}

/**
 * Status, phase and termination reason as three independent chips (R55):
 * a finished run stays "Finalizada" whatever happens to its adapter later.
 */
export default function RunStatusChips({
  run,
  size,
  showPhase,
  showReason,
  sx,
}) {
  const { t } = useTranslation(["fineTuning", "common"]);
  if (!run) return null;
  const status = Number.isInteger(run.status) ? run.status : 0;
  const waitingGpu = isWaitingForGpu(run);
  return (
    <Box
      aria-live="polite"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 1,
        ...sx,
      }}
    >
      <Chip
        label={statusLabel(status, t)}
        color={getRunStatusColor(status)}
        size={size}
      />
      {showPhase && run.phase && (
        <Chip
          label={phaseLabel(run.phase, t)}
          variant="outlined"
          size={size}
          color={status === 2 ? "primary" : "default"}
        />
      )}
      {showPhase && waitingGpu && (
        <Chip
          label={t("fineTuning:runs.status.waitingGpu")}
          variant="outlined"
          size={size}
          color="warning"
        />
      )}
      {showReason && run.terminationReason && (
        <Chip
          label={reasonLabel(run.terminationReason, t)}
          variant="outlined"
          size={size}
          color={REASON_COLOR[run.terminationReason] || "default"}
        />
      )}
    </Box>
  );
}

RunStatusChips.propTypes = {
  run: PropTypes.object,
  size: PropTypes.oneOf(["small", "medium"]),
  showPhase: PropTypes.bool,
  showReason: PropTypes.bool,
  sx: PropTypes.object,
};

RunStatusChips.defaultProps = {
  run: null,
  size: "small",
  showPhase: true,
  showReason: true,
  sx: {},
};
