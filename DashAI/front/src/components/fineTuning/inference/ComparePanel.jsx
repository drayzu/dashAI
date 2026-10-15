import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import {
  useFineTuningActions,
  useFineTuningRoutes,
  useFineTuningStore,
} from "../FineTuningContext";
import {
  adapterById,
  comparisonById,
  comparisonPending,
  comparisonSummary,
  comparisonsByAdapter,
} from "../data/selectors";
import { FICHA_CATEGORIES, FICHA_INSTRUCTION } from "../data/sampleDatasets";
import { generationErrorLabel } from "../data/labels";
import { modelBlockReason } from "./ModelPickerMenu";
import {
  formatDateTime,
  formatNumber,
  modelRefStatus,
} from "./modelAvailability";
import {
  blindSides,
  buildComparisonCsv,
  displayOrder,
  downloadTextFile,
} from "./compareCsv";

// Same defaults the store uses for a new comparison (temperature 0.2).
const DEFAULT_COMPARE_PARAMS = Object.freeze({
  temperature: 0.2,
  maxNewTokens: 256,
  topP: 0.9,
});

function CodeBox({ children }) {
  const theme = useTheme();
  return (
    <Box
      component="pre"
      sx={{
        ...theme.typography.code,
        m: 0,
        p: 2,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        bgcolor: theme.palette.ui ? theme.palette.ui.box : "action.hover",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        maxHeight: 180,
        overflowY: "auto",
        color: "text.primary",
      }}
    >
      {children}
    </Box>
  );
}

CodeBox.propTypes = { children: PropTypes.node };

function prettyOutput(text) {
  const raw = String(text || "").trim();
  if (raw.startsWith("{")) {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch (e) {
      return raw;
    }
  }
  return raw;
}

function CheckChip({ ok, label }) {
  if (ok === null || ok === undefined) return null;
  return (
    <Chip
      size="small"
      variant="outlined"
      color={ok ? "success" : "error"}
      icon={
        ok ? <CheckIcon fontSize="small" /> : <CloseIcon fontSize="small" />
      }
      label={label}
    />
  );
}

CheckChip.propTypes = { ok: PropTypes.bool, label: PropTypes.string };

