import PropTypes from "prop-types";
import {
  Box,
  Chip,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useTranslation } from "react-i18next";
import { estimateVram } from "../data/sft";
import { useHardwareProfile } from "../hooks/useHardwareProfile";

/** Fraction of the available VRAM above which the estimate is "tight". */
export const VRAM_TIGHT_RATIO = 0.9;

/**
 * "ok" | "tight" (> 90 % of the available VRAM) | "exceeds" | "unknown".
 * Same thresholds as the store preflight (vram_tight / vram_exceeds).
 */
export function vramLevel(estimatedGb, availableGb) {
  const est = Number(estimatedGb);
  const avail = Number(availableGb);
  if (!Number.isFinite(est) || !Number.isFinite(avail) || avail <= 0)
    return "unknown";
  if (est > avail) return "exceeds";
  if (est > avail * VRAM_TIGHT_RATIO) return "tight";
  return "ok";
}

export function vramLevelColor(level) {
  if (level === "exceeds") return "error";
  if (level === "tight") return "warning";
  return "primary";
}

/**
 * Orientative VRAM estimate for a checkpoint + method + parameters, or null
 * when the inputs are incomplete. Wraps data/sft estimateVram.
 */
export function estimateDraftVram(checkpoint, method, parameters) {
  if (!checkpoint) return null;
  const p = parameters || {};
  return estimateVram({
    parametersB: checkpoint.parametersB,
    method,
    batchSize: Number(p.batchSize) || 1,
    maxLength: Number(p.maxLength) || 512,
    loraR: Number(p.loraR) || 16,
  });
}

