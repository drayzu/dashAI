import { useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import CodeIcon from "@mui/icons-material/Code";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFineTuningRoutes, useFineTuningStore } from "../FineTuningContext";
import { formatBytes } from "../data/catalog";
import {
  adapterAvailabilityLabel,
  availabilityColor,
  checkpointAvailabilityLabel,
  datasetName,
  formatLabel,
  methodLabel,
} from "../data/labels";
import {
  adapterById,
  checkpointById,
  runById,
  sessionById,
} from "../data/selectors";
import {
  formatDateTime,
  formatNumber,
  splitDuration,
} from "../inference/modelAvailability";
import Hideable from "../viewEditing/Hideable";

function Mono({ children }) {
  const theme = useTheme();
  return (
    <Box
      component="span"
      sx={{ ...theme.typography.code, wordBreak: "break-all" }}
    >
      {children}
    </Box>
  );
}

Mono.propTypes = { children: PropTypes.node };

/** Dense label/value rows under an overline section title. */
// View-editing level of each provenance section (ids "shared.provenance.<key>").
const SECTION_LEVELS = {
  base: "intermediate",
  data: "intermediate",
  method: "intermediate",
  config: "full",
  environment: "full",
  metrics: "intermediate",
  artifact: "full",
  origin: "full",
};

