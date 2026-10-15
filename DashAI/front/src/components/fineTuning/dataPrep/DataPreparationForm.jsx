import { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Alert, Box, Button, Typography } from "@mui/material";
import {
  AccountTreeOutlined,
  CallSplitOutlined,
  FactCheckOutlined,
  TableChartOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import PrepSection from "./PrepSection";
import DatasetPicker from "./DatasetPicker";
import DatasetSummaryCard from "./DatasetSummaryCard";
import DatasetPreviewDialog from "./DatasetPreviewDialog";
import FormatMappingEditor from "./FormatMappingEditor";
import ValidationReport from "./ValidationReport";
import SplitEditor from "./SplitEditor";
import SftExampleView, { SftLegend } from "./SftExampleView";

/**
 * The whole data-preparation flow as stacked sections (picker → summary →
 * format/mapping → validation → splits → inline SFT preview). Route-free;
 * used by steps/DataStep (prototype A) and reusable in prototype B's
 * "create SFT session" form.
 *
 * @param {object} props
 * @param {object} props.prep result of useDataPreparation(...)
 * @param {(patch: object) => void} props.onChange same callback given to the hook
 * @param {() => void} [props.onUpload] shows "Subir dataset"
 * @param {boolean} [props.showPreview=true] inline "Vista previa" section
 *   (B shows it in its right panel instead)
 * @param {boolean} [props.showSplits=true]
 * @param {boolean} [props.disabled]
 */
export default function DataPreparationForm({
  prep,
  onChange,
  onUpload,
  showPreview = true,
  showSplits = true,
  disabled = false,
}) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const {
    source,
    dataset,
    datasetState,
    detection,
    format,
    mapping,
    systemPrompt,
    splits,
    maxSamples,
    maxLength,
    formatConfirmed,
    validation,
    examples,
    renderedExamples,
    ready,
    selectDataset,
    clearDataset,
    reload,
  } = prep;
  const loading = datasetState.loading;
  const rowsReady = datasetState.status === "ready";
  const selectError = datasetState.error && datasetState.selectingKey;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <PrepSection
        icon={TableChartOutlined}
        title={t("fineTuning:dataPrep.sections.dataset")}
        subtitle={t("fineTuning:dataPrep.sections.datasetHelp")}
      >
        <DatasetPicker
          value={dataset}
          onChange={selectDataset}
          datasets={source.datasets}
          loading={source.loading}
          backendAvailable={source.backendAvailable}
          loadingKey={loading ? datasetState.selectingKey : null}
          onUpload={onUpload}
          disabled={disabled}
        />
        {selectError && (
          <Alert severity="error" sx={{ mt: 3, py: 0.5 }}>
            {t("fineTuning:dataPrep.summary.loadError")}
          </Alert>
        )}
        {!dataset && !selectError && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            {t("fineTuning:dataPrep.picker.empty")}
          </Typography>
        )}
      </PrepSection>

      {dataset && (
        <DatasetSummaryCard
          dataset={dataset}
          datasetState={datasetState}
          format={format}
          formatConfirmed={formatConfirmed}
          onPreview={() => setPreviewOpen(true)}
          onRemove={clearDataset}
          onRetry={reload}
          disabled={disabled}
        />
      )}

      {dataset && rowsReady && (
        <PrepSection
          icon={AccountTreeOutlined}
          title={t("fineTuning:dataPrep.sections.mapping")}
          subtitle={t("fineTuning:dataPrep.sections.mappingHelp")}
        >
          <FormatMappingEditor
            value={{
              format,
              mapping,
              systemPrompt,
              formatConfirmed: prep.rawFormatConfirmed,
            }}
            onChange={onChange}
            columns={datasetState.columns}
            detection={detection}
            sampleRow={datasetState.rows[0]}
            disabled={disabled}
          />
        </PrepSection>
      )}

      {dataset && rowsReady && format && (
        <PrepSection
          icon={FactCheckOutlined}
          title={t("fineTuning:dataPrep.sections.validation")}
          subtitle={t("fineTuning:dataPrep.sections.validationHelp", {
            maxLength,
          })}
        >
          <ValidationReport
            validation={validation}
            sampled={datasetState.sampled}
            totalRows={datasetState.totalRows}
            loading={loading}
            formatMissing={prep.missingFields.length > 0}
          />
        </PrepSection>
      )}

      {dataset && rowsReady && format && showSplits && (
        <PrepSection
          icon={CallSplitOutlined}
          title={t("fineTuning:dataPrep.sections.splits")}
          subtitle={t("fineTuning:dataPrep.sections.splitsHelp")}
        >
          <SplitEditor
            splits={splits}
            maxSamples={maxSamples}
            totalRows={datasetState.totalRows}
            onChange={onChange}
            disabled={disabled}
          />
        </PrepSection>
      )}

      {dataset && rowsReady && format && showPreview && (
        <PrepSection
          icon={VisibilityOutlined}
          title={t("fineTuning:dataPrep.sections.preview")}
          subtitle={t("fineTuning:dataPrep.sections.previewHelp", {
            maxLength,
          })}
          action={
            examples.length > 0 ? (
              <Button
                size="small"
                variant="text"
                onClick={() => setPreviewOpen(true)}
              >
                {t("fineTuning:dataPrep.sections.previewMore")}
              </Button>
            ) : null
          }
        >
          {renderedExamples.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t("fineTuning:dataPrep.example.noneValid")}
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <SftLegend />
              {renderedExamples.map((ex, i) => (
                <SftExampleView
                  key={ex.sourceIndex}
                  rendered={ex.rendered}
                  maxLength={maxLength}
                  title={t("fineTuning:dataPrep.example.title", {
                    n: i + 1,
                    row: ex.rowNumber,
                  })}
                  maxHeight={360}
                />
              ))}
              <Typography variant="caption" color="text.secondary">
                {t("fineTuning:dataPrep.example.approxNote")}
              </Typography>
            </Box>
          )}
        </PrepSection>
      )}

      <DatasetPreviewDialog
        open={previewOpen && Boolean(dataset)}
        onClose={() => setPreviewOpen(false)}
        dataset={dataset}
        columns={datasetState.columns}
        rows={datasetState.rows}
        totalRows={datasetState.totalRows}
        sampled={datasetState.sampled}
        format={format}
        detection={detection}
        ready={ready}
        examples={examples}
        maxLength={maxLength}
      />
    </Box>
  );
}

DataPreparationForm.propTypes = {
  prep: PropTypes.object.isRequired,
  onChange: PropTypes.func,
  onUpload: PropTypes.func,
  showPreview: PropTypes.bool,
  showSplits: PropTypes.bool,
  disabled: PropTypes.bool,
};