function formatGb(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n * 10) / 10}`;
}

/**
 * Small chip shown only when the estimate is tight or exceeds the VRAM
 * (Unsloth-like "OOM" tag). Renders nothing when the estimate fits.
 */
export function VramRiskChip({ estimatedGb, availableGb, size = "small", sx }) {
  const { t } = useTranslation(["fineTuning"]);
  const level = vramLevel(estimatedGb, availableGb);
  if (level !== "exceeds" && level !== "tight") return null;
  const params = {
    estimated: formatGb(estimatedGb),
    available: formatGb(availableGb),
  };
  return (
    <Tooltip title={t(`fineTuning:common.vram.${level}Tooltip`, params)}>
      <Chip
        size={size}
        variant="outlined"
        color={level === "exceeds" ? "error" : "warning"}
        icon={<WarningAmberIcon />}
        label={t(`fineTuning:common.vram.${level}Chip`)}
        sx={sx}
      />
    </Tooltip>
  );
}

VramRiskChip.propTypes = {
  estimatedGb: PropTypes.number,
  availableGb: PropTypes.number,
  size: PropTypes.oneOf(["small", "medium"]),
  sx: PropTypes.object,
};

/**
 * Estimated VRAM vs available VRAM (detected or simulated hardware).
 *
 * Give either `estimatedGb`, or `checkpoint` + `method` + `parameters` to
 * compute it. `hardware` defaults to useHardwareProfile().profile.
 *
 * variant:
 * - "bar" (default): label row, value "3.1 / 8 GB", hardware chip,
 *   LinearProgress (primary / warning > 90 % / error when it exceeds),
 *   caption "Estimación orientativa" and a short advice when it exceeds.
 * - "compact": one line (value + thin bar + risk chip), for catalog cards.
 */
export default function VramEstimate({
  estimatedGb,
  checkpoint,
  method,
  parameters,
  hardware,
  variant = "bar",
  label,
  showCaption = true,
  showHardware = true,
  sx,
}) {
  const { t } = useTranslation(["fineTuning"]);
  const { profile } = useHardwareProfile();
  const hw = hardware || profile || {};
  const estimate =
    typeof estimatedGb === "number"
      ? estimatedGb
      : estimateDraftVram(checkpoint, method, parameters);
  const available = Number(hw.vramGb) || null;
  const level = vramLevel(estimate, available);
  const color = vramLevelColor(level);
  const ratio =
    estimate && available ? Math.min(100, (estimate / available) * 100) : 0;
  const valueText = t("fineTuning:common.vram.value", {
    estimated: formatGb(estimate),
    available: available ? formatGb(available) : "—",
  });
  const sourceLabel = t(
    hw.source === "detected"
      ? "fineTuning:common.vram.detected"
      : "fineTuning:common.vram.simulated",
  );

  if (estimate === null || estimate === undefined) {
    return (
      <Typography variant="caption" color="text.secondary" sx={sx}>
        {t("fineTuning:common.vram.noEstimate")}
      </Typography>
    );
  }

  if (variant === "compact") {
    return (
      <Box sx={{ minWidth: 0, ...sx }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={2}
        >
          <Typography variant="caption" color="text.secondary" noWrap>
            {label || t("fineTuning:common.vram.labelShort")}
          </Typography>
          <Typography
            variant="caption"
            sx={{ fontWeight: 600 }}
            color={
              level === "ok" || level === "unknown"
                ? "text.primary"
                : `${color}.main`
            }
            noWrap
          >
            {valueText}
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={ratio}
          color={color}
          aria-label={label || t("fineTuning:common.vram.labelShort")}
          sx={{ mt: 1, height: 4, borderRadius: 1 }}
        />
      </Box>
    );
  }

  return (
    <Box sx={sx}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={2}
        sx={{ mb: 1, minWidth: 0 }}
      >
        <Typography
          variant="body2"
          sx={{ fontWeight: 500, flex: 1, minWidth: 0 }}
          noWrap
        >
          {label || t("fineTuning:common.vram.label")}
        </Typography>
        <Typography
          variant="body2"
          color={
            level === "ok" || level === "unknown"
              ? "text.secondary"
              : `${color}.main`
          }
          sx={{ fontWeight: level === "ok" ? 400 : 600 }}
          noWrap
        >
          {valueText}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={ratio}
        color={color}
        aria-label={label || t("fineTuning:common.vram.label")}
        aria-valuetext={valueText}
        sx={{ height: 6, borderRadius: 1 }}
      />
      {showHardware && hw.gpuName && (
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ mt: 1, minWidth: 0 }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{ minWidth: 0 }}
          >
            {t("fineTuning:common.vram.hardware", {
              gpu: hw.gpuName,
              vram: formatGb(available),
            })}
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            label={sourceLabel}
            sx={{ height: 20 }}
          />
        </Stack>
      )}
      {level === "exceeds" && (
        <Typography
          variant="caption"
          color="error.main"
          component="p"
          sx={{ mt: 1 }}
        >
          {t("fineTuning:common.vram.exceedsAdvice")}
        </Typography>
      )}
      {level === "tight" && (
        <Typography
          variant="caption"
          color="warning.main"
          component="p"
          sx={{ mt: 1 }}
        >
          {t("fineTuning:common.vram.tightAdvice")}
        </Typography>
      )}
      {showCaption && (
        <Typography
          variant="caption"
          color="text.secondary"
          component="p"
          sx={{ mt: 1 }}
        >
          {t("fineTuning:common.vram.caption")}
        </Typography>
      )}
    </Box>
  );
}

VramEstimate.propTypes = {
  estimatedGb: PropTypes.number,
  checkpoint: PropTypes.shape({ parametersB: PropTypes.number }),
  method: PropTypes.oneOf(["qlora", "lora"]),
  parameters: PropTypes.object,
  hardware: PropTypes.shape({
    gpuName: PropTypes.string,
    vramGb: PropTypes.number,
    source: PropTypes.string,
  }),
  variant: PropTypes.oneOf(["bar", "compact"]),
  label: PropTypes.node,
  showCaption: PropTypes.bool,
  showHardware: PropTypes.bool,
  sx: PropTypes.object,
};
