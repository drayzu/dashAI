import { useMemo } from "react";
import PropTypes from "prop-types";
import { Box, Chip, Paper, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { renderSftExample } from "../data/sft";
import { issueLabel } from "../data/labels";
import { FrozenConfigContent } from "./FrozenConfigAccordion";

/**
 * Compact read-only rendering of one frozen SFT example: context muted,
 * assistant content highlighted as "counts toward loss". (The editable
 * dataPrep/SftExampleView can be injected through FrozenDataPanel's
 * `renderExample` prop.)
 */
export function FrozenSftExample({ messages, maxLength }) {
  const theme = useTheme();
  const { t } = useTranslation(["fineTuning"]);
  const rendered = useMemo(
    () => renderSftExample(messages, { maxLength }),
    [messages, maxLength],
  );
  return (
    <Box>
      <Box
        sx={{
          p: 3,
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          bgcolor: "background.paper",
          fontFamily: "monospace",
          fontSize: "0.75rem",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight: 260,
          overflow: "auto",
        }}
      >
        {rendered.segments.map((seg, i) => (
          <Box
            // Segments are a pure function of the example: index is stable.
            key={`${i}-${seg.kind}`}
            component="span"
            sx={{
              color:
                seg.kind === "special" || !seg.supervised
                  ? "text.secondary"
                  : "text.primary",
              opacity: seg.truncated ? 0.4 : 1,
              textDecoration: seg.truncated ? "line-through" : "none",
              ...(seg.supervised && seg.kind === "content"
                ? {
                    bgcolor: alpha(theme.palette.success.main, 0.1),
                    borderLeft: `2px solid ${theme.palette.success.main}`,
                    pl: 1,
                  }
                : {}),
            }}
          >
            {seg.text}
          </Box>
        ))}
      </Box>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 2,
          mt: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {t("fineTuning:runs.data.tokens", { count: rendered.approxTokens })}
        </Typography>
        <Typography variant="caption" sx={{ color: "success.main" }}>
          {t("fineTuning:runs.data.supervised", {
            count: rendered.supervisedTokens,
          })}
        </Typography>
        {rendered.truncated && (
          <Typography variant="caption" color="warning.main">
            {t("fineTuning:runs.data.truncated")}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

FrozenSftExample.propTypes = {
  messages: PropTypes.arrayOf(PropTypes.object).isRequired,
  maxLength: PropTypes.number,
};

FrozenSftExample.defaultProps = { maxLength: undefined };

/**
 * "Datos SFT" of a run: frozen data summary (format, mapping, counts,
 * fingerprint) + the ≤3 prepared examples stored in the snapshot.
 */
export default function FrozenDataPanel({ run, renderExample, sx }) {
  const { t } = useTranslation(["fineTuning"]);
  const snap = run && run.snapshot;
  if (!snap) return null;
  const ds = snap.dataset || {};
  const maxLength =
    snap.draft && snap.draft.parameters
      ? snap.draft.parameters.maxLength
      : undefined;
  const preview = Array.isArray(ds.preparedPreview) ? ds.preparedPreview : [];
  const issues = Array.isArray(ds.validationIssues) ? ds.validationIssues : [];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4, ...sx }}>
      <Paper
        elevation={0}
        sx={{ p: 4, border: 1, borderColor: "divider", borderRadius: 2 }}
      >
        <FrozenConfigContent
          run={run}
          groups={["data"]}
          showJsonToggle={false}
        />
        {issues.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 3 }}>
            {issues.map((issue) => (
              <Chip
                key={`${issue.code}-${issue.column || ""}`}
                size="small"
                variant="outlined"
                color={issue.blocking ? "error" : "warning"}
                label={issueLabel(issue, t)}
              />
            ))}
          </Box>
        )}
      </Paper>
      <Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            gap: 2,
            mb: 2,
            flexWrap: "wrap",
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {t("fineTuning:runs.data.previewTitle")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("fineTuning:runs.data.previewCaption")}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 3, mb: 3, flexWrap: "wrap" }}>
          <Chip
            size="small"
            variant="outlined"
            color="success"
            label={t("fineTuning:runs.data.legendLoss")}
          />
          <Chip
            size="small"
            variant="outlined"
            label={t("fineTuning:runs.data.legendContext")}
          />
        </Box>
        {preview.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t("fineTuning:runs.data.noPreview")}
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {preview.map((example, index) => (
              <Box key={`${example.sourceIndex ?? index}`}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="div"
                  sx={{ mb: 1 }}
                >
                  {t("fineTuning:runs.data.exampleLabel", {
                    row: (example.sourceIndex ?? index) + 1,
                  })}
                </Typography>
                {renderExample ? (
                  renderExample(example.messages || [], { maxLength, index })
                ) : (
                  <FrozenSftExample
                    messages={example.messages || []}
                    maxLength={maxLength}
                  />
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

FrozenDataPanel.propTypes = {
  run: PropTypes.object,
  renderExample: PropTypes.func,
  sx: PropTypes.object,
};

FrozenDataPanel.defaultProps = {
  run: null,
  renderExample: null,
  sx: {},
};
