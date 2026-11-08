import { useEffect, useMemo } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { useTranslation } from "react-i18next";
import {
  VIEW_LEVELS,
  useViewRegistry,
  useViewState,
  viewStore,
} from "./viewStore";

const isEditableTarget = (target) =>
  target &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * Mount once per prototype shell. Registers the discreet shortcut
 * Ctrl+Shift+E (Cmd+Shift+E on macOS) and shows a floating toolbar while
 * edit mode is on: level presets, the blocks hidden on this screen, "show
 * all" and "done". Renders nothing outside edit mode.
 */
export default function ViewEditingLayer() {
  const { t } = useTranslation(["fineTuning"]);
  const view = useViewState();
  const registry = useViewRegistry();

  useEffect(() => {
    const onKeyDown = (event) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "e" &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault();
        viewStore.toggleEditMode();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const hiddenHere = useMemo(
    () =>
      Object.entries(registry)
        .filter(([id, meta]) => !viewStore.isVisible(id, meta.level))
        .map(([id, meta]) => ({ id, ...meta })),
    // view is a dependency because visibility depends on level/overrides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registry, view],
  );

  if (!view.editMode) return null;

  return (
    <Paper
      elevation={8}
      role="toolbar"
      aria-label={t("fineTuning:viewEditing.toolbarLabel")}
      sx={{
        position: "fixed",
        left: "50%",
        bottom: 16,
        transform: "translateX(-50%)",
        zIndex: 1400,
        width: { xs: "calc(100vw - 32px)", md: 720 },
        maxWidth: "calc(100vw - 32px)",
        p: 3,
        border: 1,
        borderColor: "primary.main",
        borderRadius: 2,
        backgroundImage: "none",
        bgcolor: "background.paper",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={3} flexWrap="wrap">
        <EditOutlinedIcon color="primary" fontSize="small" />
        <Box sx={{ flex: 1, minWidth: 180 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {t("fineTuning:viewEditing.title")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("fineTuning:viewEditing.hint")}
          </Typography>
        </Box>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={Object.keys(view.overrides).length ? null : view.level}
          onChange={(_, level) => level && viewStore.setLevel(level)}
          aria-label={t("fineTuning:viewEditing.levelLabel")}
        >
          {VIEW_LEVELS.map((level) => (
            <Tooltip
              key={level}
              title={t(`fineTuning:viewEditing.levels.${level}.description`)}
            >
              <ToggleButton value={level} sx={{ px: 3 }}>
                {t(`fineTuning:viewEditing.levels.${level}.label`)}
              </ToggleButton>
            </Tooltip>
          ))}
        </ToggleButtonGroup>
      </Stack>

      <Divider sx={{ my: 2 }} />

      <Stack
        direction="row"
        alignItems="center"
        spacing={2}
        useFlexGap
        flexWrap="wrap"
      >
        <Typography variant="caption" color="text.secondary">
          {hiddenHere.length
            ? t("fineTuning:viewEditing.hiddenHere", {
                count: hiddenHere.length,
              })
            : t("fineTuning:viewEditing.noneHidden")}
        </Typography>
        {hiddenHere.map((item) => (
          <Tooltip key={item.id} title={t("fineTuning:viewEditing.restore")}>
            <Chip
              size="small"
              variant="outlined"
              clickable
              icon={<VisibilityOffOutlinedIcon />}
              label={item.label}
              onClick={() => viewStore.setVisible(item.id, true, item.level)}
            />
          </Tooltip>
        ))}
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={() => viewStore.showAll()}>
          {t("fineTuning:viewEditing.showAll")}
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={() => viewStore.setEditMode(false)}
        >
          {t("fineTuning:viewEditing.done")}
        </Button>
      </Stack>
    </Paper>
  );
}
