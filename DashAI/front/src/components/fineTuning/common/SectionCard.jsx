import PropTypes from "prop-types";
import { Box, Paper, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

/**
 * Bordered section card used across the fine-tuning steps (the
 * "Model / Dataset / Parameters" cards of Unsloth, in DashAI style):
 * flat Paper + 1px divider border, a header row with an icon tile, title,
 * optional subtitle and a right-aligned `action` slot, then the body.
 *
 * @param {object} props
 * @param {React.ElementType} [props.icon] MUI icon component (not element).
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.subtitle]
 * @param {React.ReactNode} [props.action] right side of the header
 * @param {boolean} [props.disablePadding] body without padding (tables)
 * @param {boolean} [props.dense] smaller paddings (dialogs, side panels)
 * @param {string} [props.id] DOM id (also used for aria-labelledby)
 * @param {object} [props.sx] sx for the Paper
 * @param {object} [props.contentSx] sx for the body Box
 */
export default function SectionCard({
  icon: Icon,
  title,
  subtitle,
  action,
  children,
  disablePadding = false,
  dense = false,
  id,
  sx,
  contentSx,
}) {
  const theme = useTheme();
  const titleId = id ? `${id}-title` : undefined;
  const px = dense ? 3 : 4;
  return (
    <Paper
      component="section"
      id={id}
      aria-labelledby={titleId}
      elevation={0}
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
        backgroundImage: "none",
        overflow: "hidden",
        ...sx,
      }}
    >
      <Box
        sx={{
          px,
          py: dense ? 2 : 3,
          display: "flex",
          alignItems: "center",
          gap: 3,
          borderBottom: children ? 1 : 0,
          borderColor: "divider",
        }}
      >
        {Icon && (
          <Box
            aria-hidden
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "primary.main",
              bgcolor: alpha(theme.palette.primary.main, 0.12),
            }}
          >
            <Icon fontSize="small" />
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            id={titleId}
            variant="subtitle2"
            component="h3"
            sx={{ fontWeight: 600 }}
            color="text.primary"
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" component="p">
              {subtitle}
            </Typography>
          )}
        </Box>
        {action && (
          <Box
            sx={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            {action}
          </Box>
        )}
      </Box>
      {children && (
        <Box sx={{ p: disablePadding ? 0 : px, ...contentSx }}>{children}</Box>
      )}
    </Paper>
  );
}

/**
 * Selectable option card (ComponentSelector / PresetCardList treatment):
 * flat Paper, divider border that turns primary + action.selected when
 * selected, secondary border on hover. Keyboard accessible (role radio by
 * default; wrap a group in role="radiogroup"). Disabled cards stay readable
 * (dimmed) so their reason can be shown inside.
 *
 * @param {object} props
 * @param {boolean} props.selected
 * @param {boolean} [props.disabled]
 * @param {() => void} props.onSelect
 * @param {string} [props.role] "radio" (default) | "button" | "checkbox"
 * @param {string} [props.ariaLabel]
 * @param {object} [props.sx]
 */
export function SelectableCard({
  selected,
  disabled = false,
  onSelect,
  role = "radio",
  ariaLabel,
  children,
  sx,
}) {
  const handleKeyDown = (event) => {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };
  return (
    <Paper
      elevation={0}
      role={role}
      aria-checked={role === "button" ? undefined : Boolean(selected)}
      aria-pressed={role === "button" ? Boolean(selected) : undefined}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={handleKeyDown}
      sx={{
        p: 3,
        position: "relative",
        cursor: disabled ? "not-allowed" : "pointer",
        border: 1,
        borderColor: selected ? "primary.main" : "divider",
        bgcolor: selected ? "action.selected" : "background.paper",
        backgroundImage: "none",
        borderRadius: 1,
        transition: "border-color 0.15s, background 0.15s",
        outline: "none",
        "&:hover": disabled ? undefined : { borderColor: "secondary.main" },
        "&:focus-visible": {
          borderColor: "primary.main",
          boxShadow: (theme) =>
            `0 0 0 2px ${alpha(theme.palette.primary.main, 0.35)}`,
        },
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}

SelectableCard.propTypes = {
  selected: PropTypes.bool,
  disabled: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  role: PropTypes.string,
  ariaLabel: PropTypes.string,
  children: PropTypes.node,
  sx: PropTypes.object,
};

SectionCard.propTypes = {
  icon: PropTypes.elementType,
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  action: PropTypes.node,
  children: PropTypes.node,
  disablePadding: PropTypes.bool,
  dense: PropTypes.bool,
  id: PropTypes.string,
  sx: PropTypes.object,
  contentSx: PropTypes.object,
};
