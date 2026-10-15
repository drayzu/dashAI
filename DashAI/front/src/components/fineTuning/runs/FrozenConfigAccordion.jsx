import { useState } from "react";
import PropTypes from "prop-types";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Tooltip,
  Typography,
} from "@mui/material";
import { Code, ExpandMore, LockOutlined } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import {
  datasetName,
  formatLabel,
  methodLabel,
  presetLabel,
} from "../data/labels";
import { formatDateTime, formatGb, formatLr, shortHash } from "./runFormat";

const dash = (v) => (v === null || v === undefined || v === "" ? "—" : v);

/**
 * Pure: frozen configuration of a run as labelled groups
 * (Modelo · Datos · Entrenamiento · Entorno).
 * @returns {{key: string, title: string, rows: {key: string, label: string, value: string, full?: string, mono?: boolean}[]}[]}
 */
export function frozenConfigGroups(run, t, language) {
  const snap = (run && run.snapshot) || null;
  if (!snap) return [];
  const draft = snap.draft || {};
  const p = draft.parameters || {};
  const ck = snap.checkpoint || {};
  const ds = snap.dataset || {};
  const hw = snap.hardware || {};
  const versions = snap.versions || {};
  const L = (key, opts) => t(`fineTuning:runs.config.${key}`, opts);
  const row = (key, value, extra = {}) => ({
    key,
    label: L(key),
    value: String(dash(value)),
    ...extra,
  });

  const mapping = ds.mapping || draft.mapping || {};
  const mappingText = Object.entries(mapping)
    .filter(([, col]) => col)
    .map(
      ([field, col]) =>
        `${t(`fineTuning:datasets.fields.${field}`, { defaultValue: field })} ← ${col}`,
    )
    .join(" · ");

  const precision =
    draft.method === "qlora"
      ? L("precisionQlora", {
          compute: (snap.computeDtype || "float16").toUpperCase(),
        })
      : L("precisionLora", {
          compute: (snap.computeDtype || "float16").toUpperCase(),
        });

  const duration =
    draft.durationMode === "epochs"
      ? L("durationEpochs", {
          count: Number(p.epochs) || 1,
          steps: snap.totalSteps,
        })
      : L("durationSteps", {
          count: Number(p.maxSteps) || snap.totalSteps || 0,
        });

  return [
    {
      key: "model",
      title: L("groups.model"),
      rows: [
        row("baseModel", ck.name),
        row("repository", ck.repository, { mono: true }),
        row("revision", shortHash(ck.revision, 12), {
          full: ck.revision,
          mono: true,
          hint: t("fineTuning:catalog.revisionIllustrative"),
        }),
        row("method", draft.method ? methodLabel(draft.method, t) : null),
        row("precision", precision),
      ],
    },
    {
      key: "data",
      title: L("groups.data"),
      rows: [
        row("dataset", datasetName(ds, t) || ds.name),
        row(
          "source",
          ds.source
            ? t(`fineTuning:datasets.source.${ds.source}`, {
                defaultValue: ds.source,
              })
            : null,
        ),
        row("format", formatLabel(ds.format || draft.format, t)),
        row("mapping", mappingText || null),
        row(
          "systemPrompt",
          ds.systemPrompt || draft.systemPrompt
            ? L("systemPromptYes")
            : L("systemPromptNo"),
        ),
        row(
          "rows",
          L("rowsValue", {
            used: ds.usedRows ?? ds.totalRows ?? 0,
            total: ds.totalRows ?? 0,
          }),
        ),
        row(
          "split",
          ds.useEval === false
            ? L("splitNoEval", { train: ds.trainCount ?? 0 })
            : L("splitValue", {
                train: ds.trainCount ?? 0,
                eval: ds.evalCount ?? 0,
                seed: dash(ds.splitSeed),
              }),
        ),
        row("fingerprint", ds.fingerprint, { mono: true }),
        ...(ds.sampled
          ? [row("sampled", L("sampledValue", { count: ds.checkedRows ?? 0 }))]
          : []),
        row("lossPolicy", L("lossPolicyValue")),
      ],
    },
    {
      key: "training",
      title: L("groups.training"),
      rows: [
        row("preset", presetLabel(draft.preset, t)),
        row("duration", duration),
        row("totalSteps", snap.totalSteps),
        row(
          "batch",
          L("batchValue", {
            batch: p.batchSize,
            accum: p.gradAccum,
            effective:
              snap.effectiveBatch ||
              (Number(p.batchSize) || 1) * (Number(p.gradAccum) || 1),
          }),
        ),
        row("maxLength", p.maxLength),
        row("learningRate", formatLr(p.learningRate)),
        row(
          "lora",
          L("loraValue", {
            r: p.loraR,
            alpha: p.loraAlpha,
            dropout: p.loraDropout,
          }),
        ),
        row("targetModules", (p.targetModules || []).join(", "), {
          mono: true,
        }),
        row("optimizer", p.optimizer, { mono: true }),
        row(
          "scheduler",
          p.scheduler
            ? L(`schedulers.${p.scheduler}`, { defaultValue: p.scheduler })
            : null,
        ),
        row("warmup", p.warmupSteps),
        row("evalEvery", p.evalEvery),
        row("seed", p.seed),
      ],
    },
    {
      key: "environment",
      title: L("groups.environment"),
      rows: [
        row(
          "gpu",
          hw.gpuName ? `${hw.gpuName} · ${formatGb(Number(hw.vramGb))}` : null,
        ),
        row("ram", formatGb(Number(hw.ramGb))),
        row(
          "hardwareSource",
          t(
            `fineTuning:runs.resources.source.${hw.source === "detected" ? "detected" : "simulated"}`,
          ),
        ),
        row("estimatedVram", formatGb(snap.estimatedVramGb)),
        row(
          "versions",
          Object.entries(versions)
            .map(([lib, v]) => `${lib} ${v}`)
            .join(" · "),
          { hint: L("versionsSimulated") },
        ),
        row(
          "frozenAt",
          formatDateTime(snap.frozenAt || (run && run.createdAt), language),
        ),
        row("runId", run && run.id, { mono: true }),
      ],
    },
  ];
}

