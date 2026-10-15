import { useMemo, useRef } from "react";
import PropTypes from "prop-types";
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import Plot from "react-plotly.js";
import PlotActions from "../../shared/PlotActions";

const finite = (v) => typeof v === "number" && Number.isFinite(v);

/** Pure: Plotly series from run points. */
export function lossSeries(points) {
  const list = Array.isArray(points) ? points : [];
  const train = list.filter((p) => p && finite(p.loss));
  const evals = list.filter((p) => p && finite(p.evalLoss));
  const lr = list.filter((p) => p && finite(p.lr));
  return {
    train: { x: train.map((p) => p.step), y: train.map((p) => p.loss) },
    eval: { x: evals.map((p) => p.step), y: evals.map((p) => p.evalLoss) },
    lr: { x: lr.map((p) => p.step), y: lr.map((p) => p.lr) },
  };
}

function baseLayout(theme, height, xTitle) {
  return {
    autosize: true,
    height,
    margin: { l: 50, r: 12, t: 8, b: 45 },
    paper_bgcolor: theme.palette.background.paper,
    plot_bgcolor: theme.palette.background.paper,
    font: {
      color: theme.palette.text.primary,
      family: theme.typography.fontFamily,
      size: 11,
    },
    xaxis: {
      title: { text: xTitle, standoff: 10 },
      gridcolor: theme.palette.divider,
      zerolinecolor: theme.palette.divider,
      tickfont: { color: theme.palette.text.primary, size: 10 },
    },
    yaxis: {
      gridcolor: theme.palette.divider,
      zerolinecolor: theme.palette.divider,
      tickfont: { color: theme.palette.text.primary, size: 10 },
      automargin: true,
    },
  };
}

const panelSx = {
  border: 1,
  borderColor: "divider",
  borderRadius: 1,
  p: 2,
  bgcolor: "background.paper",
  "& .plot-actions": { opacity: 0, transition: "opacity 0.15s ease" },
  "&:hover .plot-actions, &:focus-within .plot-actions": { opacity: 1 },
  "@media (hover: none)": { "& .plot-actions": { opacity: 1 } },
};

function PanelHeader({ title, actions }) {
  const { t } = useTranslation(["fineTuning"]);
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        mb: 1,
        px: 1,
        minHeight: 32,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t("fineTuning:charts.simulated")}
        </Typography>
      </Box>
      {actions}
    </Box>
  );
}

PanelHeader.propTypes = { title: PropTypes.node, actions: PropTypes.node };

/**
 * Training / evaluation loss curves (Plotly, themed like Models'
 * LiveMetricsChart) with an optional learning-rate panel. Labelled simulated.
 */
