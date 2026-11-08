import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ModelTrainingIcon from "@mui/icons-material/ModelTraining";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import ModelStep from "../../../components/fineTuning/steps/ModelStep";
import ParametersStep, {
  resolveDraft,
} from "../../../components/fineTuning/steps/ParametersStep";
import useStepValidation from "../../../components/fineTuning/steps/useStepValidation";
import {
  buildPreflightChecks,
  buildRunSummary,
} from "../../../components/fineTuning/steps/ReviewStep";
import SectionCard from "../../../components/fineTuning/common/SectionCard";
import KeyValueList from "../../../components/fineTuning/common/KeyValueList";
import {
  useFineTuningActions,
  useFineTuningStore,
} from "../../../components/fineTuning/FineTuningContext";
import { extractRunConfig } from "../../../components/fineTuning/data/store";
import {
  checkpointById,
  runById,
} from "../../../components/fineTuning/data/selectors";
import {
  blockerLabel,
  methodLabel,
} from "../../../components/fineTuning/data/labels";

export const CONFIG_STEPS = Object.freeze(["model", "parameters", "review"]);

// Blockers that only matter when training starts (B creates the
// configuration without starting it; trainRun checks them later).
const TRAIN_TIME_BLOCKERS = new Set([
  "download_not_confirmed",
  "credential_required",
]);

const STATUS_ICON = {
  valid: { Icon: CheckCircleOutlineIcon, color: "success.main" },
  warning: { Icon: WarningAmberOutlinedIcon, color: "warning.main" },
  error: { Icon: ErrorOutlineIcon, color: "error.main" },
  pending: { Icon: RadioButtonUncheckedIcon, color: "text.disabled" },
};

