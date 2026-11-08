import { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Button,
  Chip,
  Grid,
  MenuItem,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import SpeedIcon from "@mui/icons-material/Speed";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import AutoGraphIcon from "@mui/icons-material/AutoGraph";
import MemoryIcon from "@mui/icons-material/Memory";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import { useTranslation } from "react-i18next";
import PillToggleButtonGroup from "../../shared/PillToggleButtonGroup";
import SectionCard, { SelectableCard } from "../common/SectionCard";
import VramEstimate from "../common/VramEstimate";
import {
  ALL_TARGET_MODULES,
  MAX_LENGTH_OPTIONS,
  PARAMETER_LIMITS,
  PRESETS,
  createDefaultDraft,
  validateParameters,
} from "../data/catalog";
import { partitionCounts } from "../data/sft";
import { computeTotalSteps } from "../data/simulator";
import {
  parameterErrorLabel,
  presetDescription,
  presetLabel,
} from "../data/labels";
import { useFineTuningActions, useFineTuningStore } from "../FineTuningContext";
import Hideable from "../viewEditing/Hideable";

// ---------------------------------------------------------------------------
// Draft helpers shared with ModelStep (session draft vs. local config value)
// ---------------------------------------------------------------------------

/**
 * Effective draft to display: the session draft, or (when `value` is given,
 * prototype B per-run config) the session draft overlaid with `value`.
 * Always complete (defaults filled in).
 */
export function resolveDraft(session, value) {
  const sessionDraft = (session && session.draft) || {};
  if (!value) return createDefaultDraft(sessionDraft);
  return createDefaultDraft({
    ...sessionDraft,
    ...value,
    parameters: {
      ...(sessionDraft.parameters || {}),
      ...(value.parameters || {}),
    },
  });
}

/**
 * Pure equivalent of store.updateDraft for a local config object: deep-merges
 * `parameters`, marks the preset "custom" on manual edits and resets the
 * download confirmation when the checkpoint changes.
 */
export function applyDraftPatch(value, patch, fallbackParameters = {}) {
  const base = value || {};
  const next = { ...base, ...patch };
  if (patch.parameters) {
    next.parameters = {
      ...fallbackParameters,
      ...(base.parameters || {}),
      ...patch.parameters,
    };
  }
  if (
    ("parameters" in patch || "durationMode" in patch) &&
    !("preset" in patch)
  ) {
    next.preset = "custom";
  }
  if (
    "checkpointId" in patch &&
    patch.checkpointId !== base.checkpointId &&
    !("downloadConfirmed" in patch)
  ) {
    next.downloadConfirmed = false;
  }
  return next;
}

/** Pure equivalent of store.applyPreset for a local config object. */
export function applyPresetToDraft(value, presetKey, fallbackParameters = {}) {
  const base = value || {};
  const preset = PRESETS[presetKey];
  if (!preset) return { ...base, preset: "custom" };
  return {
    ...base,
    preset: presetKey,
    durationMode: preset.durationMode,
    parameters: {
      ...fallbackParameters,
      ...(base.parameters || {}),
      ...preset.parameters,
    },
  };
}

/**
 * Editing API over either the session draft (store actions) or a local
 * config value (`onChange(nextValue)` receives the whole next object).
 * @returns {{draft: object, patch: (p: object) => void,
 *   applyPreset: (key: string) => void, controlled: boolean}}
 */
export function useDraftEditor(session, value, onChange) {
  const store = useFineTuningActions();
  const controlled = Boolean(value && onChange);
  const draft = useMemo(
    () => resolveDraft(session, controlled ? value : null),
    [session, value, controlled],
  );
  const sessionId = session ? session.id : null;
  const patch = useCallback(
    (p) => {
      if (controlled) onChange(applyDraftPatch(value, p, draft.parameters));
      else if (sessionId) store.updateDraft(sessionId, p);
    },
    [controlled, onChange, value, draft.parameters, sessionId, store],
  );
  const applyPreset = useCallback(
    (key) => {
      if (controlled)
        onChange(applyPresetToDraft(value, key, draft.parameters));
      else if (sessionId) store.applyPreset(sessionId, key);
    },
    [controlled, onChange, value, draft.parameters, sessionId, store],
  );
  return { draft, patch, applyPreset, controlled };
}

/** Training examples after the split, or null when no dataset is selected. */
export function estimateTrainCount(draft) {
  const ds = draft && draft.dataset;
  if (!ds || !Number(ds.totalRows)) return null;
  const total = Number(ds.totalRows);
  const maxSamples =
    Number(draft.maxSamples) > 0 ? Number(draft.maxSamples) : null;
  const used = maxSamples ? Math.min(total, maxSamples) : total;
  return partitionCounts(used, draft.splits || {}).train;
}

// ---------------------------------------------------------------------------
// Number parsing / formatting
// ---------------------------------------------------------------------------

function parseNumber(text) {
  const raw = String(text ?? "")
    .trim()
    .replace(",", ".");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

export function formatNumber(n) {
  if (typeof n !== "number" || !Number.isFinite(n))
    return n === undefined || n === null ? "" : String(n);
  if (n !== 0 && Math.abs(n) < 1e-3) return n.toExponential();
  return String(n);
}

const MODE_STORAGE_KEY = "dashai:ft-proto:paramsMode";

function readStoredMode() {
  try {
    return window.localStorage.getItem(MODE_STORAGE_KEY) === "advanced"
      ? "advanced"
      : "simple";
  } catch (e) {
    return "simple";
  }
}

function writeStoredMode(mode) {
  try {
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch (e) {
    // per-viewer convenience only
  }
}

const ADVANCED_FIELDS = [
  "loraDropout",
  "targetModules",
  "optimizer",
  "scheduler",
  "warmupSteps",
  "evalEvery",
  "seed",
];

// ---------------------------------------------------------------------------
// Field building blocks
// ---------------------------------------------------------------------------

function FieldLabel({ label, tooltip, htmlFor }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
      <Typography
        component="label"
        htmlFor={htmlFor}
        variant="body2"
        sx={{ fontWeight: 600 }}
      >
        {label}
      </Typography>
      {tooltip && (
        <Tooltip title={tooltip}>
          <InfoOutlinedIcon
            fontSize="inherit"
            sx={{ color: "text.secondary", cursor: "help" }}
          />
        </Tooltip>
      )}
    </Stack>
  );
}

FieldLabel.propTypes = {
  label: PropTypes.node.isRequired,
  tooltip: PropTypes.node,
  htmlFor: PropTypes.string,
};

/**
 * Numeric text field that keeps the raw text while typing (e.g. "2e-") and
 * commits a number when it parses, or the raw text otherwise (the draft
 * validation then blocks the start).
 */
function NumberField({
  id,
  label,
  tooltip,
  value,
  onCommit,
  error,
  hint,
  disabled,
  inputMode = "decimal",
  endAdornment,
}) {
  const [text, setText] = useState(() => formatNumber(value));
  const [prevValue, setPrevValue] = useState(value);
  // Resync the text only when the external value changes to something the
  // current text does not already represent (preset applied, clone, …).
  if (!Object.is(value, prevValue)) {
    setPrevValue(value);
    const parsed = parseNumber(text);
    const represented =
      parsed === value ||
      (parsed === null && value === "") ||
      (Number.isNaN(parsed) && text === value);
    if (!represented) setText(formatNumber(value));
  }
  const handleChange = (event) => {
    const next = event.target.value;
    setText(next);
    const parsed = parseNumber(next);
    if (parsed === null) onCommit("");
    else if (Number.isNaN(parsed)) onCommit(next);
    else onCommit(parsed);
  };
  return (
    <Box>
      <FieldLabel label={label} tooltip={tooltip} htmlFor={id} />
      <TextField
        id={id}
        size="small"
        fullWidth
        value={text}
        onChange={handleChange}
        disabled={disabled}
        error={Boolean(error)}
        helperText={error || hint || " "}
        slotProps={{
          htmlInput: { inputMode, "aria-invalid": Boolean(error) || undefined },
          input: endAdornment ? { endAdornment } : undefined,
          formHelperText: { sx: { mx: 0 } },
        }}
      />
    </Box>
  );
}

NumberField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.node.isRequired,
  tooltip: PropTypes.node,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onCommit: PropTypes.func.isRequired,
  error: PropTypes.node,
  hint: PropTypes.node,
  disabled: PropTypes.bool,
  inputMode: PropTypes.string,
  endAdornment: PropTypes.node,
};

function SelectField({
  id,
  label,
  tooltip,
  value,
  onChange,
  options,
  hint,
  disabled,
}) {
  return (
    <Box>
      <FieldLabel label={label} tooltip={tooltip} htmlFor={id} />
      <TextField
        id={id}
        select
        size="small"
        fullWidth
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        helperText={hint || " "}
        slotProps={{ formHelperText: { sx: { mx: 0 } } }}
      >
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
}

SelectField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.node.isRequired,
  tooltip: PropTypes.node,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({ value: PropTypes.any, label: PropTypes.node }),
  ).isRequired,
  hint: PropTypes.node,
  disabled: PropTypes.bool,
};