function Section({ title, rows, viewKey }) {
  const { t } = useTranslation(["fineTuning"]);
  const visible = rows.filter(
    (r) => r && r[1] !== null && r[1] !== undefined && r[1] !== "",
  );
  if (visible.length === 0) return null;
  return (
    <Hideable
      id={`shared.provenance.${viewKey}`}
      label={t(`fineTuning:viewEditing.sections.provenanceSection.${viewKey}`)}
      level={SECTION_LEVELS[viewKey] || "full"}
    >
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ letterSpacing: 1, display: "block" }}
        >
          {title}
        </Typography>
        <Box
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "background.paper",
          }}
        >
          {visible.map(([label, value], i) => (
            <Box
              key={label}
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "200px 1fr" },
                gap: 2,
                px: 4,
                py: 2,
                borderTop: i === 0 ? 0 : 1,
                borderColor: "divider",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="body2" component="div" sx={{ minWidth: 0 }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Hideable>
  );
}

Section.propTypes = {
  title: PropTypes.string.isRequired,
  rows: PropTypes.array.isRequired,
  viewKey: PropTypes.oneOf(Object.keys(SECTION_LEVELS)).isRequired,
};

function scientific(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toExponential(1);
}

/**
 * Provenance of an adapter (R60, R61, R62): base model id + revisión exacta,
 * dataset + huella + particiones, método + precisión, configuración
 * congelada, versiones de bibliotecas (simuladas), tiempos, métricas, VRAM
 * pico, tamaño, archivos, hash del manifiesto, disponibilidad and a link to
 * the source run.
 *
 * Props:
 * - adapterId: string|null
 * - open: boolean
 * - onClose(): void
 */
export default function AdapterProvenanceDialog({ adapterId, open, onClose }) {
  const { t, i18n } = useTranslation(["fineTuning", "common"]);
  const language = i18n.language;
  const theme = useTheme();
  const routes = useFineTuningRoutes();
  const navigate = useNavigate();
  const [showJson, setShowJson] = useState(false);

  const adapter = useFineTuningStore((s) => adapterById(s, adapterId));
  const run = useFineTuningStore((s) => {
    const a = adapterById(s, adapterId);
    return a ? runById(s, a.runId) : null;
  });
  const session = useFineTuningStore((s) => {
    const a = adapterById(s, adapterId);
    return a ? sessionById(s, a.sessionId) : null;
  });
  const checkpoint = useFineTuningStore((s) => {
    const a = adapterById(s, adapterId);
    return a ? checkpointById(s, a.checkpointId) : null;
  });

  const snapshot = (run && run.snapshot) || null;
  const draft = (snapshot && snapshot.draft) || null;
  const p = (draft && draft.parameters) || {};
  const ds = (snapshot && snapshot.dataset) || null;
  const ckSnap = (snapshot && snapshot.checkpoint) || null;
  const metrics = (adapter && adapter.metrics) || {};
  const versions = (snapshot && snapshot.versions) || {};
  const hardware = (snapshot && snapshot.hardware) || null;

  const dur = splitDuration(metrics.durationSec);
  const dec = (v, d = 4) =>
    typeof v === "number" ? formatNumber(v, language, d) : "";
  const gb = (v) =>
    typeof v === "number"
      ? t("fineTuning:adapters.provenance.gb", { value: dec(v, 2) })
      : "";

  const mapping =
    ds && ds.mapping
      ? Object.entries(ds.mapping)
          .filter(([, col]) => col)
          .map(([field, col]) => `${field} ← ${col}`)
          .join(" · ")
      : "";

  const precision = draft
    ? draft.method === "qlora"
      ? t("fineTuning:adapters.provenance.precisionQlora")
      : t("fineTuning:adapters.provenance.precisionLora")
    : "";

  const duration = draft
    ? draft.durationMode === "epochs"
      ? t("fineTuning:adapters.provenance.durationEpochs", {
          count: p.epochs,
          steps: snapshot.totalSteps,
        })
      : t("fineTuning:adapters.provenance.durationSteps", { count: p.maxSteps })
    : "";

  const goToRun = () => {
    if (!run) return;
    onClose();
    navigate(routes.run(run.sessionId, run.id));
  };

  return (
    <Dialog
      open={Boolean(open && adapter)}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: { minHeight: 500 } } }}
      aria-labelledby="ft-provenance-title"
    >
      <DialogTitle
        id="ft-provenance-title"
        sx={{ display: "flex", alignItems: "center", gap: 2, pr: 12 }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="h6"
            component="span"
            sx={{ display: "block" }}
            noWrap
          >
            {t("fineTuning:adapters.provenance.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {adapter ? adapter.name : ""}
          </Typography>
        </Box>
        {adapter && (
          <Chip
            size="small"
            color={availabilityColor(adapter.availability)}
            label={adapterAvailabilityLabel(adapter.availability, t)}
          />
        )}
        <IconButton
          aria-label={t("common:close")}
          onClick={onClose}
          size="small"
          sx={{
            position: "absolute",
            right: 16,
            top: 16,
            color: "text.secondary",
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: "background.paper" }}>
        {adapter && (
          <>
            {adapter.availability !== "ready" && (
              <Typography variant="body2" color="warning.main" sx={{ mb: 4 }}>
                {t("fineTuning:adapters.provenance.unavailableNote")}
              </Typography>
            )}

            <Section
              viewKey="base"
              title={t("fineTuning:adapters.provenance.sections.base")}
              rows={[
                [
                  t("fineTuning:adapters.provenance.baseName"),
                  adapter.checkpointName || (ckSnap && ckSnap.name),
                ],
                [
                  t("fineTuning:adapters.provenance.repository"),
                  ckSnap ? <Mono>{ckSnap.repository}</Mono> : "",
                ],
                [
                  t("fineTuning:adapters.provenance.revision"),
                  adapter.revision || (ckSnap && ckSnap.revision) ? (
                    <>
                      <Mono>{adapter.revision || ckSnap.revision}</Mono>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        {t(
                          "fineTuning:adapters.provenance.revisionIllustrative",
                        )}
                      </Typography>
                    </>
                  ) : (
                    ""
                  ),
                ],
                [
                  t("fineTuning:adapters.provenance.parameters"),
                  ckSnap
                    ? t("fineTuning:adapters.provenance.billions", {
                        value: dec(ckSnap.parametersB, 2),
                      })
                    : "",
                ],
                [
                  t("fineTuning:adapters.provenance.license"),
                  ckSnap ? ckSnap.license : "",
                ],
                [
                  t("fineTuning:adapters.provenance.baseAvailability"),
                  checkpoint ? (
                    <Chip
                      size="small"
                      variant="outlined"
                      color={availabilityColor(checkpoint.availability)}
                      label={checkpointAvailabilityLabel(
                        checkpoint.availability,
                        t,
                      )}
                    />
                  ) : (
                    ""
                  ),
                ],
              ]}
            />

            <Section
              viewKey="data"
              title={t("fineTuning:adapters.provenance.sections.data")}
              rows={[
                [
                  t("fineTuning:adapters.provenance.dataset"),
                  ds ? datasetName(ds, t) : adapter.datasetName,
                ],
                [
                  t("fineTuning:adapters.provenance.source"),
                  ds
                    ? t(
                        `fineTuning:adapters.provenance.sourceKind.${
                          ds.source === "dashai" ? "dashai" : "sample"
                        }`,
                      )
                    : "",
                ],
                [
                  t("fineTuning:adapters.provenance.format"),
                  ds && ds.format ? formatLabel(ds.format, t) : "",
                ],
                [
                  t("fineTuning:adapters.provenance.mapping"),
                  mapping ? <Mono>{mapping}</Mono> : "",
                ],
                [
                  t("fineTuning:adapters.provenance.fingerprint"),
                  adapter.fingerprint || (ds && ds.fingerprint) ? (
                    <Mono>{adapter.fingerprint || ds.fingerprint}</Mono>
                  ) : (
                    ""
                  ),
                ],
                [
                  t("fineTuning:adapters.provenance.partitions"),
                  ds
                    ? t("fineTuning:adapters.provenance.partitionsValue", {
                        train: ds.trainCount,
                        eval: ds.evalCount,
                        seed:
                          ds.splitSeed !== undefined
                            ? ds.splitSeed
                            : draft && draft.splits
                              ? draft.splits.seed
                              : "",
                      })
                    : "",
                ],
                [
                  t("fineTuning:adapters.provenance.rows"),
                  ds && typeof ds.usedRows === "number"
                    ? t("fineTuning:adapters.provenance.rowsValue", {
                        used: ds.usedRows,
                        total: ds.totalRows,
                      })
                    : "",
                ],
                [
                  t("fineTuning:adapters.provenance.systemPrompt"),
                  (ds && ds.systemPrompt) ||
                    (draft && draft.systemPrompt) ||
                    "",
                ],
              ]}
            />

            <Section
              viewKey="method"
              title={t("fineTuning:adapters.provenance.sections.method")}
              rows={[
                [
                  t("fineTuning:adapters.provenance.method"),
                  methodLabel(adapter.method, t),
                ],
                [t("fineTuning:adapters.provenance.precision"), precision],
                [
                  t("fineTuning:adapters.provenance.lora"),
                  draft
                    ? t("fineTuning:adapters.provenance.loraValue", {
                        r: p.loraR,
                        alpha: p.loraAlpha,
                        dropout: dec(p.loraDropout, 2),
                      })
                    : "",
                ],
                [
                  t("fineTuning:adapters.provenance.targetModules"),
                  Array.isArray(p.targetModules) ? (
                    <Mono>{p.targetModules.join(", ")}</Mono>
                  ) : (
                    ""
                  ),
                ],
                [
                  t("fineTuning:adapters.provenance.lossPolicy"),
                  snapshot
                    ? t("fineTuning:adapters.provenance.lossPolicyValue")
                    : "",
                ],
              ]}
            />

            <Section
              viewKey="config"
              title={t("fineTuning:adapters.provenance.sections.config")}
              rows={[
                [t("fineTuning:adapters.provenance.duration"), duration],
                [
                  t("fineTuning:adapters.provenance.learningRate"),
                  p.learningRate ? (
                    <Mono>{scientific(p.learningRate)}</Mono>
                  ) : (
                    ""
                  ),
                ],
                [
                  t("fineTuning:adapters.provenance.batch"),
                  draft
                    ? t("fineTuning:adapters.provenance.batchValue", {
                        batch: p.batchSize,
                        accum: p.gradAccum,
                        effective:
                          (Number(p.batchSize) || 1) *
                          (Number(p.gradAccum) || 1),
                      })
                    : "",
                ],
                [
                  t("fineTuning:adapters.provenance.maxLength"),
                  draft ? p.maxLength : "",
                ],
                [
                  t("fineTuning:adapters.provenance.optimizer"),
                  p.optimizer ? <Mono>{p.optimizer}</Mono> : "",
                ],
                [
                  t("fineTuning:adapters.provenance.scheduler"),
                  p.scheduler ? <Mono>{p.scheduler}</Mono> : "",
                ],
                [
                  t("fineTuning:adapters.provenance.warmup"),
                  draft ? p.warmupSteps : "",
                ],
                [
                  t("fineTuning:adapters.provenance.evalEvery"),
                  draft && draft.splits && draft.splits.useEval !== false
                    ? p.evalEvery
                    : "",
                ],
                [t("fineTuning:adapters.provenance.seed"), draft ? p.seed : ""],
              ]}
            />

            <Section
              viewKey="environment"
              title={t("fineTuning:adapters.provenance.sections.environment")}
              rows={[
                ...Object.entries(versions).map(([lib, version]) => [
                  lib,
                  <Mono key={lib}>{version}</Mono>,
                ]),
                [
                  t("fineTuning:adapters.provenance.hardware"),
                  hardware
                    ? t("fineTuning:adapters.provenance.hardwareValue", {
                        gpu: hardware.gpuName,
                        vram: hardware.vramGb,
                        source: t(
                          `fineTuning:adapters.provenance.hardwareSource.${
                            hardware.source === "detected"
                              ? "detected"
                              : "simulated"
                          }`,
                        ),
                      })
                    : "",
                ],
                [
                  t("fineTuning:adapters.provenance.versionsNote"),
                  Object.keys(versions).length
                    ? t("fineTuning:adapters.provenance.versionsNoteValue")
                    : "",
                ],
              ]}
            />

            <Section
              viewKey="metrics"
              title={t("fineTuning:adapters.provenance.sections.metrics")}
              rows={[
                [
                  t("fineTuning:adapters.provenance.startedAt"),
                  run ? formatDateTime(run.startedAt, language) : "",
                ],
                [
                  t("fineTuning:adapters.provenance.endedAt"),
                  run ? formatDateTime(run.endedAt, language) : "",
                ],
                [
                  t("fineTuning:adapters.provenance.durationReal"),
                  typeof metrics.durationSec === "number"
                    ? t("fineTuning:adapters.provenance.minutesSeconds", dur)
                    : "",
                ],
                [
                  t("fineTuning:adapters.provenance.steps"),
                  typeof metrics.steps === "number"
                    ? metrics.steps
                    : run
                      ? run.step
                      : "",
                ],
                [
                  t("fineTuning:adapters.provenance.finalLoss"),
                  dec(metrics.finalLoss),
                ],
                [
                  t("fineTuning:adapters.provenance.finalEvalLoss"),
                  dec(metrics.finalEvalLoss),
                ],
                [
                  t("fineTuning:adapters.provenance.peakVram"),
                  gb(metrics.peakVramGb),
                ],
                [
                  t("fineTuning:adapters.provenance.peakRam"),
                  gb(metrics.peakRamGb),
                ],
              ]}
            />

            <Section
              viewKey="artifact"
              title={t("fineTuning:adapters.provenance.sections.artifact")}
              rows={[
                [
                  t("fineTuning:adapters.provenance.size"),
                  formatBytes(adapter.sizeBytes),
                ],
                [
                  t("fineTuning:adapters.provenance.files"),
                  Array.isArray(adapter.files) && adapter.files.length ? (
                    <Box component="ul" sx={{ m: 0, pl: 4 }}>
                      {adapter.files.map((f) => (
                        <li key={f.name}>
                          <Mono>{f.name}</Mono>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="span"
                          >
                            {` · ${formatBytes(f.bytes)}`}
                          </Typography>
                        </li>
                      ))}
                    </Box>
                  ) : (
                    ""
                  ),
                ],
                [
                  t("fineTuning:adapters.provenance.manifestHash"),
                  adapter.manifestHash ? (
                    <Mono>{adapter.manifestHash}</Mono>
                  ) : (
                    ""
                  ),
                ],
                [
                  t("fineTuning:adapters.provenance.availability"),
                  <Chip
                    key="availability"
                    size="small"
                    color={availabilityColor(adapter.availability)}
                    label={adapterAvailabilityLabel(adapter.availability, t)}
                  />,
                ],
                [
                  t("fineTuning:adapters.provenance.dependency"),
                  t("fineTuning:adapters.provenance.dependencyValue"),
                ],
              ]}
            />

            <Section
              viewKey="origin"
              title={t("fineTuning:adapters.provenance.sections.origin")}
              rows={[
                [
                  t("fineTuning:adapters.provenance.run"),
                  run
                    ? t("fineTuning:adapters.provenance.runValue", {
                        number: run.number,
                        name: run.name,
                      })
                    : t("fineTuning:adapters.provenance.runMissing"),
                ],
                [
                  t("fineTuning:adapters.provenance.runId"),
                  run ? <Mono>{run.id}</Mono> : "",
                ],
                [
                  t("fineTuning:adapters.provenance.session"),
                  session ? session.name : "",
                ],
                [
                  t("fineTuning:adapters.provenance.adapterId"),
                  <Mono key="id">{adapter.id}</Mono>,
                ],
              ]}
            />

            {showJson && (
              <Box
                component="pre"
                sx={{
                  ...theme.typography.code,
                  m: 0,
                  p: 3,
                  maxHeight: 280,
                  overflow: "auto",
                  bgcolor: theme.palette.ui
                    ? theme.palette.ui.box
                    : "action.hover",
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                  color: "text.primary",
                }}
              >
                {JSON.stringify({ adapter, frozenConfig: snapshot }, null, 2)}
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 4 }}>
        <Hideable
          id="shared.provenance.jsonButton"
          label={t("fineTuning:viewEditing.sections.provenanceJsonButton")}
          level="full"
          sx={{ mr: "auto" }}
        >
          <Button
            size="small"
            startIcon={<CodeIcon fontSize="small" />}
            onClick={() => setShowJson((v) => !v)}
            sx={{ mr: "auto" }}
          >
            {showJson
              ? t("fineTuning:adapters.provenance.hideJson")
              : t("fineTuning:adapters.provenance.showJson")}
          </Button>
        </Hideable>
        <Button
          variant="outlined"
          startIcon={<OpenInNewIcon fontSize="small" />}
          onClick={goToRun}
          disabled={!run}
        >
          {t("fineTuning:adapters.provenance.viewRun")}
        </Button>
        <Button variant="contained" onClick={onClose}>
          {t("common:close")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

AdapterProvenanceDialog.propTypes = {
  adapterId: PropTypes.string,
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
};