/** Default configuration name: "<modelo> · <método> r<rango>", unique in the session. */
export function suggestConfigName(checkpoint, config, takenNames, t) {
  if (!checkpoint) return "";
  const r = config && config.parameters ? config.parameters.loraR : null;
  const base =
    [
      checkpoint.name,
      config && config.method ? methodLabel(config.method, t) : null,
    ]
      .filter(Boolean)
      .join(" · ") + (r ? ` r${r}` : "");
  const taken = new Set(takenNames || []);
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base} (${i})`)) i += 1;
  return `${base} (${i})`;
}

function initialValue(session, run, checkpointId) {
  if (run) {
    return {
      ...extractRunConfig(run.snapshot.draft),
      runName: run.name,
      downloadConfirmed: false,
    };
  }
  const base = extractRunConfig((session && session.draft) || {});
  return {
    ...base,
    checkpointId: checkpointId || base.checkpointId || null,
    runName: "",
    downloadConfirmed: false,
  };
}

/** Review content of the dialog (summary + "Validación previa" for this configuration). */
function ConfigReview({ v, t }) {
  const s = buildRunSummary(v, t);
  const checks = buildPreflightChecks(v, t);
  if (!s) return null;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard
            dense
            icon={ModelTrainingIcon}
            title={t("fineTuning:shellB.dialog.review.model")}
          >
            <KeyValueList
              dense
              rows={[
                {
                  label: t("fineTuning:shellB.dialog.review.checkpoint"),
                  value: s.modelName,
                },
                {
                  label: t("fineTuning:shellB.dialog.review.repository"),
                  value: s.repository,
                  mono: true,
                },
                {
                  label: t("fineTuning:shellB.dialog.review.revision"),
                  value: s.revisionShort,
                  mono: true,
                },
                {
                  label: t("fineTuning:shellB.dialog.review.method"),
                  value: s.method,
                },
                {
                  label: t("fineTuning:shellB.dialog.review.download"),
                  value: s.download,
                },
              ]}
            />
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard
            dense
            icon={TableChartOutlinedIcon}
            title={t("fineTuning:shellB.dialog.review.data")}
            subtitle={t("fineTuning:shellB.dialog.review.dataFixed")}
          >
            <KeyValueList
              dense
              rows={[
                {
                  label: t("fineTuning:shellB.dialog.review.dataset"),
                  value: s.datasetName,
                },
                {
                  label: t("fineTuning:shellB.dialog.review.format"),
                  value: s.format,
                },
                {
                  label: t("fineTuning:shellB.dialog.review.split"),
                  value: s.split,
                },
                {
                  label: t("fineTuning:shellB.dialog.review.fingerprint"),
                  value: s.fingerprintShort,
                  mono: true,
                },
              ]}
            />
          </SectionCard>
        </Grid>
        <Grid size={12}>
          <SectionCard
            dense
            icon={TuneIcon}
            title={t("fineTuning:shellB.dialog.review.training")}
          >
            <KeyValueList
              dense
              rows={[
                {
                  label: t("fineTuning:shellB.dialog.review.preset"),
                  value: s.preset,
                },
                {
                  label: t("fineTuning:shellB.dialog.review.duration"),
                  value: s.duration,
                },
                {
                  label: t("fineTuning:shellB.dialog.review.learningRate"),
                  value: s.learningRate,
                  mono: true,
                },
                {
                  label: t("fineTuning:shellB.dialog.review.maxLength"),
                  value: s.maxLength,
                },
                {
                  label: t("fineTuning:shellB.dialog.review.effectiveBatch"),
                  value: s.effectiveBatch,
                },
                {
                  label: t("fineTuning:shellB.dialog.review.lora"),
                  value: s.lora,
                },
                {
                  label: t("fineTuning:shellB.dialog.review.vram"),
                  value: `${s.vramEstimated} / ${s.vramAvailable}`,
                },
              ]}
            />
          </SectionCard>
        </Grid>
      </Grid>
      <SectionCard
        dense
        icon={FactCheckOutlinedIcon}
        title={t("fineTuning:shellB.dialog.review.checksTitle")}
        subtitle={t("fineTuning:shellB.dialog.review.checksSubtitle")}
      >
        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
          {checks.map((check) => {
            const { Icon, color } =
              STATUS_ICON[check.status] || STATUS_ICON.pending;
            return (
              <Box
                component="li"
                key={check.key}
                data-testid={`config-check-${check.key}`}
                data-status={check.status}
                sx={{
                  display: "flex",
                  gap: 3,
                  py: 2,
                  alignItems: "flex-start",
                  "&:not(:last-of-type)": {
                    borderBottom: 1,
                    borderColor: "divider",
                  },
                }}
              >
                <Icon sx={{ color, fontSize: 20, mt: 0.25, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {check.title}
                  </Typography>
                  {check.detail && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      component="p"
                    >
                      {check.detail}
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </SectionCard>
    </Box>
  );
}

ConfigReview.propTypes = {
  v: PropTypes.object.isRequired,
  t: PropTypes.func.isRequired,
};

/**
 * Prototype B run-configuration dialog, with the shell of Models'
 * AddModelDialog (DialogTitle + close, Stepper, `DialogContent dividers`,
 * Cancelar / Atrás / Siguiente → Crear configuración). Steps: Modelo y
 * método (ModelStep methodOnly) → Parámetros (ParametersStep) → Revisión.
 * Creating a configuration registers a run with status 0 (not started); it
 * trains only when the user clicks Entrenar.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object} props.session store session (holds the data preparation)
 * @param {string} [props.checkpointId] preselected base model (create mode)
 * @param {string} [props.runId] status-0 run to edit (edit mode)
 * @param {"model"|"parameters"|"review"} [props.initialStep]
 * @param {(runId: string) => void} [props.onSaved]
 */
export default function RunConfigDialog({
  open,
  onClose,
  session,
  checkpointId,
  runId,
  initialStep,
  onSaved,
}) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const store = useFineTuningActions();
  const { enqueueSnackbar } = useSnackbar();
  const run = useFineTuningStore((s) => (runId ? runById(s, runId) : null));
  const checkpoints = useFineTuningStore((s) => s.checkpoints);
  const sessionRunNames = useFineTuningStore((s) =>
    session
      ? s.runs.filter((r) => r.sessionId === session.id).map((r) => r.name)
      : [],
  );
  const editing = Boolean(runId);

  const [activeStep, setActiveStep] = useState(0);
  const [value, setValue] = useState(() =>
    initialValue(session, run, checkpointId),
  );
  const [nameTouched, setNameTouched] = useState(false);

  // Re-initialise every time the dialog opens (or its target changes);
  // `session` and `run` are read from a ref because they change while open.
  const latest = useRef({ session, run });
  latest.current = { session, run };
  useEffect(() => {
    if (!open) return;
    setValue(
      initialValue(latest.current.session, latest.current.run, checkpointId),
    );
    setNameTouched(editing);
    const index = CONFIG_STEPS.indexOf(initialStep);
    setActiveStep(index > 0 ? index : 0);
  }, [open, runId, checkpointId, initialStep, editing]);

  const checkpoint = value.checkpointId
    ? checkpointById({ checkpoints }, value.checkpointId)
    : null;
  const otherNames = useMemo(
    () => sessionRunNames.filter((n) => !run || n !== run.name),
    [sessionRunNames, run],
  );
  const suggestedName = suggestConfigName(checkpoint, value, otherNames, t);
  const effectiveName = nameTouched ? value.runName || "" : suggestedName;

  const v = useStepValidation(session, { configDraft: value });
  const reviewV = useMemo(() => {
    if (!v.session) return v;
    const draft = resolveDraft(v.session, value);
    return {
      ...v,
      session: { ...v.session, draft },
      checkpoint,
      review: {
        ...v.review,
        blockers: v.review.blockers.filter(
          (c) => c !== "download_not_confirmed",
        ),
      },
    };
  }, [v, value, checkpoint]);

  const modelOk =
    v.model.blockers.filter((c) => !TRAIN_TIME_BLOCKERS.has(c)).length === 0;
  const paramsOk = v.parameters.valid;
  const creationBlockers = v.review.blockers.filter(
    (c) => !TRAIN_TIME_BLOCKERS.has(c),
  );
  const canSave =
    creationBlockers.length === 0 && effectiveName.trim().length > 0;
  const stepOk =
    activeStep === 0 ? modelOk : activeStep === 1 ? paramsOk : canSave;
  const nextReason = stepOk
    ? ""
    : activeStep === 0
      ? blockerLabel(
          v.model.blockers.find((c) => !TRAIN_TIME_BLOCKERS.has(c)) ||
            "no_checkpoint",
          t,
        )
      : activeStep === 1
        ? blockerLabel("invalid_parameters", t)
        : creationBlockers.length
          ? blockerLabel(creationBlockers[0], t)
          : t("fineTuning:shellB.dialog.nameRequired");

  const steps = CONFIG_STEPS.map((key) =>
    t(`fineTuning:shellB.dialog.steps.${key}`),
  );
  const last = activeStep === steps.length - 1;

  const save = () => {
    if (!session || !canSave) return;
    const config = { ...value, runName: effectiveName.trim() };
    try {
      let id;
      if (editing) {
        id = store.updateRunConfig(runId, config);
        enqueueSnackbar(
          t("fineTuning:shellB.dialog.updated", { name: config.runName }),
          { variant: "success" },
        );
      } else {
        id = store.createRunConfig(session.id, config);
        enqueueSnackbar(
          t("fineTuning:shellB.dialog.created", { name: config.runName }),
          { variant: "success" },
        );
      }
      if (onSaved) onSaved(id);
      onClose();
    } catch (e) {
      enqueueSnackbar(
        blockerLabel((e && (e.code || e.message)) || "unknown", t),
        { variant: "error" },
      );
    }
  };

  const handleNext = () => {
    if (!stepOk) return;
    if (last) save();
    else setActiveStep((s) => s + 1);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { minHeight: "500px" } }}
    >
      <DialogTitle sx={{ bgcolor: "background.paper" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          {editing
            ? t("fineTuning:shellB.dialog.editTitle")
            : t("fineTuning:shellB.dialog.title")}
          <IconButton
            onClick={onClose}
            size="small"
            sx={{ color: "text.secondary" }}
            aria-label={t("common:cancel")}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ bgcolor: "background.paper" }}>
        <Stepper activeStep={activeStep} sx={{ mb: 6 }}>
          {steps.map((label) => (
            <Step key={label} completed={false}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {!session ? (
          <Typography variant="body2" color="text.secondary">
            {t("fineTuning:shellB.session.notFound")}
          </Typography>
        ) : (
          <>
            {activeStep === 0 && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <TextField
                  label={t("fineTuning:shellB.dialog.nameLabel")}
                  value={effectiveName}
                  onChange={(e) => {
                    setNameTouched(true);
                    setValue((prev) => ({ ...prev, runName: e.target.value }));
                  }}
                  fullWidth
                  required
                  size="small"
                  helperText={t("fineTuning:shellB.dialog.nameHelp")}
                />
                <ModelStep
                  session={session}
                  methodOnly
                  value={value}
                  onChange={setValue}
                  dense
                />
              </Box>
            )}
            {activeStep === 1 && (
              <ParametersStep
                session={session}
                value={value}
                onChange={setValue}
                dense
              />
            )}
            {activeStep === 2 && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <ConfigReview v={reviewV} t={t} />
                {v.review.blockers.includes("credential_required") && (
                  <Alert severity="warning" sx={{ py: 0.5 }}>
                    {t("fineTuning:shellB.dialog.credentialLater")}
                  </Alert>
                )}
                <Typography variant="caption" color="text.secondary">
                  {t("fineTuning:shellB.dialog.notStartedNote")}
                </Typography>
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 4, bgcolor: "background.paper" }}>
        <Button variant="outlined" onClick={onClose}>
          {t("common:cancel")}
        </Button>
        {activeStep > 0 && (
          <Button
            variant="outlined"
            onClick={() => setActiveStep((s) => s - 1)}
          >
            {t("common:back")}
          </Button>
        )}
        <Tooltip
          title={nextReason}
          disableHoverListener={!nextReason}
          disableFocusListener={!nextReason}
        >
          <span>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={!session || !stepOk}
            >
              {last
                ? editing
                  ? t("fineTuning:shellB.dialog.save")
                  : t("fineTuning:shellB.dialog.create")
                : t("common:next")}
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
}

RunConfigDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  session: PropTypes.object,
  checkpointId: PropTypes.string,
  runId: PropTypes.string,
  initialStep: PropTypes.oneOf(CONFIG_STEPS),
  onSaved: PropTypes.func,
};
