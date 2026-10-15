import PropTypes from "prop-types";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";

/** Down-samples a series to at most `max` points (keeps first and last). */
export function downsample(values, max = 60) {
  if (!Array.isArray(values) || values.length <= max) return values || [];
  const out = [];
  const stride = (values.length - 1) / (max - 1);
  for (let i = 0; i < max; i += 1) out.push(values[Math.round(i * stride)]);
  return out;
}

/** SVG polyline points for a series inside a width × height box. */
export function sparklinePath(values, width, height, pad = 2) {
  const finite = (values || []).filter(
    (v) => typeof v === "number" && Number.isFinite(v),
  );
  if (finite.length < 2) return "";
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min || 1;
  const stepX = (width - pad * 2) / (finite.length - 1);
  return finite
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (height - pad * 2) * (1 - (v - min) / span);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * Tiny inline loss sparkline (theme colours, no axes). Accepts raw numbers
 * (`values`) or run points (`points`, uses `loss`).
 */
export default function Sparkline({
  values,
  points,
  width,
  height,
  color,
  ariaLabel,
  sx,
}) {
  const theme = useTheme();
  const series = downsample(values || (points || []).map((p) => p && p.loss));
  const path = sparklinePath(series, width, height);
  const stroke =
    color || theme.palette.chart?.train || theme.palette.success.main;
  if (!path) {
    return (
      <Box
        aria-hidden
        sx={{
          width: "100%",
          maxWidth: width,
          height,
          borderBottom: 1,
          borderColor: "divider",
          borderStyle: "dashed",
          ...sx,
        }}
      />
    );
  }
  const last = path.split(" ").pop().split(",");
  return (
    <Box
      component="svg"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      sx={{
        width,
        maxWidth: "100%",
        height,
        display: "block",
        overflow: "visible",
        ...sx,
      }}
    >
      <polyline
        points={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r={2} fill={stroke} />
    </Box>
  );
}

Sparkline.propTypes = {
  values: PropTypes.arrayOf(PropTypes.number),
  points: PropTypes.arrayOf(PropTypes.object),
  width: PropTypes.number,
  height: PropTypes.number,
  color: PropTypes.string,
  ariaLabel: PropTypes.string,
  sx: PropTypes.object,
};

Sparkline.defaultProps = {
  values: undefined,
  points: undefined,
  width: 120,
  height: 32,
  color: undefined,
  ariaLabel: undefined,
  sx: {},
};