function KeyValueRows({ rows }) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: "grid",
        gridTemplateColumns: "minmax(120px, 38%) 1fr",
        columnGap: 3,
        rowGap: 1.5,
      }}
    >
      {rows.map((r) => (
        <Box key={r.key} sx={{ display: "contents" }}>
          <Typography component="dt" variant="body2" color="text.secondary">
            {r.label}
          </Typography>
          <Typography
            component="dd"
            variant="body2"
            sx={{
              m: 0,
              minWidth: 0,
              wordBreak: "break-word",
              fontFamily: r.mono ? "monospace" : undefined,
            }}
          >
            {r.full || r.hint ? (
              <Tooltip title={[r.full, r.hint].filter(Boolean).join(" · ")}>
                <span>{r.value}</span>
              </Tooltip>
            ) : (
              r.value
            )}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

KeyValueRows.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
};

/** Non-collapsible content: grouped key/value rows + "Ver JSON" toggle. */
export function FrozenConfigContent({
  run,
  showJsonToggle,
  groups: onlyGroups,
}) {
  const { t, i18n } = useTranslation(["fineTuning"]);
  const [showJson, setShowJson] = useState(false);
  const groups = frozenConfigGroups(run, t, i18n.language).filter(
    (g) => !onlyGroups || onlyGroups.includes(g.key),
  );
  if (!groups.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t("fineTuning:runs.config.unavailable")}
      </Typography>
    );
  }
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {groups.map((group) => (
        <Box key={group.key}>
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ display: "block", letterSpacing: 1, mb: 1 }}
          >
            {group.title}
          </Typography>
          <KeyValueRows rows={group.rows} />
        </Box>
      ))}
      {showJsonToggle && (
        <Box>
          <Button
            size="small"
            variant="text"
            startIcon={<Code fontSize="small" />}
            onClick={() => setShowJson((v) => !v)}
          >
            {showJson
              ? t("fineTuning:runs.config.hideJson")
              : t("fineTuning:runs.config.showJson")}
          </Button>
          {showJson && (
            <Box
              component="pre"
              sx={{
                mt: 2,
                mb: 0,
                p: 3,
                bgcolor: "background.paper",
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                fontFamily: "monospace",
                fontSize: "0.75rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: 320,
                overflow: "auto",
              }}
            >
              {JSON.stringify(run.snapshot, null, 2)}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

FrozenConfigContent.propTypes = {
  run: PropTypes.object,
  showJsonToggle: PropTypes.bool,
  groups: PropTypes.arrayOf(
    PropTypes.oneOf(["model", "data", "training", "environment"]),
  ),
};

FrozenConfigContent.defaultProps = {
  run: null,
  showJsonToggle: true,
  groups: null,
};

/** "Configuración congelada" accordion of a run (immutable snapshot, R52/R60). */
export default function FrozenConfigAccordion({ run, defaultExpanded, sx }) {
  const { t } = useTranslation(["fineTuning"]);
  if (!run) return null;
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      elevation={0}
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        "&::before": { display: "none" },
        bgcolor: "background.paper",
        ...sx,
      }}
    >
      <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <LockOutlined fontSize="small" color="action" />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {t("fineTuning:runs.config.title")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("fineTuning:runs.config.subtitle")}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 4, pb: 4 }}>
        <FrozenConfigContent run={run} />
      </AccordionDetails>
    </Accordion>
  );
}

FrozenConfigAccordion.propTypes = {
  run: PropTypes.object,
  defaultExpanded: PropTypes.bool,
  sx: PropTypes.object,
};

FrozenConfigAccordion.defaultProps = {
  run: null,
  defaultExpanded: false,
  sx: {},
};
