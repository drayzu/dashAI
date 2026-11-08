// Review step (SPEC §4): grouped summary of the frozen-to-be configuration,
// "Validación previa" checklist and the single "Iniciar ejecución" action.
// Also exports the start logic (useStartRun / StartRunButton) and summary
// helpers shared with summary/RunPreviewPanel.

import { useCallback, useRef } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ModelTrainingIcon from "@mui/icons-material/ModelTraining";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import MemoryIcon from "@mui/icons-material/Memory";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { useFineTuningActions } from "../FineTuningContext";
import KeyValueList from "../common/KeyValueList";
import useStepValidation from "./useStepValidation";
import { LIBRARY_VERSIONS, formatBytes } from "../data/catalog";
import { BLOCKING_ISSUES } from "../data/sft";
import { computeTotalSteps } from "../data/simulator";
import {
  blockerLabel,
  checkpointAvailabilityLabel,
  datasetName,
  formatLabel,
  issueLabel,
  methodLabel,
  presetLabel,
} from "../data/labels";
import Hideable from "../viewEditing/Hideable";

const NS = "fineTuning:reviewStep";
const REQUEST_REUSE_MS = 2000;

// ------------------------------------------------------------- helpers --

/** Learning rate in compact scientific notation (2e-4). */
export function formatLearningRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return n.toExponential().replace("e+", "e");
}

