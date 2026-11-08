import { useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Button,
  Divider,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useTranslation } from "react-i18next";
import { useFineTuningStore } from "../FineTuningContext";
import { modelDisplayName } from "../data/store";
import { downloadPercent, modelRefStatus } from "./modelAvailability";

const selectPickerData = (s) => ({
  checkpoints: s.checkpoints,
  adapters: s.adapters,
  hfCredential: Boolean(s.demo && s.demo.hfCredential),
});

/** Translated reason why a model reference cannot be selected (or ""). */
export function modelBlockReason(status, t, { gatedLocked = false } = {}) {
  if (!status || status.usable) return "";
  switch (status.reason) {
    case "adapter_deleted":
      return t("fineTuning:chat.picker.reason.adapterDeleted");
    case "adapter_missing":
      return t("fineTuning:chat.picker.reason.adapterMissing");
    case "adapter_invalid":
      return t("fineTuning:chat.picker.reason.adapterInvalid");
    case "base_downloading":
      return t("fineTuning:chat.picker.reason.baseDownloading", {
        percent: downloadPercent(status.checkpoint),
      });
    case "base_invalid":
      return t("fineTuning:chat.picker.reason.baseInvalid");
    case "base_missing":
    case "base_unknown":
      if (gatedLocked) return t("fineTuning:chat.picker.reason.credential");
      return status.adapter
        ? t("fineTuning:chat.picker.reason.adapterBaseMissing", {
            base: status.checkpoint ? status.checkpoint.name : "",
          })
        : t("fineTuning:chat.picker.reason.baseMissing");
    default:
      return t("fineTuning:chat.picker.reason.unavailable");
  }
}

/**
 * Model selector for the adapter chat (R70): a button with the current model
 * and a Menu with two sections, "Modelos base" (trainable catalog
 * checkpoints) and "Adaptados". Items that cannot generate are shown
 * disabled with the reason; nothing is ever silently substituted.
 *
 * Props:
 * - value: {kind: "adapter"|"base", id} | null — current model reference.
 * - onChange(modelRef): called with the chosen reference.
 * - disabled?: boolean
 * - placeholder?: string — button label when `value` is null.
 * - size?: "small" | "medium" (default "small").
 */
export default function ModelPickerMenu({
  value,
  onChange,
  disabled = false,
  placeholder,
  size = "small",
}) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const data = useFineTuningStore(selectPickerData);
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const pseudoState = {
    checkpoints: data.checkpoints,
    adapters: data.adapters,
  };
  const currentName = value ? modelDisplayName(pseudoState, value) : "";
  const currentStatus = value ? modelRefStatus(pseudoState, value) : null;
  const isSelected = (kind, id) =>
    Boolean(value && value.kind === kind && value.id === id);

  const choose = (modelRef) => {
    setAnchorEl(null);
    if (!isSelected(modelRef.kind, modelRef.id) && onChange) onChange(modelRef);
  };

  const adapters = [...data.adapters].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
  );

  return (
    <>
      <Button
        variant="outlined"
        size={size}
        color={currentStatus && !currentStatus.usable ? "warning" : "primary"}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        disabled={disabled}
        endIcon={<ExpandMoreIcon />}
        startIcon={
          value && value.kind === "adapter" ? (
            <ExtensionOutlinedIcon fontSize="small" />
          ) : (
            <SmartToyOutlinedIcon fontSize="small" />
          )
        }
        aria-haspopup="menu"
        aria-expanded={open ? "true" : undefined}
        aria-label={t("fineTuning:chat.picker.ariaLabel", {
          model: currentName || t("fineTuning:chat.picker.none"),
        })}
        sx={{
          textTransform: "none",
          maxWidth: 360,
          justifyContent: "space-between",
        }}
      >
        <Box
          component="span"
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {currentName || placeholder || t("fineTuning:chat.picker.choose")}
        </Box>
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        slotProps={{
          paper: { sx: { minWidth: 320, maxWidth: 420, maxHeight: 520 } },
        }}
      >
        <ListSubheader sx={{ bgcolor: "background.paper", lineHeight: "32px" }}>
          {t("fineTuning:chat.picker.baseSection")}
        </ListSubheader>
        {data.checkpoints.map((ck) => {
          const ref = { kind: "base", id: ck.id };
          const status = modelRefStatus(pseudoState, ref);
          const gatedLocked = Boolean(
            ck.gated && !data.hfCredential && ck.availability !== "ready",
          );
          const reason = modelBlockReason(status, t, { gatedLocked });
          const selected = isSelected("base", ck.id);
          return (
            <MenuItem
              key={`base-${ck.id}`}
              disabled={!status.usable}
              selected={selected}
              onClick={() => choose(ref)}
              dense
            >
              <ListItemIcon>
                {selected ? (
                  <CheckIcon fontSize="small" color="primary" />
                ) : gatedLocked ? (
                  <LockOutlinedIcon fontSize="small" />
                ) : (
                  <SmartToyOutlinedIcon fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={ck.name}
                secondary={reason || ck.repository}
                slotProps={{ secondary: { variant: "caption", noWrap: true } }}
              />
            </MenuItem>
          );
        })}
        <Box sx={{ px: 4, pb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {t("fineTuning:chat.picker.catalogNote")}
          </Typography>
        </Box>
        <Divider />
        <ListSubheader sx={{ bgcolor: "background.paper", lineHeight: "32px" }}>
          {t("fineTuning:chat.picker.adaptedSection")}
        </ListSubheader>
        {adapters.length === 0 && (
          <MenuItem disabled dense>
            <ListItemText
              primary={t("fineTuning:chat.picker.noAdapters")}
              slotProps={{ primary: { variant: "body2" } }}
            />
          </MenuItem>
        )}
        {adapters.map((adapter) => {
          const ref = { kind: "adapter", id: adapter.id };
          const status = modelRefStatus(pseudoState, ref);
          const reason = modelBlockReason(status, t);
          const selected = isSelected("adapter", adapter.id);
          return (
            <MenuItem
              key={`adapter-${adapter.id}`}
              disabled={!status.usable}
              selected={selected}
              onClick={() => choose(ref)}
              dense
            >
              <ListItemIcon>
                {selected ? (
                  <CheckIcon fontSize="small" color="primary" />
                ) : (
                  <ExtensionOutlinedIcon fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={adapter.name}
                secondary={
                  reason ||
                  t("fineTuning:chat.picker.adapterOn", {
                    base: adapter.checkpointName || adapter.checkpointId,
                  })
                }
                slotProps={{ secondary: { variant: "caption", noWrap: true } }}
              />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}

ModelPickerMenu.propTypes = {
  value: PropTypes.shape({
    kind: PropTypes.oneOf(["adapter", "base"]),
    id: PropTypes.string,
  }),
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
  size: PropTypes.oneOf(["small", "medium"]),
};
