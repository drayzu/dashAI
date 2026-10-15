import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Chip,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useTranslation } from "react-i18next";
import SideBar from "../../../components/threeSectionLayout/panelContainers/SideBar";
import { useFineTuningStore } from "../../../components/fineTuning/FineTuningContext";
import { useHardwareProfile } from "../../../components/fineTuning/hooks/useHardwareProfile";
import {
  estimateDraftVram,
  VramRiskChip,
} from "../../../components/fineTuning/common/VramEstimate";
import { formatBytes } from "../../../components/fineTuning/data/catalog";
import { methodLabel } from "../../../components/fineTuning/data/labels";
import Hideable from "../../../components/fineTuning/viewEditing/Hideable";

const selectCheckpoints = (s) => s.checkpoints;
const selectCredential = (s) => Boolean(s.demo && s.demo.hfCredential);
const METHOD_ORDER = ["qlora", "lora"];

/**
 * Availability state of a checkpoint as shown in the list ("Listo",
 * "Se descargará", "Requiere credencial", "Descargando", "Inválido").
 * @returns {{key: string, color: string}}
 */
export function checkpointRowState(checkpoint, credential) {
  if (checkpoint.gated && !credential)
    return { key: "credential", color: "warning" };
  switch (checkpoint.availability) {
    case "ready":
      return { key: "ready", color: "success" };
    case "downloading":
      return { key: "downloading", color: "info" };
    case "invalid":
      return { key: "invalid", color: "error" };
    default:
      return { key: "willDownload", color: "default" };
  }
}

function BaseModelRow({
  checkpoint,
  credential,
  parameters,
  hardware,
  onSelect,
}) {
  const theme = useTheme();
  const { t } = useTranslation(["fineTuning"]);
  const state = checkpointRowState(checkpoint, credential);
  const method = checkpoint.methods.includes("qlora")
    ? "qlora"
    : checkpoint.methods[0];
  const estimate = estimateDraftVram(checkpoint, method, parameters);
  const available = hardware ? Number(hardware.vramGb) : null;
  const pct =
    checkpoint.availability === "downloading" && checkpoint.diskBytes
      ? Math.round((checkpoint.downloadedBytes / checkpoint.diskBytes) * 100)
      : null;

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={t("fineTuning:shellB.baseModels.rowAria", {
        name: checkpoint.name,
      })}
      onClick={() => onSelect(checkpoint.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(checkpoint.id);
        }
      }}
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 3,
        p: 3,
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        cursor: "pointer",
        transition: "all 0.2s",
        outline: "none",
        "&:hover, &:focus-visible": {
          bgcolor: "action.hover",
          borderColor: "primary.main",
          transform: "translateX(4px)",
        },
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: theme.palette.ui
            ? theme.palette.ui.border
            : "action.selected",
          color: "primary.main",
          flexShrink: 0,
        }}
      >
        <PsychologyOutlinedIcon fontSize="small" />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}
            noWrap
            title={checkpoint.name}
          >
            {checkpoint.name}
          </Typography>
          {checkpoint.gated && !credential && (
            <Tooltip
              title={t("fineTuning:shellB.baseModels.credentialTooltip")}
            >
              <LockOutlinedIcon fontSize="small" color="warning" />
            </Tooltip>
          )}
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          component="p"
          noWrap
        >
          {t("fineTuning:shellB.baseModels.meta", {
            params: checkpoint.parametersB,
            size: formatBytes(checkpoint.diskBytes),
          })}
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          sx={{ mt: 1.5 }}
        >
          <Chip
            size="small"
            variant="outlined"
            color={state.color}
            label={
              pct !== null
                ? t("fineTuning:shellB.baseModels.state.downloadingPct", {
                    pct,
                  })
                : t(`fineTuning:shellB.baseModels.state.${state.key}`)
            }
          />
          <Hideable
            id="b.baseModels.methodChips"
            label={t("fineTuning:viewEditing.sections.bBaseModelsMethodChips")}
            level="full"
            sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}
          >
            {METHOD_ORDER.filter((m) => checkpoint.methods.includes(m)).map(
              (m) => (
                <Chip
                  key={m}
                  size="small"
                  variant="outlined"
                  label={methodLabel(m, t)}
                />
              ),
            )}
          </Hideable>
          <Hideable
            id="b.baseModels.vram"
            label={t("fineTuning:viewEditing.sections.bBaseModelsVram")}
            level="intermediate"
          >
            <VramRiskChip estimatedGb={estimate} availableGb={available} />
          </Hideable>
        </Stack>
        {typeof estimate === "number" && (
          <Hideable
            id="b.baseModels.vram"
            label={t("fineTuning:viewEditing.sections.bBaseModelsVram")}
            level="intermediate"
          >
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              sx={{ mt: 1 }}
            >
              {t("fineTuning:shellB.baseModels.vram", {
                estimated: estimate,
                available: available ?? "?",
                method: methodLabel(method, t),
              })}
            </Typography>
          </Hideable>
        )}
      </Box>
    </Box>
  );
}

