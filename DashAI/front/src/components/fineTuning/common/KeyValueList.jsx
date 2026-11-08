import PropTypes from "prop-types";
import { Box, Tooltip, Typography } from "@mui/material";

function normalizeRow(row, index) {
  if (Array.isArray(row)) {
    return { key: `${index}`, label: row[0], value: row[1] };
  }
  return { key: row.key || `${index}`, ...row };
}

function isEmpty(value) {
  return value === null || value === undefined || value === "";
}

/**
 * Dense label/value rows (run preview, frozen config, provenance).
 *
 * Rows: `[label, value]` pairs or objects
 * `{ key?, label, value, mono?, hint?, color?, title? }` where `hint` is a
 * caption under the value, `title` a tooltip on the value and `color` a
 * palette path for the value text (e.g. "warning.main").
 * Rows with an empty value are skipped unless `showEmpty` (then `emptyValue`).
 *
 * @param {object} props
 * @param {Array} props.rows
 * @param {React.ReactNode} [props.title] small overline title above the list
 * @param {boolean} [props.dense]
 * @param {"right"|"left"} [props.valueAlign] value alignment (default right)
 * @param {boolean} [props.dividers] 1px divider between rows
 * @param {boolean} [props.showEmpty]
 * @param {React.ReactNode} [props.emptyValue] default "—"
 * @param {object} [props.sx]
 */
export default function KeyValueList({
  rows,
  title,
  dense = false,
  valueAlign = "right",
  dividers = false,
  showEmpty = false,
  emptyValue = "—",
  sx,
}) {
  const items = (Array.isArray(rows) ? rows : [])
    .filter(Boolean)
    .map(normalizeRow)
    .filter((row) => showEmpty || !isEmpty(row.value));
  if (items.length === 0 && !title) return null;
  return (
    <Box sx={sx}>
      {title && (
        <Typography
          variant="overline"
          color="text.secondary"
          component="h4"
          sx={{ display: "block", letterSpacing: 1, lineHeight: 2 }}
        >
          {title}
        </Typography>
      )}
      <Box component="dl" sx={{ m: 0 }}>
        {items.map((row, i) => {
          const value = isEmpty(row.value) ? emptyValue : row.value;
          const valueNode = (
            <Typography
              variant="body2"
              component="span"
              color={row.color || "text.primary"}
              sx={{
                fontWeight: 500,
                overflowWrap: "anywhere",
                ...(row.mono ? { fontFamily: '"Geist Mono", monospace' } : {}),
              }}
            >
              {value}
            </Typography>
          );
          return (
            <Box
              key={row.key}
              sx={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 3,
                py: dense ? 0.5 : 1,
                borderTop: dividers && i > 0 ? 1 : 0,
                borderColor: "divider",
              }}
            >
              <Typography
                component="dt"
                variant="body2"
                color="text.secondary"
                sx={{ flexShrink: 0, maxWidth: "50%" }}
              >
                {row.label}
              </Typography>
              <Box
                component="dd"
                sx={{
                  m: 0,
                  minWidth: 0,
                  textAlign: valueAlign,
                  display: "flex",
                  flexDirection: "column",
                  alignItems:
                    valueAlign === "right" ? "flex-end" : "flex-start",
                }}
              >
                {row.title ? (
                  <Tooltip title={row.title}>{valueNode}</Tooltip>
                ) : (
                  valueNode
                )}
                {row.hint && (
                  <Typography variant="caption" color="text.secondary">
                    {row.hint}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

KeyValueList.propTypes = {
  rows: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
  ),
  title: PropTypes.node,
  dense: PropTypes.bool,
  valueAlign: PropTypes.oneOf(["right", "left"]),
  dividers: PropTypes.bool,
  showEmpty: PropTypes.bool,
  emptyValue: PropTypes.node,
  sx: PropTypes.object,
};
