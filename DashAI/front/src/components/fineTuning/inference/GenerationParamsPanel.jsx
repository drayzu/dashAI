import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Button,
  Paper,
  Slider,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useTranslation } from "react-i18next";
import SideBar from "../../threeSectionLayout/panelContainers/SideBar";
import { useFineTuningActions, useFineTuningStore } from "../FineTuningContext";
import { chatById } from "../data/selectors";
import { modelDisplayName } from "../data/store";
import { formatNumber } from "./modelAvailability";

export const DEFAULT_GENERATION_PARAMS = Object.freeze({
  temperature: 0.7,
  maxNewTokens: 256,
  topP: 0.9,
});

const FIELDS = [
  { key: "temperature", min: 0, max: 2, step: 0.05, decimals: 2 },
  { key: "topP", min: 0, max: 1, step: 0.05, decimals: 2 },
  { key: "maxNewTokens", min: 1, max: 2048, step: 1, decimals: 0 },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** One parameter: field-card look (FormSchemaFieldCard) with slider + number. */
function ParamField({ field, value, onCommit, disabled }) {
  const { t, i18n } = useTranslation(["fineTuning"]);
  const [local, setLocal] = useState(value);
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setLocal(value);
    setText(String(value));
  }, [value]);

  const commitText = () => {
    const n = Number(String(text).replace(",", "."));
    if (!Number.isFinite(n)) {
      setText(String(value));
      return;
    }
    const clean = clamp(
      field.decimals ? n : Math.round(n),
      field.min,
      field.max,
    );
    setText(String(clean));
    setLocal(clean);
    if (clean !== value) onCommit(clean);
  };

  const textNumber = Number(String(text).replace(",", "."));
  const outOfRange =
    text !== "" &&
    (!Number.isFinite(textNumber) ||
      textNumber < field.min ||
      textNumber > field.max);
  const labelId = `ft-gen-${field.key}`;

  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: 2, bgcolor: "background.paper" }}
    >
      <Box
        sx={{
          px: 4,
          py: 2,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography id={labelId} variant="body2" sx={{ fontWeight: 600 }}>
            {t(`fineTuning:chat.params.${field.key}.label`)}
          </Typography>
          <Tooltip title={t(`fineTuning:chat.params.${field.key}.help`)}>
            <InfoOutlinedIcon
              fontSize="inherit"
              sx={{ color: "text.secondary" }}
            />
          </Tooltip>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {t("fineTuning:chat.params.range", {
            min: formatNumber(field.min, i18n.language, 0),
            max: formatNumber(field.max, i18n.language, 0),
          })}
        </Typography>
      </Box>
      <Box sx={{ px: 4, py: 2, display: "flex", alignItems: "center", gap: 4 }}>
        <Slider
          size="small"
          value={local}
          min={field.min}
          max={field.max}
          step={field.step}
          disabled={disabled}
          onChange={(_, v) => {
            setLocal(v);
            setText(String(v));
          }}
          onChangeCommitted={(_, v) => {
            if (v !== value) onCommit(v);
          }}
          slotProps={{ input: { "aria-labelledby": labelId } }}
          sx={{ flex: 1 }}
        />
        <TextField
          size="small"
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitText();
            }
          }}
          error={outOfRange}
          slotProps={{
            htmlInput: {
              inputMode: "decimal",
              "aria-label": t(`fineTuning:chat.params.${field.key}.label`),
              style: { textAlign: "right" },
            },
          }}
          sx={{ width: 88 }}
        />
      </Box>
      {outOfRange && (
        <Typography
          variant="caption"
          color="error"
          sx={{ display: "block", px: 4, pb: 2 }}
        >
          {t("fineTuning:chat.params.outOfRange", {
            min: field.min,
            max: field.max,
          })}
        </Typography>
      )}
    </Paper>
  );
}

ParamField.propTypes = {
  field: PropTypes.object.isRequired,
  value: PropTypes.number.isRequired,
  onCommit: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

/**
 * Right panel "Parámetros de generación" of the adapter chat (SPEC §4).
 * Temperature (0–2), top_p (0–1) and max new tokens (1–2048). Changes apply
 * only to future messages: each answer keeps the parameters it was
 * generated with (R72).
 *
 * Props:
 * - chatId?: string — chat whose parameters are edited; empty state without it.
 */
export default function GenerationParamsPanel({ chatId }) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const theme = useTheme();
  const store = useFineTuningActions();
  const chat = useFineTuningStore((s) => chatById(s, chatId));
  const modelName = useFineTuningStore((s) => {
    const c = chatById(s, chatId);
    return c ? modelDisplayName(s, c.modelRef) : "";
  });

  const params = (chat && chat.params) || DEFAULT_GENERATION_PARAMS;
  const isDefault = FIELDS.every(
    (f) => params[f.key] === DEFAULT_GENERATION_PARAMS[f.key],
  );

  return (
    <SideBar>
      <Box
        sx={{
          p: 4,
          borderBottom: `1px solid ${theme.palette.ui ? theme.palette.ui.border : theme.palette.divider}`,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          height: 64,
          boxSizing: "border-box",
        }}
      >
        <Typography variant="h6" component="h2" color="text.primary">
          {t("fineTuning:chat.params.title")}
        </Typography>
      </Box>

      {!chat ? (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 4,
          }}
        >
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {t("fineTuning:chat.params.empty")}
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            pt: 4,
            px: 4,
            pb: 10,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <Box>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ letterSpacing: 1 }}
            >
              {t("fineTuning:chat.params.currentModel")}
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, wordBreak: "break-word" }}
            >
              {modelName}
            </Typography>
          </Box>

          {FIELDS.map((field) => (
            <ParamField
              key={field.key}
              field={field}
              value={Number(params[field.key])}
              onCommit={(v) =>
                store.updateChatParams(chat.id, { [field.key]: v })
              }
            />
          ))}

          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              size="small"
              startIcon={<RestartAltIcon fontSize="small" />}
              disabled={isDefault}
              onClick={() =>
                store.updateChatParams(chat.id, {
                  ...DEFAULT_GENERATION_PARAMS,
                })
              }
            >
              {t("fineTuning:chat.params.reset")}
            </Button>
          </Box>

          <Typography variant="caption" color="text.secondary">
            {t("fineTuning:chat.params.futureOnly")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("fineTuning:chat.params.simulatedNote")}
          </Typography>
        </Box>
      )}
    </SideBar>
  );
}

GenerationParamsPanel.propTypes = {
  chatId: PropTypes.string,
};
