import { useMemo } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { CloudUploadOutlined } from "@mui/icons-material";
import { datasetName } from "../data/labels";
import { datasetKey } from "./useDataPreparation";

/**
 * Dataset selector: Autocomplete grouped "Datasets de DashAI" / "Ejemplos
 * del prototipo" + optional "Subir dataset" button. Route-free: the parent
 * decides what upload does.
 *
 * @param {object} props
 * @param {object|null} props.value selected DatasetRef ({source, id, ...})
 * @param {(option: object|null) => void} props.onChange receives a dataset
 *   option from useDatasetSource (option.ref is the DatasetRef) or null
 * @param {object[]} props.datasets options from useDatasetSource().datasets
 * @param {boolean} [props.loading] DashAI list still loading
 * @param {boolean} [props.backendAvailable] false → samples only + notice
 * @param {string|null} [props.loadingKey] option key whose rows are loading
 * @param {() => void} [props.onUpload] shows "Subir dataset" when given
 * @param {boolean} [props.disabled]
 */
export default function DatasetPicker({
  value,
  onChange,
  datasets,
  loading,
  backendAvailable,
  loadingKey,
  onUpload,
  disabled,
}) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const options = useMemo(() => {
    const list = Array.isArray(datasets) ? datasets : [];
    // Group order: DashAI first, then samples (Autocomplete needs sorted groups).
    return [
      ...list.filter((o) => o.source === "dashai"),
      ...list.filter((o) => o.source !== "dashai"),
    ];
  }, [datasets]);
  const selectedKey = datasetKey(value);
  const selected = useMemo(() => {
    if (!value) return null;
    return (
      options.find((o) => o.key === selectedKey) || {
        key: selectedKey,
        source: value.source,
        id: value.id,
        name: value.name,
        i18nKey: value.i18nKey,
        totalRows: value.totalRows,
        totalColumns: value.columns ? value.columns.length : null,
        ref: value,
      }
    );
  }, [options, value, selectedKey]);
  const hasDashai = options.some((o) => o.source === "dashai");
  const busy = Boolean(loadingKey);

  const label = (option) => datasetName(option.ref || option, t);
  const dims = (option) => {
    const rows = option.totalRows ?? null;
    const cols =
      option.totalColumns ?? (option.columns ? option.columns.length : null);
    if (rows === null && cols === null) return "";
    return t("fineTuning:datasets.rowsCols", {
      rows: rows ?? "?",
      cols: cols ?? "?",
    });
  };

  const uploadButton = onUpload ? (
    <Tooltip
      title={
        backendAvailable
          ? ""
          : t("fineTuning:dataPrep.picker.uploadUnavailable")
      }
    >
      <span>
        <Button
          variant="outlined"
          size="small"
          startIcon={<CloudUploadOutlined fontSize="small" />}
          onClick={onUpload}
          disabled={disabled || !backendAvailable}
          sx={{ height: 40, whiteSpace: "nowrap" }}
        >
          {t("fineTuning:dataPrep.picker.upload")}
        </Button>
      </span>
    </Tooltip>
  ) : null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box
        sx={{
          display: "flex",
          gap: 2,
          alignItems: "flex-start",
          flexWrap: { xs: "wrap", sm: "nowrap" },
        }}
      >
        <Autocomplete
          fullWidth
          size="small"
          options={options}
          value={selected}
          loading={loading}
          disabled={disabled}
          groupBy={(o) => o.source}
          getOptionLabel={label}
          isOptionEqualToValue={(o, v) => o.key === v.key}
          onChange={(_, option) => onChange && onChange(option || null)}
          noOptionsText={t("fineTuning:dataPrep.picker.noOptions")}
          loadingText={t("fineTuning:dataPrep.picker.loadingList")}
          renderGroup={(params) => (
            <li key={params.key}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ display: "block", px: 4, pt: 2, letterSpacing: 1 }}
              >
                {t(`fineTuning:datasets.groups.${params.group}`)}
              </Typography>
              <Box component="ul" sx={{ p: 0 }}>
                {params.children}
              </Box>
            </li>
          )}
          renderOption={(props, option) => {
            const { key, ...rest } = props;
            return (
              <Box
                component="li"
                key={key}
                {...rest}
                sx={{ display: "flex", gap: 2, alignItems: "center" }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                    {label(option)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {dims(option)}
                  </Typography>
                </Box>
                {loadingKey === option.key && <CircularProgress size={14} />}
                <Chip
                  size="small"
                  variant="outlined"
                  color={option.source === "dashai" ? "primary" : "default"}
                  label={t(`fineTuning:datasets.source.${option.source}`)}
                />
              </Box>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={t("fineTuning:dataPrep.picker.label")}
              placeholder={t("fineTuning:dataPrep.picker.placeholder")}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {(loading || busy) && (
                      <CircularProgress color="inherit" size={16} />
                    )}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
        {uploadButton}
      </Box>
      {!loading && !backendAvailable && (
        <Alert severity="info" sx={{ py: 0.5 }}>
          {t("fineTuning:dataPrep.picker.backendDown")}
        </Alert>
      )}
      {!loading && backendAvailable && !hasDashai && (
        <Typography variant="caption" color="text.secondary">
          {t("fineTuning:dataPrep.picker.noDashai")}
        </Typography>
      )}
    </Box>
  );
}

DatasetPicker.propTypes = {
  value: PropTypes.object,
  onChange: PropTypes.func,
  datasets: PropTypes.arrayOf(PropTypes.object),
  loading: PropTypes.bool,
  backendAvailable: PropTypes.bool,
  loadingKey: PropTypes.string,
  onUpload: PropTypes.func,
  disabled: PropTypes.bool,
};