BaseModelRow.propTypes = {
  checkpoint: PropTypes.object.isRequired,
  credential: PropTypes.bool,
  parameters: PropTypes.object,
  hardware: PropTypes.object,
  onSelect: PropTypes.func.isRequired,
};

/**
 * Right panel of a B session ("Modelos base entrenables"), like Models'
 * "Available Models" list: search + rows; a click opens RunConfigDialog with
 * that base model preselected.
 *
 * @param {object} props
 * @param {(checkpointId: string) => void} props.onSelect
 * @param {object} [props.parameters] parameters used for the VRAM estimates
 */
export default function BaseModelsPanel({ onSelect, parameters }) {
  const { t } = useTranslation(["fineTuning"]);
  const checkpoints = useFineTuningStore(selectCheckpoints);
  const credential = useFineTuningStore(selectCredential);
  const { profile } = useHardwareProfile();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return checkpoints;
    return checkpoints.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.repository.toLowerCase().includes(q),
    );
  }, [checkpoints, query]);

  return (
    <SideBar>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            px: 4,
            height: 64,
            display: "flex",
            alignItems: "center",
            borderBottom: 1,
            borderColor: "ui.border",
            flexShrink: 0,
          }}
        >
          <Typography variant="h6" component="h2" color="text.primary">
            {t("fineTuning:shellB.baseModels.title")}
          </Typography>
        </Box>
        <Box sx={{ p: 4, pb: 2, flexShrink: 0 }}>
          <TextField
            fullWidth
            size="small"
            placeholder={t("fineTuning:shellB.baseModels.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <SearchIcon sx={{ mr: 2, color: "text.secondary" }} />
                ),
              },
              htmlInput: {
                "aria-label": t("fineTuning:shellB.baseModels.search"),
              },
            }}
          />
          <Hideable
            id="b.baseModels.hint"
            label={t("fineTuning:viewEditing.sections.bBaseModelsHint")}
            level="full"
          >
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              sx={{ mt: 2 }}
            >
              {t("fineTuning:shellB.baseModels.hint")}
            </Typography>
          </Hideable>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 4, pb: 4 }}>
          {filtered.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: "center", py: 4 }}
            >
              {t("fineTuning:shellB.baseModels.noMatch")}
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {filtered.map((ck) => (
                <BaseModelRow
                  key={ck.id}
                  checkpoint={ck}
                  credential={credential}
                  parameters={parameters}
                  hardware={profile}
                  onSelect={onSelect}
                />
              ))}
            </Box>
          )}
          <Hideable
            id="b.baseModels.catalogNote"
            label={t("fineTuning:viewEditing.sections.bBaseModelsCatalogNote")}
            level="full"
          >
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              sx={{ mt: 3 }}
            >
              {t("fineTuning:shellB.baseModels.catalogNote")}
            </Typography>
          </Hideable>
        </Box>
      </Box>
    </SideBar>
  );
}

BaseModelsPanel.propTypes = {
  onSelect: PropTypes.func.isRequired,
  parameters: PropTypes.object,
};
