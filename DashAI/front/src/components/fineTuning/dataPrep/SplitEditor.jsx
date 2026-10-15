import { useEffect, useId, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  FormControlLabel,
  Slider,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { partitionCounts } from "../data/sft";
import { DEFAULT_SPLITS } from "./useDataPreparation";

const MAX_EVAL_PERCENT = 30;

function CountTile({ label, value, color }) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 120,
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        px: 3,
        py: 2,
      }}
    >
      <Typography variant="caption" color="text.secondary" component="p">
        {label}
      </Typography>
      <Typography variant="h6" sx={{ color }}>
        {value}
      </Typography>
    </Box>
  );
}

CountTile.propTypes = {
  label: PropTypes.node,
  value: PropTypes.node,
  color: PropTypes.string,
};

/** Number field that keeps its own text while typing and emits valid ints. */
function IntField({
  value,
  onCommit,
  min,
  max,
  allowEmpty,
  helperText,
  errorText,
  ...rest
}) {
  const [text, setText] = useState(
    value === null || value === undefined ? "" : String(value),
  );
  useEffect(() => {
    setText(value === null || value === undefined ? "" : String(value));
  }, [value]);
  const parsed = text.trim() === "" ? null : Number(text);
  const invalid =
    (parsed === null && !allowEmpty) ||
    (parsed !== null &&
      (!Number.isInteger(parsed) ||
        parsed < min ||
        (max !== undefined && parsed > max)));
  return (
    <TextField
      {...rest}
      size="small"
      fullWidth
      type="number"
      value={text}
      error={invalid}
      slotProps={{ htmlInput: { min, max, step: 1 } }}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        const n = next.trim() === "" ? null : Number(next);
        const ok =
          (n === null && allowEmpty) ||
          (n !== null &&
            Number.isInteger(n) &&
            n >= min &&
            (max === undefined || n <= max));
        if (ok) onCommit(n);
      }}
      helperText={invalid ? errorText : helperText}
    />
  );
}

IntField.propTypes = {
  value: PropTypes.number,
  onCommit: PropTypes.func.isRequired,
  min: PropTypes.number,
  max: PropTypes.number,
  allowEmpty: PropTypes.bool,
  helperText: PropTypes.node,
  errorText: PropTypes.node,
};

/**
 * Train/eval split editor: eval fraction slider (1–30 %), "Sin evaluación"
 * switch, seed, max samples, and the resulting counts.
 *
 * @param {object} props
 * @param {{evalFraction, seed, useEval}} props.splits
 * @param {number|null} [props.maxSamples] null = all rows
 * @param {number} props.totalRows dataset rows
 * @param {(patch: {splits?: object, maxSamples?: number|null}) => void} props.onChange
 *   `splits` is always sent whole
 * @param {boolean} [props.disabled]
 */
export default function SplitEditor({
  splits,
  maxSamples,
  totalRows,
  onChange,
  disabled,
}) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const sliderLabelId = useId();
  const value = { ...DEFAULT_SPLITS, ...(splits || {}) };
  const useEval = value.useEval !== false;
  const percent = Math.round((Number(value.evalFraction) || 0) * 100);
  const total = Math.max(0, Number(totalRows) || 0);
  const limit = Number(maxSamples) > 0 ? Number(maxSamples) : null;
  const used = limit ? Math.min(total, limit) : total;
  const counts = partitionCounts(used, value);
  const emitSplits = (patch) =>
    onChange && onChange({ splits: { ...value, ...patch } });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Grid container spacing={4} sx={{ alignItems: "center" }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600 }}
            id={sliderLabelId}
          >
            {t("fineTuning:dataPrep.split.evalFraction", {
              percent: useEval ? percent : 0,
            })}
          </Typography>
          <Slider
            size="small"
            aria-labelledby={sliderLabelId}
            min={1}
            max={MAX_EVAL_PERCENT}
            step={1}
            value={Math.min(MAX_EVAL_PERCENT, Math.max(1, percent))}
            disabled={disabled || !useEval}
            valueLabelDisplay="auto"
            valueLabelFormat={(x) => `${x}%`}
            marks={[
              { value: 1, label: "1%" },
              { value: 10, label: "10%" },
              { value: 20, label: "20%" },
              { value: 30, label: "30%" },
            ]}
            onChange={(_, x) =>
              emitSplits({ evalFraction: Math.round(Number(x)) / 100 })
            }
          />
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={!useEval}
                disabled={disabled}
                onChange={(e) => emitSplits({ useEval: !e.target.checked })}
              />
            }
            label={
              <Typography variant="body2">
                {t("fineTuning:dataPrep.split.noEval")}
              </Typography>
            }
          />
          <Typography variant="caption" color="text.secondary" component="p">
            {t("fineTuning:dataPrep.split.noEvalHelp")}
          </Typography>
        </Grid>
      </Grid>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <IntField
            label={t("fineTuning:dataPrep.split.seed")}
            value={Number.isInteger(value.seed) ? value.seed : 42}
            min={0}
            max={2147483647}
            disabled={disabled}
            onCommit={(n) => emitSplits({ seed: n })}
            helperText={t("fineTuning:dataPrep.split.seedHelp")}
            errorText={t("fineTuning:validation.params.not_integer")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <IntField
            label={t("fineTuning:dataPrep.split.maxSamples")}
            value={limit}
            min={2}
            allowEmpty
            disabled={disabled}
            placeholder={t("fineTuning:dataPrep.split.allRows")}
            onCommit={(n) => onChange && onChange({ maxSamples: n })}
            helperText={t("fineTuning:dataPrep.split.maxSamplesHelp", {
              total,
            })}
            errorText={t("fineTuning:validation.params.out_of_range")}
          />
        </Grid>
      </Grid>

      <Box
        sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}
        aria-live="polite"
      >
        <CountTile label={t("fineTuning:dataPrep.split.used")} value={used} />
        <CountTile
          label={t("fineTuning:dataPrep.split.train")}
          value={counts.train}
          color="chart.train"
        />
        <CountTile
          label={t("fineTuning:dataPrep.split.eval")}
          value={useEval ? counts.eval : "—"}
          color="chart.validation"
        />
      </Box>
      {!counts.ok && total > 0 && (
        <Alert severity="error" sx={{ py: 0.5 }}>
          {t("fineTuning:validation.start.insufficient_rows")}
        </Alert>
      )}
      {!useEval && (
        <Typography variant="caption" color="warning.main">
          {t("fineTuning:validation.warn.no_eval")}
        </Typography>
      )}
    </Box>
  );
}

SplitEditor.propTypes = {
  splits: PropTypes.object,
  maxSamples: PropTypes.number,
  totalRows: PropTypes.number,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
};
