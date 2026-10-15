import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import DownloadIcon from "@mui/icons-material/Download";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import SectionCard, { SelectableCard } from "../common/SectionCard";
import VramEstimate, {
  VramRiskChip,
  estimateDraftVram,
} from "../common/VramEstimate";
import { formatBytes } from "../data/catalog";
import {
  availabilityColor,
  checkpointAvailabilityLabel,
  checkpointDescription,
  methodLabel,
} from "../data/labels";
import { useFineTuningActions, useFineTuningStore } from "../FineTuningContext";
import { useHardwareProfile } from "../hooks/useHardwareProfile";
import { useDraftEditor } from "./ParametersStep";

const METHOD_ORDER = ["qlora", "lora"];

const selectCheckpoints = (s) => s.checkpoints || [];
const selectCredential = (s) => Boolean(s.demo && s.demo.hfCredential);

const mono = { fontFamily: '"Geist Mono", monospace' };

function shortRevision(revision) {
  return revision ? String(revision).slice(0, 7) : "";
}

/** Method used for a checkpoint's estimate: the draft's, if supported. */
function methodFor(checkpoint, method) {
  return checkpoint.methods.includes(method) ? method : checkpoint.methods[0];
}

// ---------------------------------------------------------------------------
// Catalog card
// ---------------------------------------------------------------------------

function CheckpointCard({
  checkpoint,
  selected,
  method,
  parameters,
  hardware,
  credential,
  onSelect,
}) {
  const { t } = useTranslation(["fineTuning"]);
  const locked = checkpoint.gated && !credential;
  const usedMethod = methodFor(checkpoint, method);
  const estimate = estimateDraftVram(checkpoint, usedMethod, parameters);
  const downloading = checkpoint.availability === "downloading";
  const pct = checkpoint.diskBytes
    ? Math.round((checkpoint.downloadedBytes / checkpoint.diskBytes) * 100)
    : 0;
  return (
    <SelectableCard
      selected={selected}
      onSelect={onSelect}
      ariaLabel={checkpoint.name}
    >
      <Stack spacing={2} sx={{ height: "100%" }}>
        <Stack direction="row" alignItems="flex-start" spacing={1}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
              {checkpoint.name}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              noWrap
              sx={mono}
            >
              {checkpoint.repository}
            </Typography>
          </Box>
          {checkpoint.gated && (
            <Tooltip
              title={
                locked
                  ? t("fineTuning:modelStep.gated.lockedTooltip")
                  : t("fineTuning:modelStep.gated.unlockedTooltip")
              }
            >
              {locked ? (
                <LockOutlinedIcon
                  fontSize="small"
                  color="warning"
                  aria-label={t("fineTuning:modelStep.gated.locked")}
                />
              ) : (
                <LockOpenOutlinedIcon
                  fontSize="small"
                  color="success"
                  aria-label={t("fineTuning:modelStep.gated.unlocked")}
                />
              )}
            </Tooltip>
          )}
          {selected && <CheckIcon fontSize="small" color="primary" />}
        </Stack>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {checkpointDescription(checkpoint, t)}
        </Typography>

        <Typography variant="caption" color="text.secondary" component="p">
          {t("fineTuning:modelStep.card.meta", {
            params: checkpoint.parametersB,
            size: formatBytes(checkpoint.diskBytes),
          })}
          {" · "}
          <Tooltip
            title={t("fineTuning:modelStep.card.revisionTooltip", {
              revision: checkpoint.revision,
            })}
          >
            <Box
              component="span"
              sx={{
                ...mono,
                cursor: "help",
                borderBottom: "1px dotted",
                borderColor: "text.disabled",
              }}
            >
              {t("fineTuning:modelStep.card.revision", {
                revision: shortRevision(checkpoint.revision),
              })}
            </Box>
          </Tooltip>
        </Typography>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {locked ? (
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              icon={<LockOutlinedIcon />}
              label={t("fineTuning:availability.credentialRequired")}
            />
          ) : (
            <Chip
              size="small"
              color={availabilityColor(checkpoint.availability)}
              variant={
                checkpoint.availability === "ready" ? "filled" : "outlined"
              }
              label={
                checkpoint.availability === "missing"
                  ? t("fineTuning:modelStep.card.willDownload", {
                      size: formatBytes(checkpoint.diskBytes),
                    })
                  : checkpointAvailabilityLabel(checkpoint.availability, t)
              }
            />
          )}
          {METHOD_ORDER.filter((m) => checkpoint.methods.includes(m)).map(
            (m) => (
              <Chip
                key={m}
                size="small"
                variant="outlined"
                label={methodLabel(m, t)}
              />
            ),
          )}
          <VramRiskChip estimatedGb={estimate} availableGb={hardware.vramGb} />
        </Stack>

        {downloading && (
          <Box>
            <LinearProgress
              variant="determinate"
              value={pct}
              aria-label={t("fineTuning:modelStep.download.progressLabel")}
              sx={{ height: 4, borderRadius: 1 }}
            />
            <Typography variant="caption" color="text.secondary">
              {t("fineTuning:modelStep.download.percent", { percent: pct })}
            </Typography>
          </Box>
        )}

        <Box sx={{ mt: "auto" }}>
          <VramEstimate
            variant="compact"
            estimatedGb={estimate}
            hardware={hardware}
            label={t("fineTuning:modelStep.card.vramLabel", {
              method: methodLabel(usedMethod, t),
            })}
          />
        </Box>
      </Stack>
    </SelectableCard>
  );
}

