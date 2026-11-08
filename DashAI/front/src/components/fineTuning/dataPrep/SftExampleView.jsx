import { useMemo } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Box, Chip, Paper, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { ContentCutOutlined } from "@mui/icons-material";
import { renderSftExample } from "../data/sft";

const TRUNCATED_PREVIEW_CHARS = 280;

/** Groups rendered segments by message (each message starts with <|im_start|>). */
export function groupSegments(segments) {
  const groups = [];
  (segments || []).forEach((seg) => {
    const startsMessage =
      seg.kind === "special" && String(seg.text).startsWith("<|im_start|>");
    if (startsMessage || groups.length === 0)
      groups.push({ role: seg.role, segments: [] });
    groups[groups.length - 1].segments.push(seg);
  });
  return groups;
}

function roleLabel(role, t) {
  return t(`fineTuning:dataPrep.example.roles.${role}`, {
    defaultValue: role || "",
  });
}

/** Two-swatch legend: context (no loss) vs assistant (counts toward loss). */
export function SftLegend() {
  const { t } = useTranslation(["fineTuning"]);
  const theme = useTheme();
  const swatch = (supervised) => ({
    width: 12,
    height: 12,
    borderRadius: 0.5,
    flexShrink: 0,
    border: 1,
    borderColor: supervised ? "success.main" : "divider",
    borderLeftWidth: supervised ? 3 : 1,
    bgcolor: supervised
      ? alpha(theme.palette.success.main, 0.1)
      : "transparent",
  });
  return (
    <Box
      sx={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}
    >
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
        <Box sx={swatch(false)} />
        <Typography variant="caption" color="text.secondary">
          {t("fineTuning:dataPrep.example.legendContext")}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
        <Box sx={swatch(true)} />
        <Typography variant="caption" color="text.secondary">
          {t("fineTuning:dataPrep.example.legendSupervised")}
        </Typography>
      </Box>
      <Typography
        variant="caption"
        color="text.disabled"
        sx={{ ...theme.typography.code }}
      >
        {"<|im_start|>"}
        <Typography
          component="span"
          variant="caption"
          color="text.secondary"
          sx={{ ml: 1 }}
        >
          {t("fineTuning:dataPrep.example.legendSpecial")}
        </Typography>
      </Typography>
    </Box>
  );
}

/**
 * Renders one SFT example as the model sees it (ChatML-like template) and
 * marks which parts count toward the loss (R23/R24): context segments are
 * muted ("Sin pérdida"), assistant content is highlighted ("Aporta a la
 * pérdida"), special tokens are monospace and muted, segments beyond the
 * maximum length are shown after a truncation marker.
 *
 * @param {object} props
 * @param {object} [props.rendered] output of renderSftExample
 * @param {{role, content}[]} [props.messages] used when `rendered` is absent
 * @param {number} [props.maxLength] with `messages`
 * @param {string} [props.title] e.g. "Ejemplo 1 · fila 3"
 * @param {boolean} [props.showLegend]
 * @param {number|string} [props.maxHeight] scroll area height
 */