/** One answer cell: output box, automatic checks and manual 0/1/2 score. */
function AnswerCell({ item, side, onScore, sideLabel }) {
  const { t } = useTranslation(["fineTuning"]);
  const output = item[side];
  const error = item[`${side}Error`];
  const auto = item.auto || {};
  const score = item.scores ? item.scores[side] : null;
  if (error) {
    return (
      <Alert severity="error" sx={{ py: 0.5 }}>
        {generationErrorLabel(error, t)}
      </Alert>
    );
  }
  if (output === null || output === undefined) {
    return (
      <Box sx={{ py: 2 }}>
        <Typography variant="caption" color="text.secondary">
          {t("fineTuning:compare.generating")}
        </Typography>
        <LinearProgress sx={{ mt: 1, height: 4, borderRadius: 2 }} />
      </Box>
    );
  }
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <CodeBox>{prettyOutput(output)}</CodeBox>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <CheckChip
          ok={auto[`${side}JsonValid`]}
          label={t("fineTuning:compare.checks.json")}
        />
        <CheckChip
          ok={auto[`${side}CategoryOk`]}
          label={t("fineTuning:compare.checks.category")}
        />
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Typography variant="caption" color="text.secondary">
          {t("fineTuning:compare.score.label")}
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={typeof score === "number" ? score : null}
          onChange={(_, v) => onScore(v === undefined ? null : v)}
          aria-label={t("fineTuning:compare.score.aria", { answer: sideLabel })}
        >
          {[0, 1, 2].map((v) => (
            <ToggleButton
              key={v}
              value={v}
              aria-label={t(`fineTuning:compare.score.value${v}`)}
              sx={{ px: 3, py: 0.5 }}
            >
              {v}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
    </Box>
  );
}

AnswerCell.propTypes = {
  item: PropTypes.object.isRequired,
  side: PropTypes.oneOf(["base", "adapted"]).isRequired,
  onScore: PropTypes.func.isRequired,
  sideLabel: PropTypes.string,
};

function SummaryCard({ title, rows, children }) {
  return (
    <Paper
      elevation={0}
      sx={{ p: 4, border: 1, borderColor: "divider", height: "100%" }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
        {title}
      </Typography>
      {rows.map(([label, value]) => (
        <Box
          key={label}
          sx={{
            display: "flex",
            justifyContent: "space-between",
            gap: 2,
            py: 0.5,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {value}
          </Typography>
        </Box>
      ))}
      {children}
    </Paper>
  );
}

SummaryCard.propTypes = {
  title: PropTypes.string,
  rows: PropTypes.array,
  children: PropTypes.node,
};

/**
 * Base vs adapted comparison on the 12 held-out cases of the reference case
 * (R81–R85): same instruction and generation parameters for both models,
 * automatic checks (JSON válido, categoría), manual 0/1/2 content scores,
 * blind review with shuffled "Respuesta A/B", summary metrics and CSV export.
 * Outputs are simulated; the panel says so.
 *
 * Props:
 * - adapterId: string — adapter to compare against its base checkpoint.
 * - comparisonId?: string — comparison to show (defaults to the latest one
 *   of the adapter). Generating a new one navigates to
 *   `routes.compare(adapterId, newId)`.
 */
export default function ComparePanel({ adapterId, comparisonId }) {
  const { t, i18n } = useTranslation(["fineTuning", "common"]);
  const language = i18n.language;
  const store = useFineTuningActions();
  const routes = useFineTuningRoutes();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [createdId, setCreatedId] = useState(null);

  const adapter = useFineTuningStore((s) => adapterById(s, adapterId));
  const status = useFineTuningStore((s) => {
    const st = modelRefStatus(s, { kind: "adapter", id: adapterId });
    return {
      usable: st.usable,
      reason: st.reason,
      hasAdapter: Boolean(st.adapter),
      ckName: st.checkpoint ? st.checkpoint.name : "",
      ckAvailability: st.checkpoint ? st.checkpoint.availability : null,
    };
  });
  const comparisons = useFineTuningStore((s) =>
    comparisonsByAdapter(s, adapterId),
  );

  const selectedId =
    (comparisonId &&
      comparisons.some((c) => c.id === comparisonId) &&
      comparisonId) ||
    (createdId && comparisons.some((c) => c.id === createdId) && createdId) ||
    (comparisons[0] && comparisons[0].id) ||
    null;
  const comparison = useFineTuningStore((s) => comparisonById(s, selectedId));
  const summary = useMemo(() => comparisonSummary(comparison), [comparison]);
  const pending = comparisonPending(comparison);
  const blind = Boolean(comparison && comparison.blind);

  if (!adapter) {
    return (
      <Box sx={{ p: 6, textAlign: "center" }}>
        <CompareArrowsIcon sx={{ fontSize: 48, opacity: 0.4 }} />
        <Typography variant="h6" color="text.secondary">
          {t("fineTuning:compare.adapterNotFound")}
        </Typography>
      </Box>
    );
  }

  const baseName = adapter.checkpointName || adapter.checkpointId;
  const params = comparison ? comparison.params : DEFAULT_COMPARE_PARAMS;
  const instruction =
    (comparison && comparison.instruction) || FICHA_INSTRUCTION;
  const blockReason = status.usable
    ? ""
    : modelBlockReason(
        {
          usable: false,
          reason: status.reason,
          adapter: status.hasAdapter ? {} : null,
          checkpoint: {
            name: status.ckName,
            availability: status.ckAvailability,
            diskBytes: 1,
            downloadedBytes: 0,
          },
        },
        t,
      );

  const generate = () => {
    try {
      const id = store.createComparison(adapterId, {});
      setCreatedId(id);
      navigate(routes.compare(adapterId, id), {
        replace: Boolean(comparisonId),
      });
    } catch (error) {
      enqueueSnackbar(t("fineTuning:compare.createFailed"), {
        variant: "error",
      });
    }
  };

  const exportCsv = () => {
    if (!comparison) return;
    const csv = buildComparisonCsv(comparison, t);
    const ok = downloadTextFile(
      csv,
      `comparacion-${adapter.id}-${comparison.id}.csv`,
    );
    enqueueSnackbar(
      ok
        ? t("fineTuning:compare.exported")
        : t("fineTuning:compare.exportFailed"),
      {
        variant: ok ? "success" : "error",
      },
    );
  };

  const sideName = (side) =>
    side === "base"
      ? t("fineTuning:compare.columns.base", { name: baseName })
      : t("fineTuning:compare.columns.adapted", { name: adapter.name });

  const pct = (rate) =>
    rate === null || rate === undefined
      ? "—"
      : new Intl.NumberFormat(language || undefined, {
          style: "percent",
          maximumFractionDigits: 0,
        }).format(rate);
  const resolvedCount = comparison
    ? comparison.items.reduce(
        (n, it) =>
          n +
          (it.base !== null || it.baseError ? 1 : 0) +
          (it.adapted !== null || it.adaptedError ? 1 : 0),
        0,
      )
    : 0;
  const totalOutputs = comparison ? comparison.items.length * 2 : 0;

  const generateButton = (
    <Button
      variant="contained"
      startIcon={<CompareArrowsIcon />}
      onClick={generate}
      disabled={!status.usable || pending}
    >
      {comparison
        ? t("fineTuning:compare.regenerate")
        : t("fineTuning:compare.generate")}
    </Button>
  );

  return (
    <Box sx={{ height: "100%", minHeight: 0, overflowY: "auto", p: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" component="h2">
          {t("fineTuning:compare.title")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("fineTuning:compare.subtitle", {
            adapter: adapter.name,
            base: baseName,
          })}
        </Typography>
      </Box>

      {/* Condition: same instruction and parameters for both models */}
      <Paper
        elevation={0}
        sx={{ p: 4, border: 1, borderColor: "divider", mb: 4 }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {t("fineTuning:compare.condition.title")}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("fineTuning:compare.condition.description")}
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t("fineTuning:compare.condition.instruction")}
            </Typography>
            <CodeBox>{instruction}</CodeBox>
          </Box>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Chip
              size="small"
              variant="outlined"
              label={t("fineTuning:compare.condition.temperature", {
                value: formatNumber(Number(params.temperature), language, 2),
              })}
            />
            <Chip
              size="small"
              variant="outlined"
              label={t("fineTuning:compare.condition.topP", {
                value: formatNumber(Number(params.topP), language, 2),
              })}
            />
            <Chip
              size="small"
              variant="outlined"
              label={t("fineTuning:compare.condition.maxNewTokens", {
                value: params.maxNewTokens,
              })}
            />
            <Chip
              size="small"
              variant="outlined"
              label={t("fineTuning:compare.condition.cases", { count: 12 })}
            />
          </Box>
        </Box>
      </Paper>

      {!status.usable && (
        <Alert severity="warning" sx={{ mb: 4 }}>
          {blockReason}. {t("fineTuning:compare.blockedHint")}
        </Alert>
      )}

      {/* Toolbar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 3,
          flexWrap: "wrap",
          mb: 4,
        }}
      >
        {!status.usable || pending ? (
          <Tooltip
            title={
              pending ? t("fineTuning:compare.pendingTooltip") : blockReason
            }
          >
            <span>{generateButton}</span>
          </Tooltip>
        ) : (
          generateButton
        )}
        {comparisons.length > 1 && (
          <Select
            size="small"
            value={selectedId || ""}
            onChange={(e) => {
              setCreatedId(e.target.value);
              navigate(routes.compare(adapterId, e.target.value), {
                replace: true,
              });
            }}
            inputProps={{ "aria-label": t("fineTuning:compare.history") }}
            sx={{ minWidth: 220 }}
          >
            {comparisons.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {t("fineTuning:compare.historyItem", {
                  date: formatDateTime(c.createdAt, language),
                })}
              </MenuItem>
            ))}
          </Select>
        )}
        <Box sx={{ flex: 1 }} />
        {comparison && (
          <>
            <FormControlLabel
              control={
                <Switch
                  checked={blind}
                  onChange={(e) =>
                    store.setComparisonBlind(comparison.id, e.target.checked)
                  }
                />
              }
              label={t("fineTuning:compare.blind")}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={exportCsv}
            >
              {t("fineTuning:compare.exportCsv")}
            </Button>
          </>
        )}
      </Box>

      {!comparison ? (
        <Box
          sx={{
            border: "1px dashed",
            borderColor: "divider",
            borderRadius: 1,
            p: 8,
            textAlign: "center",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {t("fineTuning:compare.empty")}
          </Typography>
        </Box>
      ) : (
        <>
          {pending && (
            <Box sx={{ mb: 4 }} aria-live="polite">
              <Typography variant="caption" color="text.secondary">
                {t("fineTuning:compare.progress", {
                  done: resolvedCount,
                  total: totalOutputs,
                })}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={totalOutputs ? (100 * resolvedCount) / totalOutputs : 0}
                sx={{ mt: 1, height: 4, borderRadius: 2 }}
              />
            </Box>
          )}

          {blind && (
            <Alert severity="info" sx={{ mb: 4 }}>
              {t("fineTuning:compare.blindInfo")}
            </Alert>
          )}

          {/* Summary (hidden in blind mode: it reveals which side is which) */}
          {!blind && summary && (
            <Grid container spacing={4} sx={{ mb: 4 }}>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <SummaryCard
                  title={t("fineTuning:compare.summary.jsonValid")}
                  rows={[
                    [
                      t("fineTuning:compare.summary.base"),
                      pct(summary.base.jsonValidRate),
                    ],
                    [
                      t("fineTuning:compare.summary.adapted"),
                      pct(summary.adapted.jsonValidRate),
                    ],
                  ]}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <SummaryCard
                  title={t("fineTuning:compare.summary.category")}
                  rows={[
                    [
                      t("fineTuning:compare.summary.base"),
                      pct(summary.base.categoryRate),
                    ],
                    [
                      t("fineTuning:compare.summary.adapted"),
                      pct(summary.adapted.categoryRate),
                    ],
                  ]}
                >
                  <Box
                    sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {t("fineTuning:compare.summary.byCategory")}
                    </Typography>
                    {FICHA_CATEGORIES.map((cat) => {
                      const b = summary.base.byCategory[cat] || {
                        correct: 0,
                        total: 0,
                      };
                      const a = summary.adapted.byCategory[cat] || {
                        correct: 0,
                        total: 0,
                      };
                      return (
                        <Box
                          key={cat}
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 2,
                          }}
                        >
                          <Typography variant="caption">
                            {t(`fineTuning:compare.categories.${cat}`)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t("fineTuning:compare.summary.categoryPair", {
                              base: `${b.correct}/${b.total}`,
                              adapted: `${a.correct}/${a.total}`,
                            })}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </SummaryCard>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <SummaryCard
                  title={t("fineTuning:compare.summary.score")}
                  rows={[
                    [
                      t("fineTuning:compare.summary.base"),
                      summary.base.meanScore === null
                        ? "—"
                        : t("fineTuning:compare.summary.scoreValue", {
                            value: formatNumber(
                              summary.base.meanScore,
                              language,
                              2,
                            ),
                            count: summary.base.scoredCount,
                          }),
                    ],
                    [
                      t("fineTuning:compare.summary.adapted"),
                      summary.adapted.meanScore === null
                        ? "—"
                        : t("fineTuning:compare.summary.scoreValue", {
                            value: formatNumber(
                              summary.adapted.meanScore,
                              language,
                              2,
                            ),
                            count: summary.adapted.scoredCount,
                          }),
                    ],
                  ]}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <SummaryCard
                  title={t("fineTuning:compare.summary.latency")}
                  rows={[
                    [
                      t("fineTuning:compare.summary.base"),
                      summary.base.meanLatencyMs === null
                        ? "—"
                        : t("fineTuning:compare.summary.seconds", {
                            value: formatNumber(
                              summary.base.meanLatencyMs / 1000,
                              language,
                              1,
                            ),
                          }),
                    ],
                    [
                      t("fineTuning:compare.summary.adapted"),
                      summary.adapted.meanLatencyMs === null
                        ? "—"
                        : t("fineTuning:compare.summary.seconds", {
                            value: formatNumber(
                              summary.adapted.meanLatencyMs / 1000,
                              language,
                              1,
                            ),
                          }),
                    ],
                  ]}
                />
              </Grid>
            </Grid>
          )}

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 2 }}
          >
            {t("fineTuning:compare.score.legend")}
          </Typography>

          <TableContainer
            component={Paper}
            elevation={0}
            sx={{ border: 1, borderColor: "divider" }}
          >
            <Table
              size="small"
              sx={{ minWidth: 960 }}
              aria-label={t("fineTuning:compare.tableAria")}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 40 }}>#</TableCell>
                  <TableCell sx={{ width: "18%" }}>
                    {t("fineTuning:compare.columns.input")}
                  </TableCell>
                  <TableCell sx={{ width: "22%" }}>
                    {t("fineTuning:compare.columns.reference")}
                  </TableCell>
                  <TableCell>
                    {blind
                      ? t("fineTuning:compare.columns.answerA")
                      : sideName("base")}
                  </TableCell>
                  <TableCell>
                    {blind
                      ? t("fineTuning:compare.columns.answerB")
                      : sideName("adapted")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayOrder(comparison, blind).map((index, position) => {
                  const item = comparison.items[index];
                  if (!item) return null;
                  const sides = blind
                    ? blindSides(comparison, index)
                    : ["base", "adapted"];
                  const labels = blind
                    ? [
                        t("fineTuning:compare.columns.answerA"),
                        t("fineTuning:compare.columns.answerB"),
                      ]
                    : [sideName("base"), sideName("adapted")];
                  return (
                    <TableRow key={item.id} sx={{ verticalAlign: "top" }}>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {position + 1}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{item.input}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 1,
                          }}
                        >
                          {item.reference && item.reference.categoria && (
                            <Chip
                              size="small"
                              variant="outlined"
                              label={t(
                                `fineTuning:compare.categories.${item.reference.categoria}`,
                              )}
                              sx={{ alignSelf: "flex-start" }}
                            />
                          )}
                          <CodeBox>
                            {JSON.stringify(item.reference, null, 2)}
                          </CodeBox>
                        </Box>
                      </TableCell>
                      {sides.map((side, i) => (
                        <TableCell key={side}>
                          <AnswerCell
                            item={item}
                            side={side}
                            sideLabel={labels[i]}
                            onScore={(v) =>
                              store.scoreComparisonItem(
                                comparison.id,
                                item.id,
                                side,
                                v,
                              )
                            }
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 4 }}
      >
        {t("fineTuning:compare.honestCaption")}
      </Typography>
    </Box>
  );
}

ComparePanel.propTypes = {
  adapterId: PropTypes.string.isRequired,
  comparisonId: PropTypes.string,
};