function newRequestId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID)
      return crypto.randomUUID();
  } catch (e) {
    // Fall through to the non-crypto id.
  }
  return `req-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/**
 * Display values shared by ReviewStep and RunPreviewPanel.
 * @param {object} v result of useStepValidation
 * @param {Function} t i18n t
 */
export function buildRunSummary(v, t) {
  const draft = (v && v.session && v.session.draft) || null;
  const ck = v ? v.checkpoint : null;
  const prepared = v && v.data ? v.data.prepared : null;
  const p = (draft && draft.parameters) || {};
  const dash = "—";
  if (!draft) return null;
  const trainCount = prepared ? prepared.trainCount : 0;
  const totalSteps = computeTotalSteps(draft, trainCount);
  const duration =
    draft.durationMode === "epochs"
      ? t(`${NS}.values.epochs`, {
          count: Number(p.epochs) || 1,
          steps: prepared ? totalSteps : "?",
        })
      : t(`${NS}.values.steps`, { count: Number(p.maxSteps) || 0 });
  const batch = Number(p.batchSize) || 0;
  const accum = Number(p.gradAccum) || 0;
  const needsDownload = Boolean(ck && ck.availability !== "ready");
  return {
    modelName: ck ? ck.name : dash,
    repository: ck ? ck.repository : dash,
    revisionShort: ck && ck.revision ? ck.revision.slice(0, 7) : dash,
    revision: ck ? ck.revision : dash,
    method: draft.method ? methodLabel(draft.method, t) : dash,
    availability: ck ? checkpointAvailabilityLabel(ck.availability, t) : dash,
    datasetName: draft.dataset ? datasetName(draft.dataset, t) : dash,
    datasetSource: draft.dataset
      ? t(
          `${NS}.values.source.${
            draft.dataset.source === "sample" ? "sample" : "dashai"
          }`,
        )
      : dash,
    format: draft.dataset ? formatLabel(draft.format, t) : dash,
    rows: prepared
      ? t(`${NS}.values.rows`, {
          used: prepared.usedRows,
          total: prepared.totalRows,
        })
      : dash,
    split: prepared
      ? t(`${NS}.values.split`, {
          train: prepared.trainCount,
          eval: prepared.evalCount,
        })
      : dash,
    splitSeed: draft.splits ? String(draft.splits.seed) : dash,
    fingerprint: prepared && prepared.fingerprint ? prepared.fingerprint : dash,
    fingerprintShort:
      prepared && prepared.fingerprint
        ? prepared.fingerprint.slice(0, 12)
        : dash,
    systemPrompt: draft.systemPrompt
      ? t(`${NS}.values.yes`)
      : t(`${NS}.values.no`),
    preset: presetLabel(draft.preset, t),
    duration,
    totalSteps,
    learningRate: formatLearningRate(p.learningRate),
    maxLength: p.maxLength
      ? t(`${NS}.values.tokens`, { count: Number(p.maxLength) })
      : dash,
    effectiveBatch:
      batch && accum ? `${batch} × ${accum} = ${batch * accum}` : dash,
    lora: t(`${NS}.values.lora`, {
      r: p.loraR,
      alpha: p.loraAlpha,
      dropout: p.loraDropout,
    }),
    loraShort: `r ${p.loraR} · α ${p.loraAlpha}`,
    targetModules: Array.isArray(p.targetModules)
      ? p.targetModules.join(", ")
      : dash,
    targetModulesCount: Array.isArray(p.targetModules)
      ? p.targetModules.length
      : 0,
    optimizer: p.optimizer ? t(`${NS}.values.optimizer.${p.optimizer}`) : dash,
    scheduler: p.scheduler ? t(`${NS}.values.scheduler.${p.scheduler}`) : dash,
    warmup: p.warmupSteps !== undefined ? String(p.warmupSteps) : dash,
    evalEvery:
      draft.splits && draft.splits.useEval === false
        ? t(`${NS}.values.noEval`)
        : String(p.evalEvery ?? dash),
    gpuName: v.hardware ? v.hardware.gpuName : dash,
    hardwareSource:
      v.hardware && v.hardware.source === "detected" ? "detected" : "simulated",
    vramAvailable: v.availableVramGb ? `${v.availableVramGb} GB` : dash,
    vramEstimated:
      typeof v.estimatedVramGb === "number"
        ? `≈ ${v.estimatedVramGb} GB`
        : dash,
    ram: v.hardware && v.hardware.ramGb ? `${v.hardware.ramGb} GB` : dash,
    needsDownload,
    downloadSize: ck ? formatBytes(ck.diskBytes) : dash,
    download: !ck
      ? dash
      : needsDownload
        ? t(`${NS}.values.willDownload`, { size: formatBytes(ck.diskBytes) })
        : t(`${NS}.values.cached`),
  };
}

// --------------------------------------------------------- start logic --

/**
 * Start logic shared by ReviewStep, RunPreviewPanel and the shell footer.
 * Idempotent per click burst: clicks within 2 s reuse the same requestId,
 * so store.startRun returns the same run instead of queueing a second one.
 * @param {object|null} session
 * @param {object} validation result of useStepValidation(session, …)
 * @param {{onStart?: (runId: string) => void, preparedData?: object}} [options]
 * @returns {{start: () => string|null, canStart: boolean, disabledReason: string,
 *   queued: boolean}}
 */
export function useStartRun(
  session,
  validation,
  { onStart, preparedData } = {},
) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const store = useFineTuningActions();
  const { enqueueSnackbar } = useSnackbar();
  const requestRef = useRef(null);
  const lockRef = useRef(false);

  const blockers =
    validation && validation.review
      ? validation.review.blockers
      : ["session_not_found"];
  const canStart = Boolean(session) && blockers.length === 0;
  let disabledReason = "";
  if (!canStart) {
    disabledReason = blockerLabel(blockers[0] || "unknown", t);
    if (blockers.length > 1)
      disabledReason += ` ${t(`${NS}.moreBlockers`, {
        count: blockers.length - 1,
      })}`;
  }
  const queued = Boolean(validation && validation.gpu && validation.gpu.busy);
  const sessionId = session ? session.id : null;

  const start = useCallback(() => {
    if (!sessionId || !canStart || lockRef.current) return null;
    lockRef.current = true;
    const nowMs = Date.now();
    const previous = requestRef.current;
    const reuse =
      previous &&
      previous.sessionId === sessionId &&
      nowMs - previous.at < REQUEST_REUSE_MS;
    const requestId = reuse ? previous.id : newRequestId();
    requestRef.current = {
      id: requestId,
      sessionId,
      at: reuse ? previous.at : nowMs,
    };
    try {
      const runId = store.startRun(sessionId, { requestId, preparedData });
      if (!reuse || !previous.runId) {
        const run = store.getState().runs.find((r) => r.id === runId);
        enqueueSnackbar(
          t(queued ? `${NS}.startedQueued` : `${NS}.started`, {
            name: run ? run.name : "",
          }),
          { variant: "success" },
        );
      }
      requestRef.current = { ...requestRef.current, runId };
      if (onStart) onStart(runId);
      return runId;
    } catch (error) {
      requestRef.current = null;
      enqueueSnackbar(
        blockerLabel((error && (error.code || error.message)) || "unknown", t),
        {
          variant: "error",
        },
      );
      return null;
    } finally {
      lockRef.current = false;
    }
  }, [
    sessionId,
    canStart,
    store,
    preparedData,
    onStart,
    enqueueSnackbar,
    t,
    queued,
  ]);

  return { start, canStart, disabledReason, queued };
}

/** Contained "Iniciar ejecución" button with the disabled-reason Tooltip. */
export function StartRunButton({
  startRun,
  fullWidth = false,
  size = "medium",
  sx,
}) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const { start, canStart, disabledReason, queued } = startRun;
  const title = !canStart
    ? disabledReason
    : queued
      ? t(`${NS}.queuedHint`)
      : "";
  return (
    <Tooltip
      title={title}
      disableHoverListener={!title}
      disableFocusListener={!title}
    >
      <Box
        component="span"
        sx={{ display: fullWidth ? "block" : "inline-block", ...sx }}
      >
        <Button
          variant="contained"
          color="primary"
          size={size}
          fullWidth={fullWidth}
          startIcon={<PlayArrowIcon fontSize="small" />}
          disabled={!canStart}
          onClick={start}
        >
          {t(`${NS}.start`)}
        </Button>
      </Box>
    </Tooltip>
  );
}

// -------------------------------------------------------------- layout --

function SummaryCard({ icon: Icon, title, subtitle, children }) {
  return (
    <Paper
      elevation={0}
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        height: "100%",
        bgcolor: "background.paper",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 3,
          px: 4,
          py: 3,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "action.selected",
            color: "primary.main",
            flexShrink: 0,
          }}
        >
          <Icon fontSize="small" />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 600 }}
            component="h3"
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" component="p">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
      <Box sx={{ px: 4, py: 2 }}>{children}</Box>
    </Paper>
  );
}

const STATUS_ICON = {
  valid: { Icon: CheckCircleOutlineIcon, color: "success.main" },
  warning: { Icon: WarningAmberOutlinedIcon, color: "warning.main" },
  error: { Icon: ErrorOutlineIcon, color: "error.main" },
  pending: { Icon: RadioButtonUncheckedIcon, color: "text.disabled" },
};

function CheckRow({ check, t }) {
  const { Icon, color } = STATUS_ICON[check.status] || STATUS_ICON.pending;
  return (
    <Box
      component="li"
      data-testid={`check-${check.key}`}
      data-status={check.status}
      sx={{
        display: "flex",
        gap: 3,
        py: 2,
        alignItems: "flex-start",
        "&:not(:last-of-type)": { borderBottom: 1, borderColor: "divider" },
      }}
    >
      <Icon
        sx={{ color, fontSize: 20, mt: 0.25, flexShrink: 0 }}
        titleAccess={t(`${NS}.checkStatus.${check.status}`)}
      />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {check.title}
        </Typography>
        {check.detail && (
          <Typography
            variant="caption"
            color="text.secondary"
            component="p"
            sx={{ wordBreak: "break-word" }}
          >
            {check.detail}
          </Typography>
        )}
        {check.extra}
      </Box>
    </Box>
  );
}

/**
 * Checklist rows of "Validación previa".
 * @returns {{key, status: "valid"|"warning"|"error"|"pending", title, detail}[]}
 */
export function buildPreflightChecks(v, t) {
  const draft = v && v.session ? v.session.draft : null;
  if (!draft) return [];
  const ck = v.checkpoint;
  const B = new Set(v.review.blockers);
  const W = new Set(v.review.warnings);
  const prepared = v.data.prepared;
  const k = (key) => `${NS}.checks.${key}`;
  const checks = [];
  const method = draft.method ? methodLabel(draft.method, t) : "";

  // 1. Trainable catalog.
  if (!ck) {
    checks.push({
      key: "catalog",
      status: B.has("checkpoint_unknown") ? "error" : "pending",
      title: t(k("catalog.title")),
      detail: B.has("checkpoint_unknown")
        ? blockerLabel("checkpoint_unknown", t)
        : t(k("catalog.pending")),
    });
  } else {
    checks.push({
      key: "catalog",
      status: "valid",
      title: t(k("catalog.title")),
      detail: t(k("catalog.ok"), { name: ck.name, repository: ck.repository }),
    });
  }

  // 2. Method compatibility (never auto-switched).
  checks.push({
    key: "method",
    status: !ck ? "pending" : B.has("method_unsupported") ? "error" : "valid",
    title: t(k("method.title")),
    detail: !ck
      ? t(k("method.pending"))
      : B.has("method_unsupported")
        ? t(k("method.unsupported"), { method, name: ck.name })
        : t(k("method.ok"), { method }),
  });

  // 3. Simulated dependencies.
  checks.push({
    key: "dependencies",
    status: ck ? "valid" : "pending",
    title: t(k("dependencies.title")),
    detail:
      draft.method === "qlora"
        ? t(k("dependencies.qlora"), { ...LIBRARY_VERSIONS })
        : t(k("dependencies.lora"), { ...LIBRARY_VERSIONS }),
  });

  // 4. Checkpoint availability (+ download confirmation).
  if (ck) {
    const size = formatBytes(ck.diskBytes);
    let status = "valid";
    let detail = t(k("availability.ready"), { size });
    if (ck.availability !== "ready") {
      status = B.has("download_not_confirmed") ? "error" : "warning";
      if (ck.availability === "downloading") {
        detail = t(k("availability.downloading"), {
          done: formatBytes(ck.downloadedBytes),
          total: size,
        });
      } else if (ck.availability === "invalid") {
        detail = t(k("availability.invalid"), { size });
      } else {
        detail = t(k("availability.missing"), { size });
      }
    }
    checks.push({
      key: "availability",
      status,
      title: t(k("availability.title")),
      detail,
      needsConfirm: ck.availability !== "ready",
      size,
    });
  } else {
    checks.push({
      key: "availability",
      status: "pending",
      title: t(k("availability.title")),
      detail: t(k("catalog.pending")),
    });
  }

  // 5. Hugging Face credential (gated checkpoints only).
  if (ck && ck.gated) {
    const ok = !B.has("credential_required");
    checks.push({
      key: "credential",
      status: ok ? "valid" : "error",
      title: t(k("credential.title")),
      detail: ok ? t(k("credential.ok")) : t(k("credential.missing")),
    });
  }

  // 6. Data validity (on the rows available client-side).
  const formatBlockers = [
    "format_text_only",
    "format_missing",
    "mapping_incomplete",
    "format_not_confirmed",
  ].filter((c) => B.has(c));
  if (B.has("no_dataset")) {
    checks.push({
      key: "data",
      status: "pending",
      title: t(k("data.title")),
      detail: t(k("data.pending")),
    });
  } else if (formatBlockers.length > 0) {
    checks.push({
      key: "data",
      status: "error",
      title: t(k("data.title")),
      detail: formatBlockers.map((c) => blockerLabel(c, t)).join(" "),
    });
  } else if (B.has("data_unavailable") || B.has("data_invalid")) {
    const blocking = (v.data.rowIssues || []).filter((i) =>
      BLOCKING_ISSUES.includes(i.code),
    );
    checks.push({
      key: "data",
      status: "error",
      title: t(k("data.title")),
      detail: blocking.length
        ? blocking.map((i) => issueLabel(i, t)).join(" · ")
        : blockerLabel(
            B.has("data_unavailable") ? "data_unavailable" : "data_invalid",
            t,
          ),
    });
  } else if (prepared) {
    const sampled = W.has("validated_on_sample");
    checks.push({
      key: "data",
      status: sampled ? "warning" : "valid",
      title: t(k("data.title")),
      detail: [
        t(k("data.ok"), {
          valid: prepared.validation.validCount,
          checked: prepared.checkedRows,
        }),
        sampled ? t(k("data.sampled"), { rows: prepared.checkedRows }) : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  } else {
    checks.push({
      key: "data",
      status: "pending",
      title: t(k("data.title")),
      detail: t(k("data.pending")),
    });
  }

  // 7. Loss mask (only assistant answers are supervised).
  const issues = v.data.rowIssues || [];
  const kills = issues.find((i) => i.code === "truncation_kills_response");
  const tooLong = issues.find((i) => i.code === "too_long");
  if (!prepared || !draft.format) {
    checks.push({
      key: "mask",
      status: "pending",
      title: t(k("mask.title")),
      detail: t(k("mask.pending")),
    });
  } else if (kills) {
    checks.push({
      key: "mask",
      status: "error",
      title: t(k("mask.title")),
      detail: t(k("mask.kills"), {
        count: kills.count,
        maxLength: draft.parameters.maxLength,
      }),
    });
  } else {
    checks.push({
      key: "mask",
      status: tooLong ? "warning" : "valid",
      title: t(k("mask.title")),
      detail: [
        t(k("mask.ok"), { tokens: prepared.avgSupervisedTokens }),
        tooLong ? t(k("mask.tooLong"), { count: tooLong.count }) : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  // 8. Partitions.
  if (!prepared || B.has("no_dataset")) {
    checks.push({
      key: "splits",
      status: "pending",
      title: t(k("splits.title")),
      detail: t(k("data.pending")),
    });
  } else if (B.has("insufficient_rows")) {
    checks.push({
      key: "splits",
      status: "error",
      title: t(k("splits.title")),
      detail: blockerLabel("insufficient_rows", t),
    });
  } else {
    const noEval = W.has("no_eval");
    checks.push({
      key: "splits",
      status: noEval ? "warning" : "valid",
      title: t(k("splits.title")),
      detail: noEval
        ? t(k("splits.noEval"), { train: prepared.trainCount })
        : t(k("splits.ok"), {
            train: prepared.trainCount,
            eval: prepared.evalCount,
            seed: prepared.splitSeed,
          }),
    });
  }

  // 9. Estimated vs available memory (preflight only warns, R15).
  if (typeof v.estimatedVramGb !== "number") {
    checks.push({
      key: "memory",
      status: "pending",
      title: t(k("memory.title")),
      detail: t(k("catalog.pending")),
    });
  } else {
    const params = {
      estimated: v.estimatedVramGb,
      available: v.availableVramGb ?? "?",
    };
    let status = "valid";
    let detail = t(k("memory.ok"), params);
    if (W.has("vram_exceeds")) {
      status = "warning";
      detail = t(k("memory.exceeds"), params);
    } else if (W.has("vram_tight")) {
      status = "warning";
      detail = t(k("memory.tight"), params);
    }
    checks.push({ key: "memory", status, title: t(k("memory.title")), detail });
  }

  // 10. Parameters within range.
  const fieldCount = Object.keys(v.parameters.fieldErrors || {}).length;
  checks.push({
    key: "parameters",
    status: B.has("invalid_parameters") ? "error" : "valid",
    title: t(k("parameters.title")),
    detail: B.has("invalid_parameters")
      ? t(k("parameters.invalid"), { count: fieldCount })
      : t(k("parameters.ok")),
  });

  return checks;
}

/** Explanation shown when the simulated GPU is busy (the run will wait in the queue). */
export function gpuQueueMessage(gpu, t) {
  if (!gpu || !gpu.busy) return "";
  const position = (gpu.queueAhead || 0) + 1;
  if (gpu.cause === "external") return t(`${NS}.gpu.external`, { position });
  if (gpu.cause === "training")
    return t(`${NS}.gpu.training`, { name: gpu.activeRunName || "", position });
  return t(`${NS}.gpu.queue`, { position });
}

// ------------------------------------------------------------ component --

/**
 * @param {object} props
 * @param {object} props.session
 * @param {(runId: string) => void} [props.onStart] called after the run is queued
 * @param {object} [props.dataState] result of useDataPreparation (optional)
 * @param {object} [props.preparedData] rows for startRun (optional; the store
 *   resolves sample / cached DashAI rows by itself)
 * @param {boolean} [props.showStartButton=true] hide when the shell footer
 *   already renders the start action (use useStartRun there)
 */
export default function ReviewStep({
  session,
  onStart,
  dataState,
  preparedData,
  showStartButton = true,
}) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const store = useFineTuningActions();
  const v = useStepValidation(session, { dataState, preparedData });
  const startRun = useStartRun(v.session, v, { onStart, preparedData });

  if (!v.session) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          {t(`${NS}.noSession`)}
        </Typography>
      </Box>
    );
  }

  const draft = v.session.draft;
  const s = buildRunSummary(v, t);
  const checks = buildPreflightChecks(v, t);
  const gpuMessage = gpuQueueMessage(v.gpu, t);
  const sessionId = v.session.id;

  const withConfirm = checks.map((check) =>
    check.key === "availability" && check.needsConfirm
      ? {
          ...check,
          extra: (
            <FormControlLabel
              sx={{ mt: 1, ml: -1 }}
              control={
                <Checkbox
                  size="small"
                  checked={Boolean(draft.downloadConfirmed)}
                  onChange={(e) =>
                    store.updateDraft(sessionId, {
                      downloadConfirmed: e.target.checked,
                    })
                  }
                />
              }
              label={
                <Typography variant="body2">
                  {t(`${NS}.checks.availability.confirm`, {
                    size: check.size,
                    repository: s.repository,
                  })}
                </Typography>
              }
            />
          ),
        }
      : check,
  );
  const needsConfirm = withConfirm.some((check) => Boolean(check.extra));

  const preflight = (
    <SummaryCard
      icon={FactCheckOutlinedIcon}
      title={t(`${NS}.preflightTitle`)}
      subtitle={t(`${NS}.preflightSubtitle`)}
    >
      <Box
        component="ul"
        sx={{ listStyle: "none", m: 0, p: 0 }}
        aria-label={t(`${NS}.preflightTitle`)}
      >
        {withConfirm.map((check) => (
          <CheckRow key={check.key} check={check} t={t} />
        ))}
      </Box>
    </SummaryCard>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Box>
        <Typography variant="h5" component="h2">
          {t(`${NS}.title`)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(`${NS}.subtitle`)}
        </Typography>
      </Box>

      {/* CSS grid (not <Grid>) so hidden groups leave no empty cell. */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          gap: 4,
        }}
      >
        <Hideable
          id="a.review.modelGroup"
          label={t("fineTuning:viewEditing.sections.aReviewModelGroup")}
          level="essential"
        >
          <SummaryCard icon={ModelTrainingIcon} title={t(`${NS}.groups.model`)}>
            <KeyValueList
              dense
              rows={[
                { label: t(`${NS}.fields.checkpoint`), value: s.modelName },
                {
                  label: t(`${NS}.fields.repository`),
                  value: s.repository,
                  mono: true,
                },
                {
                  label: t(`${NS}.fields.revision`),
                  value: s.revisionShort,
                  mono: true,
                  title: t(`${NS}.hints.revision`, { revision: s.revision }),
                },
                { label: t(`${NS}.fields.method`), value: s.method },
                {
                  label: t(`${NS}.fields.availability`),
                  value: s.availability,
                },
              ]}
            />
          </SummaryCard>
        </Hideable>
        <Hideable
          id="a.review.dataGroup"
          label={t("fineTuning:viewEditing.sections.aReviewDataGroup")}
          level="essential"
        >
          <SummaryCard
            icon={TableChartOutlinedIcon}
            title={t(`${NS}.groups.data`)}
          >
            <KeyValueList
              dense
              rows={[
                { label: t(`${NS}.fields.dataset`), value: s.datasetName },
                { label: t(`${NS}.fields.source`), value: s.datasetSource },
                { label: t(`${NS}.fields.format`), value: s.format },
                { label: t(`${NS}.fields.rows`), value: s.rows },
                {
                  label: t(`${NS}.fields.split`),
                  value: s.split,
                  hint: t(`${NS}.hints.seed`, { seed: s.splitSeed }),
                },
                {
                  label: t(`${NS}.fields.fingerprint`),
                  value: s.fingerprintShort,
                  mono: true,
                  title: t(`${NS}.hints.fingerprint`),
                },
                {
                  label: t(`${NS}.fields.systemPrompt`),
                  value: s.systemPrompt,
                },
              ]}
            />
          </SummaryCard>
        </Hideable>
        <Hideable
          id="a.review.trainingGroup"
          label={t("fineTuning:viewEditing.sections.aReviewTrainingGroup")}
          level="essential"
        >
          <SummaryCard icon={TuneIcon} title={t(`${NS}.groups.training`)}>
            <KeyValueList
              dense
              rows={[
                { label: t(`${NS}.fields.preset`), value: s.preset },
                { label: t(`${NS}.fields.duration`), value: s.duration },
                {
                  label: t(`${NS}.fields.learningRate`),
                  value: s.learningRate,
                  mono: true,
                },
                { label: t(`${NS}.fields.maxLength`), value: s.maxLength },
                {
                  label: t(`${NS}.fields.effectiveBatch`),
                  value: s.effectiveBatch,
                  title: t(`${NS}.hints.effectiveBatch`),
                },
                { label: t(`${NS}.fields.lora`), value: s.lora },
                {
                  label: t(`${NS}.fields.targetModules`),
                  value: t(`${NS}.values.modules`, {
                    count: s.targetModulesCount,
                  }),
                  title: s.targetModules,
                },
                { label: t(`${NS}.fields.optimizer`), value: s.optimizer },
                { label: t(`${NS}.fields.scheduler`), value: s.scheduler },
                { label: t(`${NS}.fields.warmup`), value: s.warmup },
                { label: t(`${NS}.fields.evalEvery`), value: s.evalEvery },
              ]}
            />
          </SummaryCard>
        </Hideable>
        <Hideable
          id="a.review.resourcesGroup"
          label={t("fineTuning:viewEditing.sections.aReviewResourcesGroup")}
          level="intermediate"
        >
          <SummaryCard
            icon={MemoryIcon}
            title={t(`${NS}.groups.resources`)}
            subtitle={t(`${NS}.simulatedNote`)}
          >
            <KeyValueList
              dense
              rows={[
                {
                  label: t(`${NS}.fields.gpu`),
                  value: s.gpuName,
                  hint: t(`${NS}.values.hardwareSource.${s.hardwareSource}`),
                },
                {
                  label: t(`${NS}.fields.vramAvailable`),
                  value: s.vramAvailable,
                },
                {
                  label: t(`${NS}.fields.vramEstimated`),
                  value: s.vramEstimated,
                  hint: t(`${NS}.hints.vram`),
                },
                { label: t(`${NS}.fields.ram`), value: s.ram },
                { label: t(`${NS}.fields.download`), value: s.download },
              ]}
            />
          </SummaryCard>
        </Hideable>
      </Box>

      {needsConfirm ? (
        // Holds the required download confirmation: never hideable.
        preflight
      ) : (
        <Hideable
          id="a.review.preflight"
          label={t("fineTuning:viewEditing.sections.aReviewPreflight")}
          level="intermediate"
        >
          {preflight}
        </Hideable>
      )}

      {gpuMessage && (
        <Hideable
          id="a.review.gpuQueueNote"
          label={t("fineTuning:viewEditing.sections.aReviewGpuQueueNote")}
          level="full"
        >
          <Alert severity="info" sx={{ py: 0.5 }} aria-live="polite">
            {gpuMessage}
          </Alert>
        </Hideable>
      )}

      {showStartButton && (
        <Paper
          elevation={0}
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            p: 4,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 4,
          }}
        >
          <TextField
            size="small"
            label={t(`${NS}.runName`)}
            placeholder={`${v.session.name} · ${v.nextRunNumber}`}
            value={draft.runName || ""}
            onChange={(e) =>
              store.updateDraft(sessionId, { runName: e.target.value })
            }
            helperText={t(`${NS}.runNameHelp`)}
            sx={{ flex: "1 1 260px" }}
          />
          <StartRunButton startRun={startRun} />
        </Paper>
      )}
    </Box>
  );
}