CheckpointCard.propTypes = {
  checkpoint: PropTypes.object.isRequired,
  selected: PropTypes.bool,
  method: PropTypes.string,
  parameters: PropTypes.object,
  hardware: PropTypes.object.isRequired,
  credential: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
};

// ---------------------------------------------------------------------------
// Download / credential state of the selected checkpoint
// ---------------------------------------------------------------------------

function CheckpointFilesState({
  checkpoint,
  credential,
  downloadConfirmed,
  onConfirmChange,
}) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const store = useFineTuningActions();
  const { enqueueSnackbar } = useSnackbar();
  const size = formatBytes(checkpoint.diskBytes);
  const locked = checkpoint.gated && !credential;

  const download = () => {
    const code = store.downloadCheckpoint(checkpoint.id);
    if (code === "credential_required") {
      enqueueSnackbar(t("fineTuning:modelStep.gated.downloadBlocked"), {
        variant: "warning",
      });
    } else if (code) {
      enqueueSnackbar(t("fineTuning:modelStep.download.failed"), {
        variant: "error",
      });
    } else {
      enqueueSnackbar(
        t("fineTuning:modelStep.download.started", { name: checkpoint.name }),
        { variant: "info" },
      );
    }
  };
  const cancel = () => {
    const code = store.cancelDownload(checkpoint.id);
    if (code === "download_owned_by_run") {
      enqueueSnackbar(t("fineTuning:modelStep.download.ownedByRun"), {
        variant: "info",
      });
    }
  };

  const box = (children, borderColor = "divider") => (
    <Box
      aria-live="polite"
      sx={{
        mt: 4,
        p: 3,
        border: 1,
        borderColor,
        borderRadius: 1,
        bgcolor: "background.paper",
      }}
    >
      {children}
    </Box>
  );

  if (locked) {
    return box(
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <VpnKeyOutlinedIcon
          color="warning"
          fontSize="small"
          sx={{ mt: 0.25 }}
        />
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {t("fineTuning:modelStep.gated.title")}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p">
            {t("fineTuning:modelStep.gated.body")}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            component="p"
            sx={{ mt: 1 }}
          >
            {t("fineTuning:modelStep.gated.demoHint")}
          </Typography>
        </Box>
      </Stack>,
      "warning.main",
    );
  }

  if (checkpoint.availability === "ready") {
    return box(
      <Stack direction="row" spacing={2} alignItems="center">
        <CheckCircleOutlineIcon color="success" fontSize="small" />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2">
            {t("fineTuning:modelStep.download.ready")}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            component="p"
            noWrap
            sx={mono}
          >
            {t("fineTuning:modelStep.download.path", {
              repository: checkpoint.repository,
              revision: shortRevision(checkpoint.revision),
            })}
          </Typography>
        </Box>
      </Stack>,
    );
  }

  if (checkpoint.availability === "downloading") {
    const pct = checkpoint.diskBytes
      ? Math.round((checkpoint.downloadedBytes / checkpoint.diskBytes) * 100)
      : 0;
    return box(
      <Box>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            {t("fineTuning:modelStep.download.downloading", {
              done: formatBytes(checkpoint.downloadedBytes),
              total: size,
              percent: pct,
            })}
          </Typography>
          {checkpoint.download && (
            <Button size="small" color="inherit" onClick={cancel}>
              {t("common:cancel")}
            </Button>
          )}
        </Stack>
        <LinearProgress
          variant="determinate"
          value={pct}
          aria-label={t("fineTuning:modelStep.download.progressLabel")}
          sx={{ height: 4, borderRadius: 1 }}
        />
        {!checkpoint.download && (
          <Typography
            variant="caption"
            color="text.secondary"
            component="p"
            sx={{ mt: 1 }}
          >
            {t("fineTuning:modelStep.download.ownedByRun")}
          </Typography>
        )}
      </Box>,
    );
  }

  // missing | invalid
  return box(
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "flex-start", sm: "center" }}
      >
        <DownloadIcon
          fontSize="small"
          color={checkpoint.availability === "invalid" ? "error" : "action"}
        />
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {t("fineTuning:modelStep.download.willDownload", { size })}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p">
            {checkpoint.availability === "invalid"
              ? t("fineTuning:modelStep.download.invalid")
              : t("fineTuning:modelStep.download.missing")}
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={download}
        >
          {t("fineTuning:modelStep.download.now")}
        </Button>
      </Stack>
      {onConfirmChange && (
        <FormControlLabel
          sx={{ ml: 0 }}
          control={
            <Checkbox
              size="small"
              checked={Boolean(downloadConfirmed)}
              onChange={(e) => onConfirmChange(e.target.checked)}
            />
          }
          label={
            <Typography variant="body2">
              {t("fineTuning:modelStep.download.confirm", { size })}
            </Typography>
          }
        />
      )}
    </Stack>,
    checkpoint.availability === "invalid" ? "error.main" : "divider",
  );
}

