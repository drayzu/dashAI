import { useId } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { CheckCircleOutline, CheckOutlined } from "@mui/icons-material";
import {
  OPTIONAL_FIELDS,
  REQUIRED_FIELDS,
  SFT_FORMATS,
  missingMappingFields,
  suggestMapping,
} from "../data/sft";
import { formatLabel } from "../data/labels";
import { isAutoConfirmed } from "./useDataPreparation";

const NONE = "__none__";
const SAMPLE_CHARS = 70;

function preview(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > SAMPLE_CHARS ? `${flat.slice(0, SAMPLE_CHARS)}…` : flat;
}

/**
 * Format + column mapping editor (R20/R21). Value/onChange API:
 *
 * @param {object} props
 * @param {{format, mapping, systemPrompt, formatConfirmed}} props.value
 * @param {(patch: object) => void} props.onChange patch with whole `mapping`;
 *   any change resets `formatConfirmed` to false
 * @param {string[]} props.columns dataset columns
 * @param {{format, confidence, reason}|null} [props.detection]
 * @param {object} [props.sampleRow] first row, to show example values
 * @param {boolean} [props.disabled]
 */
export default function FormatMappingEditor({
  value,
  onChange,
  columns,
  detection,
  sampleRow,
  disabled,
}) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const uid = useId();
  const v = value || {};
  const format = v.format || null;
  const mapping = v.mapping || {};
  const cols = Array.isArray(columns) ? columns : [];
  const missing = format ? missingMappingFields(format, mapping) : [];
  const autoConfirmed = isAutoConfirmed(detection, format);
  const confirmed =
    Boolean(format) && (Boolean(v.formatConfirmed) || autoConfirmed);
  const emit = (patch) => onChange && onChange(patch);

  const requiredFields = format ? REQUIRED_FIELDS[format] || [] : [];
  const optionalFields = format ? OPTIONAL_FIELDS[format] || [] : [];
  const fields = [...requiredFields, ...optionalFields];
  const usedTwice = (() => {
    const values = requiredFields.map((f) => mapping[f]).filter(Boolean);
    return values.length !== new Set(values).size;
  })();

  const handleFormat = (event) => {
    const next = event.target.value === NONE ? null : event.target.value;
    emit({
      format: next,
      mapping: next ? suggestMapping(next, cols) : {},
      formatConfirmed: false,
    });
  };
  const handleField = (field) => (event) => {
    const col = event.target.value;
    const nextMapping = { ...mapping };
    if (col === NONE) delete nextMapping[field];
    else nextMapping[field] = col;
    emit({ mapping: nextMapping, formatConfirmed: false });
  };

  const detectedColumns =
    detection && detection.format === format
      ? fields
          .map((f) => mapping[f])
          .filter(Boolean)
          .join(", ")
      : "";

  let alert = null;
  if (detection) {
    if (detection.reason === "text_only") {
      alert = (
        <Alert severity="warning" sx={{ py: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {t("fineTuning:dataPrep.mapping.textOnlyTitle")}
          </Typography>
          <Typography variant="body2">
            {t("fineTuning:dataPrep.mapping.textOnlyBody")}
          </Typography>
        </Alert>
      );
    } else if (detection.format && detection.confidence === "high") {
      alert = (
        <Alert severity="success" sx={{ py: 0.5 }}>
          {t("fineTuning:dataPrep.mapping.detectedHigh", {
            format: formatLabel(detection.format, t),
            columns: detectedColumns || "—",
          })}
        </Alert>
      );
    } else if (detection.format) {
      alert = (
        <Alert severity="warning" sx={{ py: 0.5 }}>
          {t("fineTuning:dataPrep.mapping.detectedMedium", {
            format: formatLabel(detection.format, t),
            columns: detectedColumns || "—",
          })}
          <Typography variant="caption" component="p" color="text.secondary">
            {t(`fineTuning:datasets.detection.${detection.reason}`, {
              defaultValue: "",
            })}
          </Typography>
        </Alert>
      );
    } else {
      alert = (
        <Alert severity="info" sx={{ py: 0.5 }}>
          {t(`fineTuning:datasets.detection.${detection.reason || "no_match"}`)}
        </Alert>
      );
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {alert}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl fullWidth size="small" disabled={disabled}>
            <InputLabel id={`${uid}-format`}>
              {t("fineTuning:dataPrep.mapping.format")}
            </InputLabel>
            <Select
              labelId={`${uid}-format`}
              label={t("fineTuning:dataPrep.mapping.format")}
              value={format || NONE}
              onChange={handleFormat}
            >
              <MenuItem value={NONE}>
                <em>{t("fineTuning:dataPrep.mapping.chooseFormat")}</em>
              </MenuItem>
              {SFT_FORMATS.map((f) => (
                <MenuItem key={f} value={f}>
                  {formatLabel(f, t)}
                  {detection && detection.format === f && (
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t("fineTuning:dataPrep.mapping.suggested")}
                      sx={{ ml: 2 }}
                    />
                  )}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              {format
                ? t(`fineTuning:dataPrep.mapping.formatHelp.${format}`)
                : " "}
            </FormHelperText>
          </FormControl>
        </Grid>
      </Grid>

      {format && (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 2 }}>
            {t("fineTuning:dataPrep.mapping.columnsTitle")}
          </Typography>
          <Grid container spacing={3}>
            {fields.map((field) => {
              const optional = optionalFields.includes(field);
              const col = mapping[field];
              const isMissing = missing.includes(field);
              const example = col && sampleRow ? preview(sampleRow[col]) : "";
              const labelId = `${uid}-map-${field}`;
              return (
                <Grid key={field} size={{ xs: 12, sm: 6, md: 4 }}>
                  <FormControl
                    fullWidth
                    size="small"
                    error={isMissing}
                    disabled={disabled}
                  >
                    <InputLabel id={labelId}>
                      {t(`fineTuning:datasets.fields.${field}`)}
                    </InputLabel>
                    <Select
                      labelId={labelId}
                      label={t(`fineTuning:datasets.fields.${field}`)}
                      value={col && cols.includes(col) ? col : NONE}
                      onChange={handleField(field)}
                    >
                      <MenuItem value={NONE}>
                        <em>
                          {optional
                            ? t("fineTuning:dataPrep.mapping.noColumn")
                            : t("fineTuning:dataPrep.mapping.chooseColumn")}
                        </em>
                      </MenuItem>
                      {cols.map((c) => (
                        <MenuItem
                          key={c}
                          value={c}
                          sx={{
                            fontFamily: (th) =>
                              th.typography.code?.fontFamily || "monospace",
                          }}
                        >
                          {c}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText
                      sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isMissing
                        ? t("fineTuning:dataPrep.mapping.required")
                        : example
                          ? t("fineTuning:dataPrep.mapping.example", {
                              value: example,
                            })
                          : " "}
                    </FormHelperText>
                  </FormControl>
                </Grid>
              );
            })}
          </Grid>
          {usedTwice && (
            <Typography
              variant="caption"
              color="warning.main"
              component="p"
              sx={{ mt: 1 }}
            >
              {t("fineTuning:dataPrep.mapping.sameColumn")}
            </Typography>
          )}
        </Box>
      )}

      {format && (
        <TextField
          size="small"
          fullWidth
          multiline
          minRows={2}
          maxRows={6}
          disabled={disabled}
          label={t("fineTuning:dataPrep.mapping.systemPrompt")}
          placeholder={t("fineTuning:dataPrep.mapping.systemPromptPlaceholder")}
          helperText={
            format === "messages"
              ? t("fineTuning:dataPrep.mapping.systemPromptHelpMessages")
              : t("fineTuning:dataPrep.mapping.systemPromptHelp")
          }
          value={v.systemPrompt || ""}
          onChange={(e) => emit({ systemPrompt: e.target.value })}
        />
      )}

      {format && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            flexWrap: "wrap",
          }}
        >
          {confirmed ? (
            <Chip
              color="success"
              variant="outlined"
              size="small"
              icon={<CheckCircleOutline fontSize="small" />}
              label={
                autoConfirmed && !v.formatConfirmed
                  ? t("fineTuning:dataPrep.mapping.autoConfirmed")
                  : t("fineTuning:dataPrep.mapping.confirmed")
              }
            />
          ) : (
            <Button
              variant="contained"
              size="small"
              startIcon={<CheckOutlined fontSize="small" />}
              disabled={disabled || missing.length > 0}
              onClick={() => emit({ formatConfirmed: true })}
            >
              {t("fineTuning:dataPrep.mapping.confirm")}
            </Button>
          )}
          <Typography variant="caption" color="text.secondary">
            {confirmed
              ? t("fineTuning:dataPrep.mapping.confirmedHelp")
              : missing.length > 0
                ? t("fineTuning:dataPrep.mapping.confirmMissing")
                : t("fineTuning:dataPrep.mapping.confirmHelp")}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

FormatMappingEditor.propTypes = {
  value: PropTypes.shape({
    format: PropTypes.string,
    mapping: PropTypes.object,
    systemPrompt: PropTypes.string,
    formatConfirmed: PropTypes.bool,
  }),
  onChange: PropTypes.func,
  columns: PropTypes.arrayOf(PropTypes.string),
  detection: PropTypes.object,
  sampleRow: PropTypes.object,
  disabled: PropTypes.bool,
};
