import PropTypes from "prop-types";
import { Box, LinearProgress, Tooltip, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";

const fmt = (v, unit) =>
  typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(1)} ${unit}` : "—";

/**
 * Label / value / LinearProgress row, like DashAI's HardwareMonitorPanel
 * UsageBar. `value` and `max` share `unit`; an optional `peak` is drawn as a
 * thin marker on the bar. Pass `percent` instead of value/max for ratios.
 */
export default function UsageBar({
  label,
  value,
  max,
  peak,
  unit,
  percent,
  color,
  detail,
  peakLabel,
  sx,
}) {
  const theme = useTheme();
  const ratio =
    typeof percent === "number"
      ? percent
      : max > 0 && typeof value === "number"
        ? (value / max) * 100
        : 0;
  const peakRatio =
    max > 0 && typeof peak === "number"
      ? Math.min(100, (peak / max) * 100)
      : null;
  const valueText =
    typeof percent === "number"
      ? `${percent.toFixed(1)} %`
      : max
        ? `${fmt(value, unit)} / ${fmt(max, unit)}`
        : fmt(value, unit);
  const barColor =
    color === "auto"
      ? ratio > 100
        ? "error"
        : ratio > 90
          ? "warning"
          : "primary"
      : color;

  return (
    <Box sx={{ mb: 4, ...sx }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 2,
          mb: 2,
        }}
      >
        <Typography variant="body2" fontWeight={500}>
          {label}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: "right" }}
        >
          {valueText}
          {detail ? " · " : null}
          {detail}
        </Typography>
      </Box>
      <Box sx={{ position: "relative" }}>
        <LinearProgress
          variant="determinate"
          value={Math.max(0, Math.min(ratio, 100))}
          color={barColor}
          aria-label={label}
          sx={{ height: 6, borderRadius: 1 }}
        />
        {peakRatio !== null && peakRatio > 0 && (
          <Tooltip
            title={
              peakLabel ? `${peakLabel}: ${fmt(peak, unit)}` : fmt(peak, unit)
            }
          >
            <Box
              sx={{
                position: "absolute",
                top: -3,
                bottom: -3,
                left: `calc(${peakRatio}% - 1px)`,
                width: 2,
                borderRadius: 1,
                bgcolor: theme.palette.text.primary,
                opacity: 0.6,
              }}
            />
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}

UsageBar.propTypes = {
  label: PropTypes.node.isRequired,
  value: PropTypes.number,
  max: PropTypes.number,
  peak: PropTypes.number,
  unit: PropTypes.string,
  percent: PropTypes.number,
  color: PropTypes.oneOf([
    "primary",
    "secondary",
    "info",
    "success",
    "warning",
    "error",
    "auto",
  ]),
  detail: PropTypes.node,
  peakLabel: PropTypes.string,
  sx: PropTypes.object,
};

UsageBar.defaultProps = {
  value: undefined,
  max: undefined,
  peak: undefined,
  unit: "GB",
  percent: undefined,
  color: "primary",
  detail: null,
  peakLabel: undefined,
  sx: {},
};