CheckpointFilesState.propTypes = {
  checkpoint: PropTypes.object.isRequired,
  credential: PropTypes.bool,
  downloadConfirmed: PropTypes.bool,
  onConfirmChange: PropTypes.func,
};

// ---------------------------------------------------------------------------
// Method cards
// ---------------------------------------------------------------------------

function MethodSection({
  checkpoint,
  method,
  parameters,
  hardware,
  onSelect,
  dense,
}) {
  const { t } = useTranslation(["fineTuning"]);
  const unsupportedSelected =
    checkpoint && !checkpoint.methods.includes(method);
  return (
    <SectionCard
      dense={dense}
      icon={TuneIcon}
      title={t("fineTuning:modelStep.method.title")}
      subtitle={t("fineTuning:modelStep.method.subtitle")}
    >
      {unsupportedSelected && (
        <Alert
          severity="warning"
          sx={{ mb: 3, py: 0.5 }}
          action={
            checkpoint.methods.includes("lora") ? (
              <Button
                size="small"
                color="inherit"
                onClick={() => onSelect("lora")}
              >
                {t("fineTuning:modelStep.method.useLora")}
              </Button>
            ) : null
          }
        >
          {t("fineTuning:modelStep.method.unsupportedSelected", {
            method: methodLabel(method, t),
            model: checkpoint.name,
          })}
        </Alert>
      )}
      <Box
        role="radiogroup"
        aria-label={t("fineTuning:modelStep.method.title")}
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
        }}
      >
        {METHOD_ORDER.map((m) => {
          const supported = !checkpoint || checkpoint.methods.includes(m);
          const selected = method === m;
          const estimate = checkpoint
            ? estimateDraftVram(checkpoint, m, parameters)
            : null;
          return (
            <SelectableCard
              key={m}
              selected={selected}
              disabled={!supported}
              onSelect={() => onSelect(m)}
              ariaLabel={methodLabel(m, t)}
              sx={
                !supported
                  ? { opacity: 0.75, bgcolor: "action.hover" }
                  : undefined
              }
            >
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 600, flex: 1 }}
                  >
                    {methodLabel(m, t)}
                  </Typography>
                  {m === "qlora" && supported && (
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t("fineTuning:modelStep.method.lowMemory")}
                    />
                  )}
                  {selected && (
                    <CheckIcon
                      fontSize="small"
                      color={supported ? "primary" : "warning"}
                    />
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {t(`fineTuning:catalog.methods.${m}.description`)}
                </Typography>
                {!supported ? (
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <InfoOutlinedIcon
                      fontSize="small"
                      color="warning"
                      sx={{ mt: 0.25 }}
                    />
                    <Typography variant="caption" color="warning.main">
                      {t("fineTuning:catalog.qloraUnsupported")}
                    </Typography>
                  </Stack>
                ) : estimate !== null ? (
                  <Stack direction="row" spacing={2} alignItems="center">
                    <VramEstimate
                      variant="compact"
                      estimatedGb={estimate}
                      hardware={hardware}
                      sx={{ flex: 1 }}
                    />
                    <VramRiskChip
                      estimatedGb={estimate}
                      availableGb={hardware.vramGb}
                    />
                  </Stack>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    {t("fineTuning:modelStep.method.pickModelForEstimate")}
                  </Typography>
                )}
              </Stack>
            </SelectableCard>
          );
        })}
      </Box>
      {method === "qlora" &&
        (!checkpoint || checkpoint.methods.includes("qlora")) && (
          <Stack
            direction="row"
            spacing={1}
            alignItems="flex-start"
            sx={{ mt: 3 }}
          >
            <InfoOutlinedIcon
              fontSize="small"
              sx={{ color: "text.secondary", mt: 0.25 }}
            />
            <Typography variant="caption" color="text.secondary">
              {t("fineTuning:catalog.quantization")}
            </Typography>
          </Stack>
        )}
    </SectionCard>
  );
}