function DerivedLine({ children, color = "text.secondary" }) {
  return (
    <Typography variant="caption" color={color} component="p" sx={{ mt: 1 }}>
      {children}
    </Typography>
  );
}

DerivedLine.propTypes = { children: PropTypes.node, color: PropTypes.string };

// ---------------------------------------------------------------------------
// PresetPicker
// ---------------------------------------------------------------------------

const PRESET_ORDER = ["quick_test", "balanced", "qlora_8gb"];

/**
 * Preset cards (look of generative/RAG/PresetCardList) in a responsive grid.
 * "Personalizado" is a state (any manual edit), shown as a chip, not a card.
 */
export function PresetPicker({ activeKey, method, onSelect }) {
  const { t } = useTranslation(["fineTuning"]);
  return (
    <Box
      role="radiogroup"
      aria-label={t("fineTuning:paramsStep.presets.title")}
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
      }}
    >
      {PRESET_ORDER.map((key) => {
        const selected = activeKey === key;
        const preset = PRESETS[key];
        const methodHint =
          preset.recommendedMethod && preset.recommendedMethod !== method;
        return (
          <SelectableCard
            key={key}
            selected={selected}
            onSelect={() => onSelect(key)}
            ariaLabel={presetLabel(key, t)}
            sx={{ p: 2.5 }}
          >
            <Stack direction="row" alignItems="flex-start" spacing={1}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {presetLabel(key, t)}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {presetDescription(key, t)}
                </Typography>
                {methodHint && (
                  <Typography
                    variant="caption"
                    color="warning.main"
                    component="p"
                    sx={{ mt: 1 }}
                  >
                    {t("fineTuning:paramsStep.presets.recommendedQlora")}
                  </Typography>
                )}
              </Box>
              {selected && (
                <CheckIcon fontSize="small" color="primary" sx={{ mt: 0.25 }} />
              )}
            </Stack>
          </SelectableCard>
        );
      })}
    </Box>
  );
}

