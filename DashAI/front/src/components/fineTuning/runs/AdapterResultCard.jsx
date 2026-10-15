import PropTypes from "prop-types";
import { Box, Button, Chip, Paper, Tooltip, Typography } from "@mui/material";
import {
  CompareArrows,
  Extension,
  Forum,
  InsertDriveFileOutlined,
  ReceiptLong,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useFineTuningStore } from "../FineTuningContext";
import { adapterById, checkpointById } from "../data/selectors";
import { adapterAvailabilityLabel, availabilityColor } from "../data/labels";
import { formatBytes } from "../data/catalog";
import { formatDuration, formatGb, formatMetric, shortHash } from "./runFormat";

/** Why the adapter cannot be used for inference right now (or null). */
export function adapterUseBlocker(adapter, checkpoint, t) {
  if (!adapter) return t("fineTuning:runs.adapter.blocked.missing");
  if (adapter.availability !== "ready")
    return t(`fineTuning:runs.adapter.blocked.${adapter.availability}`);
  if (!checkpoint || checkpoint.availability !== "ready")
    return t("fineTuning:runs.adapter.blocked.base");
  return null;
}

function Metric({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
    </Box>
  );
}

Metric.propTypes = { label: PropTypes.node, value: PropTypes.node };

/**
 * Published adapter of a finished run: name, availability (independent of the
 * run's success, R62), size, files, manifest hash and actions.
 */
export default function AdapterResultCard({
  adapterId,
  onChat,
  onCompare,
  onProvenance,
  chatLabel,
  sx,
}) {
  const { t } = useTranslation(["fineTuning"]);
  const adapter = useFineTuningStore((s) => adapterById(s, adapterId));
  const checkpoint = useFineTuningStore((s) =>
    adapter ? checkpointById(s, adapter.checkpointId) : null,
  );

  if (!adapter) {
    return (
      <Paper
        elevation={0}
        sx={{ p: 4, border: 1, borderColor: "divider", borderRadius: 2, ...sx }}
      >
        <Typography variant="body2" color="text.secondary">
          {t("fineTuning:runs.adapter.deleted")}
        </Typography>
      </Paper>
    );
  }

  const blocker = adapterUseBlocker(adapter, checkpoint, t);
  const compareBlocker = adapter.availability !== "ready" ? blocker : null;
  const metrics = adapter.metrics || {};

  const withTooltip = (title, node) =>
    title ? (
      <Tooltip title={title}>
        <span>{node}</span>
      </Tooltip>
    ) : (
      node
    );

  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        border: 1,
        borderColor:
          adapter.availability === "ready" ? "divider" : "warning.main",
        borderRadius: 2,
        ...sx,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 3,
          flexWrap: "wrap",
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
            bgcolor: "action.selected",
            color: "primary.main",
            flexShrink: 0,
          }}
        >
          <Extension fontSize="small" />
        </Box>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="caption" color="text.secondary">
            {t("fineTuning:runs.adapter.title")}
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 600, wordBreak: "break-word" }}
            >
              {adapter.name}
            </Typography>
            <Chip
              size="small"
              label={adapterAvailabilityLabel(adapter.availability, t)}
              color={availabilityColor(adapter.availability)}
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t("fineTuning:runs.adapter.dependsOn", {
              base: adapter.checkpointName || adapter.checkpointId,
            })}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          {onChat &&
            withTooltip(
              blocker,
              <Button
                size="small"
                variant="contained"
                startIcon={<Forum fontSize="small" />}
                disabled={Boolean(blocker)}
                onClick={() => onChat(adapter)}
              >
                {chatLabel || t("fineTuning:runs.actions.chat")}
              </Button>,
            )}
          {onCompare &&
            withTooltip(
              compareBlocker,
              <Button
                size="small"
                variant="outlined"
                startIcon={<CompareArrows fontSize="small" />}
                disabled={Boolean(compareBlocker)}
                onClick={() => onCompare(adapter)}
              >
                {t("fineTuning:runs.actions.compare")}
              </Button>,
            )}
          {onProvenance && (
            <Button
              size="small"
              variant="text"
              startIcon={<ReceiptLong fontSize="small" />}
              onClick={() => onProvenance(adapter)}
            >
              {t("fineTuning:runs.actions.provenance")}
            </Button>
          )}
        </Box>
      </Box>

      {adapter.availability !== "ready" && (
        <Typography variant="body2" color="warning.main" sx={{ mt: 3 }}>
          {blocker}
        </Typography>
      )}

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 6, mt: 4 }}>
        <Metric
          label={t("fineTuning:runs.metrics.finalLoss")}
          value={formatMetric(metrics.finalLoss)}
        />
        <Metric
          label={t("fineTuning:runs.metrics.finalEvalLoss")}
          value={formatMetric(metrics.finalEvalLoss)}
        />
        <Metric
          label={t("fineTuning:runs.metrics.duration")}
          value={formatDuration(
            metrics.durationSec != null ? metrics.durationSec * 1000 : null,
          )}
        />
        <Metric
          label={t("fineTuning:runs.metrics.peakVram")}
          value={formatGb(metrics.peakVramGb)}
        />
        <Metric
          label={t("fineTuning:runs.adapter.size")}
          value={formatBytes(adapter.sizeBytes)}
        />
      </Box>

      <Box sx={{ mt: 4, display: "grid", gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {t("fineTuning:runs.adapter.files")}
        </Typography>
        {(adapter.files || []).map((file) => (
          <Box
            key={file.name}
            sx={{ display: "flex", alignItems: "center", gap: 2 }}
          >
            <InsertDriveFileOutlined
              sx={{ fontSize: 16, color: "text.secondary" }}
            />
            <Typography
              variant="body2"
              sx={{
                fontFamily: "monospace",
                flex: 1,
                minWidth: 0,
                wordBreak: "break-all",
              }}
            >
              {file.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatBytes(file.bytes)}
            </Typography>
          </Box>
        ))}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {t("fineTuning:runs.adapter.manifestHash")}
          </Typography>
          <Tooltip title={adapter.manifestHash || ""}>
            <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
              {shortHash(adapter.manifestHash, 16)}
            </Typography>
          </Tooltip>
        </Box>
      </Box>
    </Paper>
  );
}

AdapterResultCard.propTypes = {
  adapterId: PropTypes.string,
  onChat: PropTypes.func,
  onCompare: PropTypes.func,
  onProvenance: PropTypes.func,
  chatLabel: PropTypes.node,
  sx: PropTypes.object,
};

AdapterResultCard.defaultProps = {
  adapterId: null,
  onChat: null,
  onCompare: null,
  onProvenance: null,
  chatLabel: null,
  sx: {},
};
