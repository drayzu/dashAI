import { useId, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import ScienceIcon from "@mui/icons-material/Science";
import CheckIcon from "@mui/icons-material/Check";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import MemoryIcon from "@mui/icons-material/Memory";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import {
  useFineTuningActions,
  useFineTuningRoutes,
  useFineTuningStore,
} from "../FineTuningContext";
import { useViewState, viewStore } from "../viewEditing/viewStore";

// Ordered roughly by the phase in which each scenario shows up.
export const DEMO_FAILURE_CODES = [
  "gpu_busy",
  "incomplete_download",
  "invalid_data_full",
  "mask_invalid",
  "oom",
  "nan_loss",
  "grad_norm_warning",
  "interrupted",
  "missing_adapter",
];

export const DEMO_SPEEDS = [1, 4, 20];

const selectDemo = (state) => state?.demo;

const iconButtonSx = {
  width: 32,
  height: 32,
  borderRadius: "4px",
  border: 1,
  borderColor: "divider",
  color: "text.secondary",
  "&:hover": { bgcolor: "action.hover", color: "text.primary" },
};

const menuPaperSx = {
  width: 340,
  maxWidth: "calc(100vw - 32px)",
  "& .MuiMenuItem-root": { whiteSpace: "normal" },
};

const subheaderSx = {
  lineHeight: 1.5,
  pt: 2,
  pb: 1,
  px: 4,
  bgcolor: "transparent",
};

/**
 * Demo controls of the fine-tuning prototypes (header IconButton + menu):
 * failure of the next run, simulation speed, busy GPU, Hugging Face
 * credential, link to the other prototype and reset of the prototype data.
 * Requires <FineTuningProvider>.
 *
 * Props:
 * - otherPrototypeHref?: string   route of the other prototype (A <-> B);
 *   the link is hidden when missing.
 * - otherPrototypeLabel?: string  already translated name of that prototype,
 *   shown as the secondary text of the link.
 */
export default function DemoControlsMenu({
  otherPrototypeHref,
  otherPrototypeLabel,
}) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const actions = useFineTuningActions();
  const routes = useFineTuningRoutes();
  const demo = useFineTuningStore(selectDemo) || {};
  const view = useViewState();

  const menuId = useId();
  const failureMenuId = useId();
  const buttonId = useId();
  const resetTitleId = useId();

  const [anchorEl, setAnchorEl] = useState(null);
  const [failureAnchorEl, setFailureAnchorEl] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const speed = demo.speed || 1;
  const nextFailure = demo.nextFailure || null;
  const gpuBusy = Boolean(demo.gpuBusy);
  const hfCredential = Boolean(demo.hfCredential);
  const hasCustomSettings = Boolean(nextFailure) || gpuBusy || speed !== 1;

  const failureLabel = (code) =>
    code
      ? t(`fineTuning:demo.failures.${code}`)
      : t("fineTuning:demo.noFailure");

  const closeMenus = () => {
    setFailureAnchorEl(null);
    setAnchorEl(null);
  };

  const setDemo = (patch) => actions?.setDemo?.(patch);

  const handleSelectFailure = (code) => {
    setDemo({ nextFailure: code });
    setFailureAnchorEl(null);
  };

  const handleConfirmReset = () => {
    actions?.resetDemo?.();
    setConfirmReset(false);
    enqueueSnackbar(t("fineTuning:demo.resetDone"), { variant: "success" });
    if (routes?.home) navigate(routes.home());
  };

  const buttonTooltip = nextFailure
    ? t("fineTuning:demo.buttonArmed", { failure: failureLabel(nextFailure) })
    : t("fineTuning:demo.button");

  return (
    <>
      <Tooltip title={buttonTooltip}>
        <IconButton
          id={buttonId}
          size="small"
          aria-label={t("fineTuning:demo.button")}
          aria-haspopup="true"
          aria-controls={anchorEl ? menuId : undefined}
          aria-expanded={anchorEl ? "true" : undefined}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={iconButtonSx}
        >
          <Badge
            variant="dot"
            color="warning"
            invisible={!hasCustomSettings}
            overlap="circular"
          >
            <ScienceIcon sx={{ fontSize: 18 }} />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        id={menuId}
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={closeMenus}
        variant="menu"
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          list: { "aria-labelledby": buttonId, dense: true },
          paper: { sx: menuPaperSx },
        }}
      >
        <ListSubheader disableSticky sx={subheaderSx}>
          <Typography
            variant="subtitle2"
            color="text.primary"
            sx={{ fontWeight: 600 }}
          >
            {t("fineTuning:demo.title")}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p">
            {t("fineTuning:demo.subtitle")}
          </Typography>
        </ListSubheader>

        <MenuItem
          role="menuitemcheckbox"
          aria-checked={view.editMode}
          onClick={() => {
            closeMenus();
            viewStore.toggleEditMode();
          }}
        >
          <ListItemIcon>
            <EditOutlinedIcon
              fontSize="small"
              color={view.editMode ? "primary" : "inherit"}
            />
          </ListItemIcon>
          <ListItemText
            primary={
              view.editMode
                ? t("fineTuning:viewEditing.menuItemActive")
                : t("fineTuning:viewEditing.menuItem")
            }
          />
        </MenuItem>

        <Divider />
        <MenuItem
          aria-haspopup="true"
          aria-controls={failureAnchorEl ? failureMenuId : undefined}
          aria-expanded={failureAnchorEl ? "true" : undefined}
          onClick={(e) => setFailureAnchorEl(e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setFailureAnchorEl(e.currentTarget);
          }}
        >
          <ListItemIcon>
            <ReportProblemOutlinedIcon
              fontSize="small"
              color={nextFailure ? "warning" : "inherit"}
            />
          </ListItemIcon>
          <ListItemText
            primary={t("fineTuning:demo.nextFailure")}
            secondary={failureLabel(nextFailure)}
            slotProps={{
              secondary: { color: nextFailure ? "warning.main" : undefined },
            }}
          />
          <ChevronRightIcon fontSize="small" sx={{ color: "text.secondary" }} />
        </MenuItem>

        <Divider />
        <ListSubheader disableSticky sx={subheaderSx}>
          <Typography variant="caption" color="text.secondary">
            {t("fineTuning:demo.speed")}
          </Typography>
        </ListSubheader>
        {DEMO_SPEEDS.map((value) => (
          <MenuItem
            key={value}
            role="menuitemradio"
            aria-checked={speed === value}
            selected={speed === value}
            onClick={() => setDemo({ speed: value })}
          >
            <ListItemIcon>
              {speed === value && (
                <CheckIcon fontSize="small" color="primary" />
              )}
            </ListItemIcon>
            <ListItemText>
              {t(`fineTuning:demo.speedOption.x${value}`)}
            </ListItemText>
          </MenuItem>
        ))}

        <Divider />
        <MenuItem
          role="menuitemcheckbox"
          aria-checked={gpuBusy}
          onClick={() => setDemo({ gpuBusy: !gpuBusy })}
        >
          <ListItemIcon>
            <MemoryIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={t("fineTuning:demo.gpuBusy")}
            secondary={t("fineTuning:demo.gpuBusyHint")}
          />
          <Switch
            size="small"
            edge="end"
            checked={gpuBusy}
            tabIndex={-1}
            sx={{ pointerEvents: "none" }}
            slotProps={{ input: { "aria-hidden": true } }}
          />
        </MenuItem>
        <MenuItem
          role="menuitemcheckbox"
          aria-checked={hfCredential}
          onClick={() => setDemo({ hfCredential: !hfCredential })}
        >
          <ListItemIcon>
            <VpnKeyOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={t("fineTuning:demo.hfCredential")}
            secondary={t("fineTuning:demo.hfCredentialHint")}
          />
          <Switch
            size="small"
            edge="end"
            checked={hfCredential}
            tabIndex={-1}
            sx={{ pointerEvents: "none" }}
            slotProps={{ input: { "aria-hidden": true } }}
          />
        </MenuItem>

        <Divider />
        {Boolean(otherPrototypeHref) && (
          <MenuItem
            component={RouterLink}
            to={otherPrototypeHref}
            onClick={closeMenus}
          >
            <ListItemIcon>
              <SwapHorizIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={t("fineTuning:demo.otherPrototype")}
              secondary={otherPrototypeLabel}
            />
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            closeMenus();
            setConfirmReset(true);
          }}
          sx={{ color: "error.main" }}
        >
          <ListItemIcon sx={{ color: "inherit" }}>
            <RestartAltIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("fineTuning:demo.reset")}</ListItemText>
        </MenuItem>
      </Menu>

      <Menu
        id={failureMenuId}
        anchorEl={failureAnchorEl}
        open={Boolean(failureAnchorEl)}
        onClose={() => setFailureAnchorEl(null)}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          list: { dense: true, "aria-label": t("fineTuning:demo.nextFailure") },
          paper: { sx: menuPaperSx },
        }}
      >
        {[null, ...DEMO_FAILURE_CODES].map((code) => (
          <MenuItem
            key={code || "none"}
            role="menuitemradio"
            aria-checked={nextFailure === code}
            selected={nextFailure === code}
            onClick={() => handleSelectFailure(code)}
          >
            <ListItemIcon>
              {nextFailure === code && (
                <CheckIcon fontSize="small" color="primary" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={failureLabel(code)}
              secondary={
                code
                  ? t(`fineTuning:demo.failureHints.${code}`)
                  : t("fineTuning:demo.noFailureHint")
              }
            />
          </MenuItem>
        ))}
      </Menu>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        aria-labelledby={resetTitleId}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle id={resetTitleId}>
          {t("fineTuning:demo.resetConfirmTitle")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("fineTuning:demo.resetConfirmBody")}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 6, pb: 4 }}>
          <Button
            onClick={() => setConfirmReset(false)}
            sx={{ color: "text.secondary" }}
          >
            {t("common:cancel")}
          </Button>
          <Button onClick={handleConfirmReset} color="error" autoFocus>
            {t("fineTuning:demo.resetConfirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
