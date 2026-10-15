import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Alert, Box, Chip, CircularProgress, Typography } from "@mui/material";
import { ErrorOutline, ReportProblemOutlined } from "@mui/icons-material";
import { issueLabel } from "../data/labels";

/**
 * Validation summary of every available row (R26): counts per issue with
 * example row numbers, blocking vs warning, and the "validated on a sample"
 * caveat for DashAI datasets (only a ≤10-row sample is readable).
 *
 * @param {object} props
 * @param {object|null} props.validation result of sft.validateRows
 * @param {boolean} [props.sampled] rows are a sample of the dataset
 * @param {number} [props.totalRows] declared dataset size
 * @param {boolean} [props.loading]
 * @param {boolean} [props.formatMissing] no format/mapping yet
 * @param {boolean} [props.compact] no outer heading row
 */
export default function ValidationReport({
  validation,
  sampled,
  totalRows,
  loading,
  formatMissing,
  compact,
}) {
  const { t } = useTranslation(["fineTuning", "common"]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          {t("fineTuning:dataPrep.validation.loading")}
        </Typography>
      </Box>
    );
  }
  if (formatMissing || !validation) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t("fineTuning:dataPrep.validation.pending")}
      </Typography>
    );
  }

  const issues = Array.isArray(validation.issues) ? validation.issues : [];
  const blockingCount = issues.filter((i) => i.blocking).length;
  const checked = validation.total || 0;
  const sampleCaveat = sampled ? (
    <Alert severity="info" sx={{ py: 0.5 }}>
      {t("fineTuning:validation.sampled", { rows: checked })}
      {totalRows > checked && (
        <Typography variant="caption" component="p" color="text.secondary">
          {t("fineTuning:dataPrep.validation.sampledOf", {
            rows: checked,
            total: totalRows,
          })}
        </Typography>
      )}
    </Alert>
  ) : null;

  if (checked === 0) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Alert severity="error" sx={{ py: 0.5 }}>
          {t("fineTuning:dataPrep.validation.noRows")}
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 3 }}
      aria-live="polite"
    >
      {!compact && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Typography variant="body2">
            {t("fineTuning:dataPrep.validation.summary", {
              valid: validation.validCount,
              total: checked,
            })}
          </Typography>
          {blockingCount > 0 ? (
            <Chip
              size="small"
              color="error"
              variant="outlined"
              label={t("fineTuning:dataPrep.validation.blockingCount", {
                count: blockingCount,
              })}
            />
          ) : (
            <Chip
              size="small"
              color="success"
              variant="outlined"
              label={t("fineTuning:dataPrep.validation.noBlocking")}
            />
          )}
        </Box>
      )}

      {issues.length === 0 ? (
        <Alert severity="success" sx={{ py: 0.5 }}>
          {t("fineTuning:validation.allValid")}
        </Alert>
      ) : (
        <Box
          component="ul"
          sx={{
            listStyle: "none",
            m: 0,
            p: 0,
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          {issues.map((issue, index) => {
            const Icon = issue.blocking ? ErrorOutline : ReportProblemOutlined;
            const rowsText = (
              issue.rowNumbers || (issue.rows || []).map((r) => r + 1)
            ).join(", ");
            const more = issue.count > (issue.rows || []).length;
            return (
              <Box
                component="li"
                key={`${issue.code}-${issue.column || ""}`}
                sx={{
                  display: "flex",
                  gap: 2,
                  alignItems: "flex-start",
                  px: 3,
                  py: 2,
                  borderTop: index === 0 ? 0 : 1,
                  borderColor: "divider",
                }}
              >
                <Icon
                  fontSize="small"
                  color={issue.blocking ? "error" : "warning"}
                  sx={{ mt: 0.25 }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2">
                    {issueLabel(issue, t)}
                  </Typography>
                  {rowsText && issue.code !== "missing_column" && (
                    <Typography variant="caption" color="text.secondary">
                      {more
                        ? t("fineTuning:dataPrep.validation.exampleRowsMore", {
                            rows: rowsText,
                          })
                        : t("fineTuning:dataPrep.validation.exampleRows", {
                            rows: rowsText,
                          })}
                    </Typography>
                  )}
                </Box>
                <Chip
                  size="small"
                  variant="outlined"
                  color={issue.blocking ? "error" : "warning"}
                  label={
                    issue.blocking
                      ? t("fineTuning:validation.blocking")
                      : t("fineTuning:validation.warning")
                  }
                />
              </Box>
            );
          })}
        </Box>
      )}
      {blockingCount > 0 && (
        <Typography variant="caption" color="text.secondary">
          {t("fineTuning:dataPrep.validation.noSilentFix")}
        </Typography>
      )}
      {sampleCaveat}
    </Box>
  );
}

ValidationReport.propTypes = {
  validation: PropTypes.object,
  sampled: PropTypes.bool,
  totalRows: PropTypes.number,
  loading: PropTypes.bool,
  formatMissing: PropTypes.bool,
  compact: PropTypes.bool,
};
