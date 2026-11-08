import PropTypes from "prop-types";
import { Box, Typography } from "@mui/material";

/**
 * Centered empty state (DashAI convention: optional faded icon, body2
 * secondary text, caption detail, optional action button below).
 *
 * @param {object} props
 * @param {React.ElementType} [props.icon] MUI icon component
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.description]
 * @param {React.ReactNode} [props.action] e.g. an outlined Button
 * @param {number|string} [props.minHeight] e.g. "50vh" or 200
 * @param {boolean} [props.bordered] dashed divider border (chart placeholders)
 * @param {"page"|"section"} [props.size] "page" uses h6 + body2
 * @param {object} [props.sx]
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  minHeight,
  bordered = false,
  size = "section",
  sx,
}) {
  const page = size === "page";
  return (
    <Box
      role="status"
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 2,
        p: page ? 8 : 4,
        minHeight,
        ...(bordered
          ? { border: "1px dashed", borderColor: "divider", borderRadius: 2 }
          : {}),
        ...sx,
      }}
    >
      {Icon && (
        <Icon
          aria-hidden
          sx={{
            fontSize: page ? 48 : 36,
            color: "text.secondary",
            opacity: 0.4,
          }}
        />
      )}
      <Typography variant={page ? "h6" : "body2"} color="text.secondary">
        {title}
      </Typography>
      {description && (
        <Typography
          variant={page ? "body2" : "caption"}
          color="text.secondary"
          sx={{ maxWidth: 480 }}
        >
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}

EmptyState.propTypes = {
  icon: PropTypes.elementType,
  title: PropTypes.node.isRequired,
  description: PropTypes.node,
  action: PropTypes.node,
  minHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  bordered: PropTypes.bool,
  size: PropTypes.oneOf(["page", "section"]),
  sx: PropTypes.object,
};