MethodSection.propTypes = {
  checkpoint: PropTypes.object,
  method: PropTypes.string,
  parameters: PropTypes.object,
  hardware: PropTypes.object.isRequired,
  onSelect: PropTypes.func.isRequired,
  dense: PropTypes.bool,
};

// ---------------------------------------------------------------------------
// ModelStep
// ---------------------------------------------------------------------------

/**
 * Model step: trainable catalog (base checkpoint) + method (QLoRA / LoRA),
 * with availability, gated-credential and download state, and orientative
 * VRAM estimates against the detected or simulated hardware.
 *
 * @param {object} props
 * @param {object} props.session store session
 * @param {boolean} [props.methodOnly] show only the selected checkpoint
 *   (summary + files state) and the method section (prototype B dialog);
 *   falls back to the full catalog when no checkpoint is selected
 * @param {object} [props.value] local run config (prototype B); with
 *   `onChange`, edits that object instead of the session draft
 * @param {(next: object) => void} [props.onChange] receives the whole next value
 * @param {boolean} [props.dense] tighter paddings (dialogs)
 */
export default function ModelStep({
  session,
  methodOnly = false,
  value,
  onChange,
  dense = false,
}) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const { draft, patch } = useDraftEditor(session, value, onChange);
  const checkpoints = useFineTuningStore(selectCheckpoints);
  const credential = useFineTuningStore(selectCredential);
  const { profile } = useHardwareProfile();
  const hardware = profile || { vramGb: 8, gpuName: "", source: "simulated" };

  const selected = draft.checkpointId
    ? checkpoints.find((c) => c.id === draft.checkpointId) || null
    : null;
  const showCatalog = !methodOnly || !selected;

  // Never switch the method automatically (R11): only the checkpoint changes.
  const selectCheckpoint = (id) => {
    if (id !== draft.checkpointId) patch({ checkpointId: id });
  };
  const selectMethod = (m) => {
    if (m !== draft.method) patch({ method: m });
  };

  const hardwareChip = (
    <Tooltip
      title={
        hardware.source === "detected"
          ? t("fineTuning:modelStep.hardware.detectedTooltip")
          : t("fineTuning:modelStep.hardware.simulatedTooltip")
      }
    >
      <Chip
        size="small"
        variant="outlined"
        label={t("fineTuning:modelStep.hardware.chip", {
          gpu: hardware.gpuName,
          vram: hardware.vramGb,
          source: t(
            hardware.source === "detected"
              ? "fineTuning:common.vram.detected"
              : "fineTuning:common.vram.simulated",
          ),
        })}
        sx={{ maxWidth: 280 }}
      />
    </Tooltip>
  );

  return (
    <Stack spacing={dense ? 3 : 4}>
      {showCatalog ? (
        <SectionCard
          dense={dense}
          icon={PsychologyOutlinedIcon}
          title={t("fineTuning:modelStep.catalog.title")}
          subtitle={t("fineTuning:modelStep.catalog.subtitle")}
          action={hardwareChip}
        >
          <Box
            role="radiogroup"
            aria-label={t("fineTuning:modelStep.catalog.title")}
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            }}
          >
            {checkpoints.map((ck) => (
              <CheckpointCard
                key={ck.id}
                checkpoint={ck}
                selected={ck.id === draft.checkpointId}
                method={draft.method}
                parameters={draft.parameters}
                hardware={hardware}
                credential={credential}
                onSelect={() => selectCheckpoint(ck.id)}
              />
            ))}
          </Box>
          <Stack
            direction="row"
            spacing={1}
            alignItems="flex-start"
            sx={{ mt: 3 }}
          >
            <InfoOutlinedIcon
              fontSize="small"
              sx={{ color: "text.secondary", mt: 0.25 }}
            />
            <Typography variant="caption" color="text.secondary">
              {t("fineTuning:modelStep.catalog.separateNote")}{" "}
              {t("fineTuning:modelStep.catalog.estimateNote")}
            </Typography>
          </Stack>
          {selected && (
            <CheckpointFilesState
              checkpoint={selected}
              credential={credential}
              downloadConfirmed={draft.downloadConfirmed}
              onConfirmChange={(checked) =>
                patch({ downloadConfirmed: checked })
              }
            />
          )}
          {!selected && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
              {t("fineTuning:modelStep.catalog.nonePicked")}
            </Typography>
          )}
        </SectionCard>
      ) : (
        <SectionCard
          dense={dense}
          icon={PsychologyOutlinedIcon}
          title={t("fineTuning:modelStep.selected.title")}
          subtitle={selected.repository}
          action={hardwareChip}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={3}
            alignItems={{ sm: "center" }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {selected.name}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                component="p"
              >
                {t("fineTuning:modelStep.card.meta", {
                  params: selected.parametersB,
                  size: formatBytes(selected.diskBytes),
                })}
                {" · "}
                <Box component="span" sx={mono}>
                  {t("fineTuning:modelStep.card.revision", {
                    revision: shortRevision(selected.revision),
                  })}
                </Box>
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {METHOD_ORDER.filter((m) => selected.methods.includes(m)).map(
                (m) => (
                  <Chip
                    key={m}
                    size="small"
                    variant="outlined"
                    label={methodLabel(m, t)}
                  />
                ),
              )}
            </Stack>
          </Stack>
          <CheckpointFilesState
            checkpoint={selected}
            credential={credential}
            downloadConfirmed={draft.downloadConfirmed}
            onConfirmChange={(checked) => patch({ downloadConfirmed: checked })}
          />
        </SectionCard>
      )}

      <MethodSection
        checkpoint={selected}
        method={draft.method}
        parameters={draft.parameters}
        hardware={hardware}
        onSelect={selectMethod}
        dense={dense}
      />
    </Stack>
  );
}

ModelStep.propTypes = {
  session: PropTypes.shape({ id: PropTypes.string, draft: PropTypes.object }),
  methodOnly: PropTypes.bool,
  value: PropTypes.object,
  onChange: PropTypes.func,
  dense: PropTypes.bool,
};