export default function LossChart({
  points,
  height,
  showEval,
  showLr,
  title,
  filename,
  emptyText,
}) {
  const theme = useTheme();
  const { t } = useTranslation(["fineTuning"]);
  const lossRef = useRef(null);
  const lrRef = useRef(null);
  const series = useMemo(() => lossSeries(points), [points]);
  const stepLabel = t("fineTuning:charts.step");
  const trainColor = theme.palette.chart?.train || theme.palette.success.main;
  const evalColor =
    theme.palette.chart?.validation || theme.palette.warning.main;
  const lrColor =
    theme.palette.chart?.palette?.[3] || theme.palette.secondary.main;
  const hasEval = showEval && series.eval.x.length > 0;

  const lossData = useMemo(() => {
    const data = [
      {
        type: "scatter",
        mode: series.train.x.length > 1 ? "lines" : "markers",
        name: t("fineTuning:charts.trainLoss"),
        x: series.train.x,
        y: series.train.y,
        line: { color: trainColor, width: 2, shape: "spline", smoothing: 0.7 },
        marker: { color: trainColor },
        hovertemplate: `${stepLabel} %{x}: %{y:.4f}<extra>${t("fineTuning:charts.trainLoss")}</extra>`,
      },
    ];
    if (hasEval) {
      data.push({
        type: "scatter",
        mode: "lines+markers",
        name: t("fineTuning:charts.evalLoss"),
        x: series.eval.x,
        y: series.eval.y,
        line: { color: evalColor, width: 2, dash: "dot" },
        marker: { color: evalColor, size: 6 },
        hovertemplate: `${stepLabel} %{x}: %{y:.4f}<extra>${t("fineTuning:charts.evalLoss")}</extra>`,
      });
    }
    return data;
  }, [series, hasEval, trainColor, evalColor, stepLabel, t]);

  const lossLayout = useMemo(() => {
    const layout = baseLayout(theme, height, stepLabel);
    return {
      ...layout,
      margin: { ...layout.margin, t: 28 },
      showlegend: true,
      legend: {
        orientation: "h",
        x: 0,
        y: 1.02,
        yanchor: "bottom",
        bgcolor: "transparent",
        font: { color: theme.palette.text.secondary, size: 11 },
      },
      yaxis: { ...layout.yaxis, title: { text: t("fineTuning:charts.loss") } },
    };
  }, [theme, height, stepLabel, t]);

  const lrData = useMemo(
    () => [
      {
        type: "scatter",
        mode: "lines",
        name: t("fineTuning:charts.learningRate"),
        x: series.lr.x,
        y: series.lr.y,
        line: { color: lrColor, width: 2 },
        hovertemplate: `${stepLabel} %{x}: %{y:.2e}<extra></extra>`,
      },
    ],
    [series, lrColor, stepLabel, t],
  );

  const lrLayout = useMemo(() => {
    const layout = baseLayout(theme, 160, stepLabel);
    return {
      ...layout,
      showlegend: false,
      yaxis: { ...layout.yaxis, exponentformat: "e", tickformat: ".0e" },
    };
  }, [theme, stepLabel]);

  if (series.train.x.length === 0) {
    return (
      <Box
        sx={{
          height: height + 48,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          border: 1,
          borderStyle: "dashed",
          borderColor: "divider",
          borderRadius: 1,
          px: 4,
          textAlign: "center",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {emptyText || t("fineTuning:charts.empty")}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t("fineTuning:charts.simulated")}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{ display: "grid", gap: 3, gridTemplateColumns: "minmax(0, 1fr)" }}
    >
      <Box ref={lossRef} sx={panelSx}>
        <PanelHeader
          title={title || t("fineTuning:charts.lossTitle")}
          actions={
            <PlotActions
              getContainer={() => lossRef.current}
              data={lossData}
              layout={lossLayout}
              filename={filename || "loss"}
            />
          }
        />
        <Plot
          data={lossData}
          layout={lossLayout}
          useResizeHandler
          style={{ width: "100%", height: `${height}px` }}
          config={{ responsive: true, displayModeBar: false }}
        />
      </Box>
      {showLr && series.lr.x.length > 0 && (
        <Box ref={lrRef} sx={panelSx}>
          <PanelHeader
            title={t("fineTuning:charts.learningRate")}
            actions={
              <PlotActions
                getContainer={() => lrRef.current}
                data={lrData}
                layout={lrLayout}
                filename={`${filename || "loss"}-lr`}
              />
            }
          />
          <Plot
            data={lrData}
            layout={lrLayout}
            useResizeHandler
            style={{ width: "100%", height: "160px" }}
            config={{ responsive: true, displayModeBar: false }}
          />
        </Box>
      )}
    </Box>
  );
}

LossChart.propTypes = {
  points: PropTypes.arrayOf(PropTypes.object),
  height: PropTypes.number,
  showEval: PropTypes.bool,
  showLr: PropTypes.bool,
  title: PropTypes.node,
  filename: PropTypes.string,
  emptyText: PropTypes.node,
};

LossChart.defaultProps = {
  points: [],
  height: 240,
  showEval: true,
  showLr: false,
  title: null,
  filename: "loss",
  emptyText: null,
};