PresetPicker.propTypes = {
  activeKey: PropTypes.string,
  method: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
};

// ---------------------------------------------------------------------------
// ParametersStep
// ---------------------------------------------------------------------------

/**
 * Parameters step (SPEC §4 "config"): presets, Simple/Advanced toggle,
 * grouped fields with inline validation, derived values and a live VRAM
 * estimate.
 *
 * @param {object} props
 * @param {object} props.session store session (draft + dataset for derived values)
 * @param {object} [props.value] local run config (prototype B dialog); when
 *   given together with `onChange`, edits that object instead of the draft
 * @param {(next: object) => void} [props.onChange] receives the whole next value
 * @param {number} [props.trainCount] override of the training-example count
 * @param {boolean} [props.dense] tighter section paddings (dialogs)
 */
export default function ParametersStep({
  session,
  value,
  onChange,
  trainCount: trainCountProp,
  dense = false,
}) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const { draft, patch, applyPreset } = useDraftEditor(
    session,
    value,
    onChange,
  );
  const [mode, setMode] = useState(readStoredMode);
  const checkpoint = useFineTuningStore((s) =>
    draft.checkpointId
      ? (s.checkpoints || []).find((c) => c.id === draft.checkpointId) || null
      : null,
  );

  const p = draft.parameters;
  const errors = useMemo(
    () => validateParameters(p, draft.durationMode),
    [p, draft.durationMode],
  );
  const trainCount =
    typeof trainCountProp === "number"
      ? trainCountProp
      : estimateTrainCount(draft);
  const effectiveBatch =
    Number.isInteger(p.batchSize) && Number.isInteger(p.gradAccum)
      ? p.batchSize * p.gradAccum
      : null;
  const totalSteps =
    draft.durationMode === "epochs"
      ? trainCount && effectiveBatch && Number.isInteger(p.epochs)
        ? computeTotalSteps(draft, trainCount)
        : null
      : Number.isInteger(p.maxSteps)
        ? p.maxSteps
        : null;
  const useEval = !draft.splits || draft.splits.useEval !== false;
  const hiddenAdvancedErrors =
    mode === "simple" && ADVANCED_FIELDS.some((f) => errors[f]);

  const setParam = (key) => (v) => patch({ parameters: { [key]: v } });
  const changeMode = (_e, next) => {
    if (!next) return;
    setMode(next);
    writeStoredMode(next);
  };

  const errorText = (field) => {
    const code = errors[field];
    if (!code) return null;
    const limit = PARAMETER_LIMITS[field];
    const base = parameterErrorLabel(code, t);
    if (code === "out_of_range" && limit) {
      return `${base} (${t("fineTuning:paramsStep.range", {
        min: formatNumber(limit.min),
        max: formatNumber(limit.max),
      })})`;
    }
    return base;
  };

  const sectionProps = { dense };
  const idp = session ? `ft-params-${session.id}` : "ft-params";

  // Derived duration line
  let durationDerived = null;
  if (draft.durationMode === "epochs") {
    durationDerived = totalSteps
      ? t("fineTuning:paramsStep.duration.derivedSteps", {
          steps: totalSteps,
          train: trainCount,
          batch: effectiveBatch,
          epochs: p.epochs,
        })
      : t("fineTuning:paramsStep.duration.needDataset");
  } else if (totalSteps && trainCount && effectiveBatch) {
    const epochs =
      Math.round(((totalSteps * effectiveBatch) / trainCount) * 10) / 10;
    durationDerived = t("fineTuning:paramsStep.duration.derivedEpochs", {
      epochs,
      train: trainCount,
    });
  }
  const warmupTooLong =
    totalSteps &&
    Number.isInteger(p.warmupSteps) &&
    p.warmupSteps >= totalSteps &&
    !errors.warmupSteps;

  const allModules = ALL_TARGET_MODULES.every((m) =>
    (p.targetModules || []).includes(m),
  );
  const toggleModule = (m) => {
    const current = Array.isArray(p.targetModules) ? p.targetModules : [];
    const next = current.includes(m)
      ? current.filter((x) => x !== m)
      : ALL_TARGET_MODULES.filter((x) => x === m || current.includes(x));
    setParam("targetModules")(next);
  };

  return (
    <Stack spacing={dense ? 3 : 4}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
      >
        <Typography variant="body2" color="text.secondary">
          {t("fineTuning:paramsStep.intro")}
        </Typography>
        <Hideable
          id="shared.params.modeToggle"
          label={t("fineTuning:viewEditing.sections.paramsModeToggle")}
          level="intermediate"
          sx={{ flexShrink: 0 }}
        >
          <PillToggleButtonGroup
            value={mode}
            onChange={changeMode}
            size="small"
            aria-label={t("fineTuning:paramsStep.mode.label")}
            sx={{
              minHeight: 32,
              flexShrink: 0,
              "& .MuiToggleButtonGroup-grouped": { minHeight: 32, px: 3 },
            }}
          >
            <ToggleButton value="simple">
              {t("fineTuning:paramsStep.mode.simple")}
            </ToggleButton>
            <ToggleButton value="advanced">
              {t("fineTuning:paramsStep.mode.advanced")}
            </ToggleButton>
          </PillToggleButtonGroup>
        </Hideable>
      </Stack>

      <Hideable
        id="shared.params.presets"
        label={t("fineTuning:viewEditing.sections.paramsPresets")}
        level="intermediate"
      >
        <SectionCard
          {...sectionProps}
          icon={TuneIcon}
          title={t("fineTuning:paramsStep.presets.title")}
          subtitle={t("fineTuning:paramsStep.presets.subtitle")}
          action={
            draft.preset === "custom" ? (
              <Tooltip title={presetDescription("custom", t)}>
                <Chip
                  size="small"
                  variant="outlined"
                  color="primary"
                  label={presetLabel("custom", t)}
                />
              </Tooltip>
            ) : null
          }
        >
          <PresetPicker
            activeKey={draft.preset}
            method={draft.method}
            onSelect={applyPreset}
          />
        </SectionCard>
      </Hideable>

      {hiddenAdvancedErrors && (
        <Box
          role="alert"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            px: 3,
            py: 2,
            border: 1,
            borderColor: "error.main",
            borderRadius: 1,
          }}
        >
          <Typography variant="body2" color="error.main" sx={{ flex: 1 }}>
            {t("fineTuning:paramsStep.advancedErrors")}
          </Typography>
          <Button
            size="small"
            color="error"
            onClick={() => changeMode(null, "advanced")}
          >
            {t("fineTuning:paramsStep.showAdvanced")}
          </Button>
        </Box>
      )}

      <SectionCard
        {...sectionProps}
        icon={TimerOutlinedIcon}
        title={t("fineTuning:paramsStep.duration.title")}
        subtitle={t("fineTuning:paramsStep.duration.subtitle")}
        action={
          <PillToggleButtonGroup
            value={draft.durationMode}
            onChange={(_e, next) => next && patch({ durationMode: next })}
            size="small"
            aria-label={t("fineTuning:paramsStep.duration.modeLabel")}
            sx={{
              minHeight: 32,
              "& .MuiToggleButtonGroup-grouped": { minHeight: 32, px: 3 },
            }}
          >
            <ToggleButton value="steps">
              {t("fineTuning:paramsStep.duration.steps")}
            </ToggleButton>
            <ToggleButton value="epochs">
              {t("fineTuning:paramsStep.duration.epochs")}
            </ToggleButton>
          </PillToggleButtonGroup>
        }
      >
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, sm: 6 }}>
            {draft.durationMode === "epochs" ? (
              <NumberField
                id={`${idp}-epochs`}
                label={t("fineTuning:paramsStep.fields.epochs")}
                tooltip={t("fineTuning:paramsStep.help.epochs")}
                value={p.epochs}
                onCommit={setParam("epochs")}
                error={errorText("epochs")}
                inputMode="numeric"
                hint={t("fineTuning:paramsStep.range", {
                  min: PARAMETER_LIMITS.epochs.min,
                  max: PARAMETER_LIMITS.epochs.max,
                })}
              />
            ) : (
              <NumberField
                id={`${idp}-maxSteps`}
                label={t("fineTuning:paramsStep.fields.maxSteps")}
                tooltip={t("fineTuning:paramsStep.help.maxSteps")}
                value={p.maxSteps}
                onCommit={setParam("maxSteps")}
                error={errorText("maxSteps")}
                inputMode="numeric"
                hint={t("fineTuning:paramsStep.range", {
                  min: PARAMETER_LIMITS.maxSteps.min,
                  max: PARAMETER_LIMITS.maxSteps.max,
                })}
              />
            )}
          </Grid>
          <Grid
            size={{ xs: 12, sm: 6 }}
            sx={{ display: "flex", alignItems: "center" }}
          >
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                component="p"
              >
                {t("fineTuning:paramsStep.duration.exclusive")}
              </Typography>
              {durationDerived && (
                <DerivedLine color="text.primary">
                  {durationDerived}
                </DerivedLine>
              )}
            </Box>
          </Grid>
        </Grid>
      </SectionCard>

      <SectionCard
        {...sectionProps}
        icon={SpeedIcon}
        title={t("fineTuning:paramsStep.training.title")}
        subtitle={t("fineTuning:paramsStep.training.subtitle")}
      >
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <SelectField
              id={`${idp}-maxLength`}
              label={t("fineTuning:paramsStep.fields.maxLength")}
              tooltip={t("fineTuning:paramsStep.help.maxLength")}
              value={
                MAX_LENGTH_OPTIONS.includes(p.maxLength) ? p.maxLength : ""
              }
              onChange={(v) => setParam("maxLength")(Number(v))}
              options={MAX_LENGTH_OPTIONS.map((n) => ({
                value: n,
                label: t("fineTuning:paramsStep.tokens", { count: n }),
                disabled: checkpoint ? n > checkpoint.contextLength : false,
              }))}
              hint={
                checkpoint
                  ? t("fineTuning:paramsStep.training.maxLengthHint", {
                      context: checkpoint.contextLength,
                    })
                  : t("fineTuning:paramsStep.training.maxLengthHintNoModel")
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <NumberField
              id={`${idp}-lr`}
              label={t("fineTuning:paramsStep.fields.learningRate")}
              tooltip={t("fineTuning:paramsStep.help.learningRate")}
              value={p.learningRate}
              onCommit={setParam("learningRate")}
              error={errorText("learningRate")}
              hint={
                typeof p.learningRate === "number"
                  ? t("fineTuning:paramsStep.training.lrHint", {
                      value: p.learningRate
                        .toFixed(6)
                        .replace(/0+$/, "")
                        .replace(/\.$/, ""),
                    })
                  : null
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <NumberField
              id={`${idp}-batch`}
              label={t("fineTuning:paramsStep.fields.batchSize")}
              tooltip={t("fineTuning:paramsStep.help.batchSize")}
              value={p.batchSize}
              onCommit={setParam("batchSize")}
              error={errorText("batchSize")}
              inputMode="numeric"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <NumberField
              id={`${idp}-accum`}
              label={t("fineTuning:paramsStep.fields.gradAccum")}
              tooltip={t("fineTuning:paramsStep.help.gradAccum")}
              value={p.gradAccum}
              onCommit={setParam("gradAccum")}
              error={errorText("gradAccum")}
              inputMode="numeric"
            />
          </Grid>
        </Grid>
        <Hideable
          id="shared.params.effectiveBatch"
          label={t("fineTuning:viewEditing.sections.paramsEffectiveBatch")}
          level="full"
        >
          <Box
            sx={{
              mt: 1,
              px: 3,
              py: 2,
              borderRadius: 1,
              bgcolor: "action.hover",
              display: "flex",
              gap: 2,
              alignItems: "baseline",
              flexWrap: "wrap",
            }}
            aria-live="polite"
          >
            <Typography variant="body2" color="text.secondary">
              {t("fineTuning:paramsStep.training.effectiveBatch")}
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, fontFamily: '"Geist Mono", monospace' }}
            >
              {effectiveBatch
                ? t("fineTuning:paramsStep.training.effectiveBatchValue", {
                    batch: p.batchSize,
                    accum: p.gradAccum,
                    total: effectiveBatch,
                  })
                : "—"}
            </Typography>
          </Box>
        </Hideable>
      </SectionCard>

      <Hideable
        id="shared.params.lora"
        label={t("fineTuning:viewEditing.sections.paramsLora")}
        level="intermediate"
      >
        <SectionCard
          {...sectionProps}
          icon={LayersOutlinedIcon}
          title={t("fineTuning:paramsStep.lora.title")}
          subtitle={t("fineTuning:paramsStep.lora.subtitle")}
        >
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <NumberField
                id={`${idp}-loraR`}
                label={t("fineTuning:paramsStep.fields.loraR")}
                tooltip={t("fineTuning:paramsStep.help.loraR")}
                value={p.loraR}
                onCommit={setParam("loraR")}
                error={errorText("loraR")}
                inputMode="numeric"
              />
              <Slider
                size="small"
                value={
                  Number.isFinite(Number(p.loraR))
                    ? Math.min(128, Math.max(4, Number(p.loraR)))
                    : 16
                }
                min={4}
                max={128}
                step={null}
                marks={[4, 8, 16, 32, 64, 128].map((v) => ({
                  value: v,
                  label: String(v),
                }))}
                onChange={(_e, v) => setParam("loraR")(v)}
                aria-label={t("fineTuning:paramsStep.fields.loraR")}
                sx={{ mt: -2, mx: 1, width: "calc(100% - 8px)" }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <NumberField
                id={`${idp}-loraAlpha`}
                label={t("fineTuning:paramsStep.fields.loraAlpha")}
                tooltip={t("fineTuning:paramsStep.help.loraAlpha")}
                value={p.loraAlpha}
                onCommit={setParam("loraAlpha")}
                error={errorText("loraAlpha")}
              />
              {Number.isFinite(Number(p.loraR)) &&
                Number(p.loraAlpha) !== 2 * Number(p.loraR) && (
                  <Button
                    size="small"
                    onClick={() => setParam("loraAlpha")(2 * Number(p.loraR))}
                    sx={{ mt: -2 }}
                  >
                    {t("fineTuning:paramsStep.lora.useDoubleR", {
                      value: 2 * Number(p.loraR),
                    })}
                  </Button>
                )}
            </Grid>
            {mode === "advanced" && (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FieldLabel
                    label={t("fineTuning:paramsStep.fields.loraDropout")}
                    tooltip={t("fineTuning:paramsStep.help.loraDropout")}
                  />
                  <Stack direction="row" spacing={3} alignItems="center">
                    <Slider
                      size="small"
                      value={
                        Number.isFinite(Number(p.loraDropout))
                          ? Math.min(0.3, Number(p.loraDropout))
                          : 0.05
                      }
                      min={0}
                      max={0.3}
                      step={0.01}
                      onChange={(_e, v) =>
                        setParam("loraDropout")(Math.round(v * 100) / 100)
                      }
                      aria-label={t("fineTuning:paramsStep.fields.loraDropout")}
                      sx={{ flex: 1 }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        minWidth: 40,
                        fontFamily: '"Geist Mono", monospace',
                      }}
                    >
                      {formatNumber(p.loraDropout)}
                    </Typography>
                  </Stack>
                  {errors.loraDropout && (
                    <Typography variant="caption" color="error.main">
                      {errorText("loraDropout")}
                    </Typography>
                  )}
                </Grid>
                <Hideable
                  id="shared.params.targetModules"
                  label={t(
                    "fineTuning:viewEditing.sections.paramsTargetModules",
                  )}
                  level="full"
                  sx={{ width: "100%" }}
                >
                  <Grid size={{ xs: 12 }}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      spacing={2}
                    >
                      <FieldLabel
                        label={t("fineTuning:paramsStep.fields.targetModules")}
                        tooltip={t("fineTuning:paramsStep.help.targetModules")}
                      />
                      <Stack direction="row" spacing={1}>
                        <Chip
                          size="small"
                          clickable
                          color={allModules ? "primary" : "default"}
                          variant={allModules ? "filled" : "outlined"}
                          label={t("fineTuning:paramsStep.lora.allLinear")}
                          onClick={() =>
                            setParam("targetModules")([...ALL_TARGET_MODULES])
                          }
                        />
                        <Chip
                          size="small"
                          clickable
                          variant="outlined"
                          label={t("fineTuning:paramsStep.lora.attentionOnly")}
                          onClick={() =>
                            setParam("targetModules")([
                              "q_proj",
                              "k_proj",
                              "v_proj",
                              "o_proj",
                            ])
                          }
                        />
                      </Stack>
                    </Stack>
                    <Box
                      role="group"
                      aria-label={t(
                        "fineTuning:paramsStep.fields.targetModules",
                      )}
                      sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}
                    >
                      {ALL_TARGET_MODULES.map((m) => {
                        const on = (p.targetModules || []).includes(m);
                        return (
                          <Chip
                            key={m}
                            size="small"
                            clickable
                            aria-pressed={on}
                            color={on ? "primary" : "default"}
                            variant={on ? "filled" : "outlined"}
                            label={m}
                            onClick={() => toggleModule(m)}
                            sx={{ fontFamily: '"Geist Mono", monospace' }}
                          />
                        );
                      })}
                    </Box>
                    <Typography
                      variant="caption"
                      color={
                        errors.targetModules ? "error.main" : "text.secondary"
                      }
                      component="p"
                      sx={{ mt: 1 }}
                    >
                      {errors.targetModules
                        ? errorText("targetModules")
                        : t("fineTuning:paramsStep.lora.modulesHint", {
                            count: (p.targetModules || []).length,
                          })}
                    </Typography>
                  </Grid>
                </Hideable>
              </>
            )}
          </Grid>
          {draft.method === "qlora" && (
            <Hideable
              id="shared.params.qloraInfo"
              label={t("fineTuning:viewEditing.sections.paramsQloraInfo")}
              level="full"
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="flex-start"
                sx={{ mt: 2 }}
              >
                <InfoOutlinedIcon
                  fontSize="small"
                  sx={{ color: "text.secondary", mt: 0.25 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {t("fineTuning:catalog.quantization")}
                </Typography>
              </Stack>
            </Hideable>
          )}
        </SectionCard>
      </Hideable>

      {mode === "advanced" && (
        <Hideable
          id="shared.params.optimization"
          label={t("fineTuning:viewEditing.sections.paramsOptimization")}
          level="full"
        >
          <SectionCard
            {...sectionProps}
            icon={AutoGraphIcon}
            title={t("fineTuning:paramsStep.optimization.title")}
            subtitle={t("fineTuning:paramsStep.optimization.subtitle")}
          >
            <Grid container spacing={4}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <SelectField
                  id={`${idp}-optimizer`}
                  label={t("fineTuning:paramsStep.fields.optimizer")}
                  tooltip={t("fineTuning:paramsStep.help.optimizer")}
                  value={p.optimizer}
                  onChange={setParam("optimizer")}
                  options={[
                    {
                      value: "adamw_8bit",
                      label: t("fineTuning:paramsStep.optimizers.adamw_8bit"),
                    },
                    {
                      value: "adamw_torch",
                      label: t("fineTuning:paramsStep.optimizers.adamw_torch"),
                    },
                  ]}
                  hint={errors.optimizer ? errorText("optimizer") : null}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <SelectField
                  id={`${idp}-scheduler`}
                  label={t("fineTuning:paramsStep.fields.scheduler")}
                  tooltip={t("fineTuning:paramsStep.help.scheduler")}
                  value={p.scheduler}
                  onChange={setParam("scheduler")}
                  options={["linear", "cosine", "constant"].map((s) => ({
                    value: s,
                    label: t(`fineTuning:paramsStep.schedulers.${s}`),
                  }))}
                  hint={errors.scheduler ? errorText("scheduler") : null}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <NumberField
                  id={`${idp}-warmup`}
                  label={t("fineTuning:paramsStep.fields.warmupSteps")}
                  tooltip={t("fineTuning:paramsStep.help.warmupSteps")}
                  value={p.warmupSteps}
                  onCommit={setParam("warmupSteps")}
                  error={errorText("warmupSteps")}
                  inputMode="numeric"
                  hint={
                    warmupTooLong
                      ? t("fineTuning:paramsStep.optimization.warmupTooLong", {
                          steps: totalSteps,
                        })
                      : null
                  }
                />
              </Grid>
            </Grid>
          </SectionCard>
        </Hideable>
      )}

      {mode === "advanced" && (
        <Hideable
          id="shared.params.evaluation"
          label={t("fineTuning:viewEditing.sections.paramsEvaluation")}
          level="full"
        >
          <SectionCard
            {...sectionProps}
            icon={FactCheckOutlinedIcon}
            title={t("fineTuning:paramsStep.evaluation.title")}
            subtitle={t("fineTuning:paramsStep.evaluation.subtitle")}
          >
            <Grid container spacing={4}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <NumberField
                  id={`${idp}-evalEvery`}
                  label={t("fineTuning:paramsStep.fields.evalEvery")}
                  tooltip={t("fineTuning:paramsStep.help.evalEvery")}
                  value={p.evalEvery}
                  onCommit={setParam("evalEvery")}
                  error={errorText("evalEvery")}
                  inputMode="numeric"
                  hint={
                    useEval
                      ? null
                      : t("fineTuning:paramsStep.evaluation.noEval")
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <NumberField
                  id={`${idp}-seed`}
                  label={t("fineTuning:paramsStep.fields.seed")}
                  tooltip={t("fineTuning:paramsStep.help.seed")}
                  value={p.seed}
                  onCommit={setParam("seed")}
                  error={errorText("seed")}
                  inputMode="numeric"
                />
              </Grid>
            </Grid>
          </SectionCard>
        </Hideable>
      )}

      <Hideable
        id="shared.params.vramEstimate"
        label={t("fineTuning:viewEditing.sections.paramsVramEstimate")}
        level="intermediate"
      >
        <SectionCard
          {...sectionProps}
          icon={MemoryIcon}
          title={t("fineTuning:paramsStep.memory.title")}
          subtitle={
            checkpoint
              ? t("fineTuning:paramsStep.memory.subtitle", {
                  model: checkpoint.name,
                  method: t(`fineTuning:catalog.methods.${draft.method}.name`),
                })
              : t("fineTuning:paramsStep.memory.noModel")
          }
        >
          <VramEstimate
            checkpoint={checkpoint}
            method={draft.method}
            parameters={p}
          />
        </SectionCard>
      </Hideable>
    </Stack>
  );
}

ParametersStep.propTypes = {
  session: PropTypes.shape({ id: PropTypes.string, draft: PropTypes.object }),
  value: PropTypes.object,
  onChange: PropTypes.func,
  trainCount: PropTypes.number,
  dense: PropTypes.bool,
};
