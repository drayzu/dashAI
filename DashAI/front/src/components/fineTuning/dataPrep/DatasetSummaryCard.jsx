import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import {
  CloseOutlined,
  StorageOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import PrepSection from "./PrepSection";
import { datasetDescription, datasetName, formatLabel } from "../data/labels";

const MAX_CHIPS = 12;

/**
 * Selected dataset summary: name, source, rows, column chips, detected
 * format, "Ver dataset" and "Quitar".
 *
 * @param {object} props
 * @param {object} props.dataset DatasetRef
 * @param {object} [props.datasetState] from useDataPreparation
 * @param {string|null} [props.format] chosen format
 * @param {boolean} [props.formatConfirmed] effective confirmation
 * @param {() => void} [props.onPreview]
 * @param {() => void} [props.onRemove]
 * @param {() => void} [props.onRetry] retry loading rows
 * @param {boolean} [props.disabled]
 */
export default function DatasetSummaryCard({
  dataset,
  datasetState,
  format,
  formatConfirmed,
  onPreview,
  onRemove,
  onRetry,
  disabled,
}) {
  const { t } = useTranslation(["fineTuning", "common"]);
  if (!dataset) return null;
  const state = datasetState || {};
  const columns =
    (state.columns && state.columns.length ? state.columns : dataset.columns) ||
    [];
  const totalRows = state.totalRows || dataset.totalRows || 0;
  const description = datasetDescription(dataset, t);
  const sampledRows = state.rows ? state.rows.length : 0;

  return (
    <PrepSection
      icon={StorageOutlined}
      title={datasetName(dataset, t)}
      subtitle={description || t("fineTuning:dataPrep.summary.dashaiSubtitle")}
      action={
        <Stack direction="row" spacing={1}>
          {onPreview && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<VisibilityOutlined fontSize="small" />}
              onClick={onPreview}
              disabled={state.loading || state.status === "error"}
            >
              {t("fineTuning:dataPrep.summary.view")}
            </Button>
          )}
          {onRemove && (
            <Button
              size="small"
              color="inherit"
              startIcon={<CloseOutlined fontSize="small" />}
              onClick={onRemove}
              disabled={disabled}
              sx={{ color: "text.secondary" }}
            >
              {t("fineTuning:dataPrep.summary.remove")}
            </Button>
          )}
        </Stack>
      }
    >
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          alignItems: "center",
          mb: 3,
        }}
      >
        <Chip
          size="small"
          variant="outlined"
          color={dataset.source === "dashai" ? "primary" : "default"}
          label={t(`fineTuning:datasets.source.${dataset.source}`)}
        />
        <Typography variant="body2" color="text.secondary">
          {t("fineTuning:datasets.rowsCols", {
            rows: totalRows,
            cols: columns.length || "?",
          })}
        </Typography>
        {format && (
          <Chip
            size="small"
            variant="outlined"
            color={formatConfirmed ? "success" : "warning"}
            label={formatLabel(format, t)}
          />
        )}
      </Box>

      {state.loading && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" color="text.secondary">
            {t("fineTuning:dataPrep.summary.loadingRows")}
          </Typography>
          <LinearProgress sx={{ mt: 1, height: 4, borderRadius: 2 }} />
        </Box>
      )}

      {columns.length > 0 && (
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            component="p"
            sx={{ mb: 1 }}
          >
            {t("fineTuning:dataPrep.summary.columns")}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {columns.slice(0, MAX_CHIPS).map((c) => (
              <Chip
                key={c}
                size="small"
                variant="outlined"
                label={c}
                sx={{
                  fontFamily: (th) =>
                    th.typography.code?.fontFamily || "monospace",
                }}
              />
            ))}
            {columns.length > MAX_CHIPS && (
              <Chip size="small" label={`+${columns.length - MAX_CHIPS}`} />
            )}
          </Box>
        </Box>
      )}

      {state.status === "error" && (
        <Alert
          severity="error"
          sx={{ mt: 3, py: 0.5 }}
          action={
            onRetry ? (
              <Button size="small" color="inherit" onClick={onRetry}>
                {t("fineTuning:dataPrep.summary.retry")}
              </Button>
            ) : null
          }
        >
          {t("fineTuning:dataPrep.summary.loadError")}
        </Alert>
      )}
      {state.status === "ready" && dataset.source === "dashai" && (
        <Typography
          variant="caption"
          color="text.secondary"
          component="p"
          sx={{ mt: 3 }}
        >
          {state.offline
            ? t("fineTuning:dataPrep.summary.offlineSample", {
                rows: sampledRows,
              })
            : t("fineTuning:dataPrep.summary.dashaiSample", {
                rows: sampledRows,
                total: totalRows,
              })}
        </Typography>
      )}
    </PrepSection>
  );
}

DatasetSummaryCard.propTypes = {
  dataset: PropTypes.object,
  datasetState: PropTypes.object,
  format: PropTypes.string,
  formatConfirmed: PropTypes.bool,
  onPreview: PropTypes.func,
  onRemove: PropTypes.func,
  onRetry: PropTypes.func,
  disabled: PropTypes.bool,
};
