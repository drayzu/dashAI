import PropTypes from "prop-types";
import { Box, Chip, Paper, Typography } from "@mui/material";
import { Memory } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import UsageBar from "../common/UsageBar";
import { isActiveStatus } from "../data/selectors";
import { formatGb } from "./runFormat";

/**
 * VRAM / RAM usage of a run (current + peak marker) against the hardware
 * frozen in its snapshot, plus the orientative VRAM estimate. Simulated.
 */
export default function ResourcePanel({ run, showEstimate, sx }) {
  const { t } = useTranslation(["fineTuning"]);
  if (!run) return null;
  const hw = (run.snapshot && run.snapshot.hardware) || {};
  const res = run.resources || {};
  const active = isActiveStatus(run.status);
  const vramMax = Number(hw.vramGb) || null;
  const ramMax = Number(hw.ramGb) || null;
  const estimate = run.snapshot ? run.snapshot.estimatedVramGb : null;
  // While active show the live value; afterwards the bar shows the peak.
  const vramValue = active ? res.vramGb : res.peakVramGb;
  const ramValue = active ? res.ramGb : res.peakRamGb;

  return (
    <Paper
      elevation={0}
      sx={{ p: 4, border: 1, borderColor: "divider", borderRadius: 2, ...sx }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          mb: 4,
          flexWrap: "wrap",
        }}
      >
        <Memory fontSize="small" color="action" />
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {t("fineTuning:runs.resources.title")}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t("fineTuning:charts.simulated")}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {hw.gpuName && (
          <Chip
            size="small"
            variant="outlined"
            label={`${hw.gpuName} · ${t(
              `fineTuning:runs.resources.source.${
                hw.source === "detected" ? "detected" : "simulated"
              }`,
            )}`}
          />
        )}
      </Box>
      <UsageBar
        label={
          active
            ? t("fineTuning:runs.resources.vram")
            : t("fineTuning:runs.resources.vramPeak")
        }
        value={vramValue || 0}
        max={vramMax || undefined}
        peak={active ? res.peakVramGb : undefined}
        peakLabel={t("fineTuning:runs.resources.peak")}
        color="warning"
        detail={
          active
            ? t("fineTuning:runs.resources.peakValue", {
                value: formatGb(res.peakVramGb),
              })
            : null
        }
      />
      <UsageBar
        label={
          active
            ? t("fineTuning:runs.resources.ram")
            : t("fineTuning:runs.resources.ramPeak")
        }
        value={ramValue || 0}
        max={ramMax || undefined}
        peak={active ? res.peakRamGb : undefined}
        peakLabel={t("fineTuning:runs.resources.peak")}
        color="info"
        detail={
          active
            ? t("fineTuning:runs.resources.peakValue", {
                value: formatGb(res.peakRamGb),
              })
            : null
        }
      />
      {showEstimate && typeof estimate === "number" && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 4, mt: 1 }}>
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              component="div"
            >
              {t("fineTuning:runs.resources.estimate")}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {formatGb(estimate)}
            </Typography>
          </Box>
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              component="div"
            >
              {t("fineTuning:runs.resources.vramPeak")}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {res.peakVramGb ? formatGb(res.peakVramGb) : "—"}
            </Typography>
          </Box>
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              component="div"
            >
              {t("fineTuning:runs.resources.available")}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {formatGb(vramMax)}
            </Typography>
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flexBasis: "100%" }}
          >
            {t("fineTuning:runs.resources.estimateNote")}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

ResourcePanel.propTypes = {
  run: PropTypes.object,
  showEstimate: PropTypes.bool,
  sx: PropTypes.object,
};

ResourcePanel.defaultProps = {
  run: null,
  showEstimate: true,
  sx: {},
};