export default function SftExampleView({
  rendered,
  messages,
  maxLength,
  title,
  showLegend,
  maxHeight,
}) {
  const { t } = useTranslation(["fineTuning"]);
  const theme = useTheme();
  const result = useMemo(
    () =>
      rendered || (messages ? renderSftExample(messages, { maxLength }) : null),
    [rendered, messages, maxLength],
  );
  if (
    !result ||
    !Array.isArray(result.segments) ||
    result.segments.length === 0
  ) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t("fineTuning:dataPrep.example.empty")}
      </Typography>
    );
  }
  const groups = groupSegments(result.segments);
  let markerShown = false;
  const codeSx = {
    ...theme.typography.code,
    color: "text.disabled",
    whiteSpace: "pre-wrap",
  };

  const truncationMarker = (
    <Box
      key="truncation-marker"
      role="note"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        my: 2,
        color: "warning.main",
        borderTop: 1,
        borderStyle: "dashed",
        borderColor: "warning.main",
        pt: 1,
      }}
    >
      <ContentCutOutlined sx={{ fontSize: 14 }} />
      <Typography variant="caption">
        {t("fineTuning:dataPrep.example.truncatedAt", {
          maxLength: maxLength || "",
        })}
      </Typography>
    </Box>
  );

  return (
    <Paper
      elevation={0}
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "background.paper",
      }}
    >
      {(title || showLegend) && (
        <Box
          sx={{
            px: 3,
            py: 2,
            borderBottom: 1,
            borderColor: "divider",
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {title && (
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
          )}
          {showLegend && <SftLegend />}
        </Box>
      )}
      <Box
        sx={{
          p: 3,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          maxHeight,
          overflowY: maxHeight ? "auto" : "visible",
        }}
      >
        {groups.map((group, gi) => {
          const supervisedGroup = group.role === "assistant";
          const children = [];
          group.segments.forEach((seg, si) => {
            if (seg.truncated && !markerShown) {
              markerShown = true;
              children.push(truncationMarker);
            }
            const segKey = `${gi}-${si}`;
            if (seg.kind === "special") {
              children.push(
                <Box
                  component="span"
                  key={segKey}
                  sx={{ ...codeSx, opacity: seg.truncated ? 0.5 : 1 }}
                >
                  {seg.text}
                </Box>,
              );
            } else {
              children.push(
                <Box
                  component="span"
                  key={segKey}
                  sx={{
                    typography: "body2",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    color: seg.supervised ? "text.primary" : "text.secondary",
                    opacity: seg.truncated ? 0.45 : 1,
                    textDecoration: seg.truncated ? "line-through" : "none",
                  }}
                >
                  {seg.truncated && seg.text.length > TRUNCATED_PREVIEW_CHARS
                    ? `${seg.text.slice(0, TRUNCATED_PREVIEW_CHARS)}…`
                    : seg.text}
                </Box>,
              );
            }
          });
          return (
            <Box
              key={`g-${gi}`}
              sx={{
                borderLeft: 3,
                borderColor: supervisedGroup ? "success.main" : "divider",
                bgcolor: supervisedGroup
                  ? alpha(theme.palette.success.main, 0.08)
                  : "transparent",
                borderRadius: 1,
                px: 3,
                py: 2,
              }}
            >
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}
              >
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 600 }}
                  color="text.secondary"
                >
                  {roleLabel(group.role, t)}
                </Typography>
                {supervisedGroup ? (
                  <Chip
                    size="small"
                    color="success"
                    variant="outlined"
                    label={t("fineTuning:dataPrep.example.supervised")}
                  />
                ) : (
                  <Typography variant="caption" color="text.disabled">
                    {t("fineTuning:dataPrep.example.context")}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: "block" }}>{children}</Box>
            </Box>
          );
        })}
      </Box>
      <Box
        sx={{
          px: 3,
          py: 2,
          borderTop: 1,
          borderColor: "divider",
          display: "flex",
          flexWrap: "wrap",
          gap: 3,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {t("fineTuning:dataPrep.example.tokens", {
            count: result.approxTokens,
          })}
        </Typography>
        <Typography variant="caption" color="success.main">
          {t("fineTuning:dataPrep.example.supervisedTokens", {
            count: result.supervisedTokens,
          })}
        </Typography>
        {result.truncated && (
          <Typography variant="caption" color="warning.main">
            {t("fineTuning:dataPrep.example.truncated", {
              maxLength: maxLength || "",
            })}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

SftExampleView.propTypes = {
  rendered: PropTypes.object,
  messages: PropTypes.arrayOf(PropTypes.object),
  maxLength: PropTypes.number,
  title: PropTypes.node,
  showLegend: PropTypes.bool,
  maxHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
