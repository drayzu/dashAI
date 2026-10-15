import { useEffect } from "react";
import PropTypes from "prop-types";
import { Box, Chip, IconButton, Tooltip } from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { useTranslation } from "react-i18next";
import { useViewState, viewStore } from "./viewStore";

/**
 * Wraps a block that the presenter can hide (see viewStore).
 * Outside edit mode a hidden block renders nothing at all, leaving no trace.
 * In edit mode every block gets a dashed outline and an eye toggle; hidden
 * ones stay on screen dimmed so they can be restored.
 *
 * @param {string} id stable, unique id (e.g. "a.home.recentRuns")
 * @param {string} label human label shown in the toolbar list
 * @param {"essential"|"intermediate"|"full"} level minimum preset that shows it
 * @param {object} [sx] sx for the wrapper (e.g. grid placement)
 */
export default function Hideable({ id, label, level = "full", sx, children }) {
  const { t } = useTranslation(["fineTuning"]);
  const view = useViewState();
  const visible = viewStore.isVisible(id, level);

  useEffect(() => viewStore.register(id, { label, level }), [id, label, level]);

  if (!view.editMode) {
    return visible ? children : null;
  }

  const toggleLabel = visible
    ? t("fineTuning:viewEditing.hideBlock", { label })
    : t("fineTuning:viewEditing.showBlock", { label });

  return (
    <Box
      sx={{
        position: "relative",
        outline: "1px dashed",
        outlineColor: visible ? "primary.main" : "divider",
        outlineOffset: 2,
        borderRadius: 2,
        ...sx,
      }}
    >
      <Box
        sx={{
          opacity: visible ? 1 : 0.35,
          filter: visible ? "none" : "grayscale(1)",
          pointerEvents: visible ? "auto" : "none",
        }}
        aria-hidden={!visible}
      >
        {children}
      </Box>
      <Box
        sx={{
          position: "absolute",
          top: 4,
          right: 4,
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        {!visible && (
          <Chip
            size="small"
            label={t("fineTuning:viewEditing.hiddenChip")}
            variant="outlined"
            sx={{ bgcolor: "background.paper" }}
          />
        )}
        <Tooltip title={toggleLabel}>
          <IconButton
            size="small"
            aria-label={toggleLabel}
            onClick={(event) => {
              // Blocks often live inside clickable cards/rows.
              event.stopPropagation();
              viewStore.setVisible(id, !visible, level);
            }}
            onKeyDown={(event) => event.stopPropagation()}
            sx={{
              bgcolor: visible ? "primary.main" : "background.paper",
              color: visible ? "primary.contrastText" : "text.secondary",
              border: 1,
              borderColor: visible ? "primary.main" : "divider",
              "&:hover": {
                bgcolor: visible ? "secondary.main" : "action.hover",
              },
            }}
          >
            {visible ? (
              <VisibilityOutlinedIcon fontSize="small" />
            ) : (
              <VisibilityOffOutlinedIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

Hideable.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  level: PropTypes.oneOf(["essential", "intermediate", "full"]),
  sx: PropTypes.object,
  children: PropTypes.node,
};
