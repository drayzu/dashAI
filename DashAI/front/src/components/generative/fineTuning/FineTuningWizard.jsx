import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Collapse,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Step,
  StepButton,
  Stepper,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  ArrowBack,
  ArrowForward,
  DownloadOutlined,
  ExpandLess,
  ExpandMore,
  FactCheckOutlined,
  PlayArrow,
  UploadFileOutlined,
} from "@mui/icons-material";
import FormSchemaField from "../../shared/FormSchemaField";
import { DEMO_ROUTE } from "../../../api/fineTuningDemo/config";
import { fineTuningDemoStore as store } from "../../../api/fineTuningDemo/store";
import { Section, InfoRow } from "./DemoCommon";

export const wizardSteps = ["model", "data", "parameters", "review"];

function Selection({ label, value, onChange, options }) {
  const id = useId();
  return (
    <FormControl fullWidth size="small">
      <InputLabel id={id}>{label}</InputLabel>
      <Select
        labelId={id}
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([id, name]) => (
          <MenuItem key={id} value={id}>
            {name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default function FineTuningWizard({ state, session, stepName }) {
  const { t } = useTranslation("fineTuningDemo");
  const navigate = useNavigate();
  const [advanced, setAdvanced] = useState(false);
  const [previewTab, setPreviewTab] = useState(0);
  const [validated, setValidated] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [actionError, setActionError] = useState("");
  const draft = session.draft;
  const checkpoint = state.checkpoints.find((c) => c.id === draft.checkpointId);
  const dataset = state.datasets.find((d) => d.id === draft.datasetId);
  const report = store.validate(session.id);
  const step = Math.max(0, wizardSteps.indexOf(stepName));
  const path = `${DEMO_ROUTE}/sessions/${session.id}/configure`;
  const patch = (value) => {
    store.updateDraft(session.id, value);
    setValidated(false);
    setActionError("");
  };
  const parameters = draft.parameters;
  const setParameter = (key, value) =>
    patch({
      parameters: {
        ...store.getSnapshot().sessions.find((s) => s.id === session.id).draft
          .parameters,
        [key]: value,
      },
    });
  const numberField = (key, type = "integer") => (
    <Box
      key={key}
      onBlurCapture={(event) => {
        // Flush the native debounced input before navigation freezes a run.
        if (event.target.name === key)
          setParameter(
            key,
            event.target.value === "" ? null : Number(event.target.value),
          );
      }}
    >
      <FormSchemaField
        objName={key}
        paramJsonSchema={{ type, title: t(key), description: t(key) }}
        field={{
          value: parameters[key],
          onChange: (value) => setParameter(key, value),
        }}
      />
    </Box>
  );
  const errors = attempted || validated ? report.errors : [];
  const canAdvance =
    step === 0
      ? Boolean(checkpoint && checkpoint.methods.includes(draft.method))
      : step === 1
        ? !report.errors.some((e) =>
            ["invalid_data", "dataset_missing", "split_small"].includes(e),
          )
        : report.ready;
  const next = () => {
    setAttempted(true);
    if (canAdvance) {
      setAttempted(false);
      navigate(`${path}/${wizardSteps[step + 1]}`);
    }
  };
  const start = () => {
    setValidated(true);
    if (!report.ready) return;
    try {
      const id = store.startRun(session.id);
      navigate(`${DEMO_ROUTE}/runs/${id}`);
    } catch (e) {
      setActionError(e.message);
    }
  };
  return (
    <Box>
      <Stepper
        activeStep={step}
        alternativeLabel
        sx={{ py: 5, "& .MuiStepLabel-label": { fontSize: 12 } }}
      >
        {wizardSteps.map((s) => (
          <Step key={s}>
            <StepButton onClick={() => navigate(`${path}/${s}`)}>
              {t(s)}
            </StepButton>
          </Step>
        ))}
      </Stepper>
      {errors.map((e) => (
        <Alert severity="error" key={e} sx={{ mb: 3 }}>
          {t(`errors.${e}`)}
        </Alert>
      ))}
      {actionError && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t(actionError)}
        </Alert>
      )}
      {step === 0 && (
        <>
          <Section title={t("checkpoint")}>
            <Stack spacing={4}>
              <Selection
                label={t("checkpoint")}
                value={draft.checkpointId}
                onChange={(checkpointId) => patch({ checkpointId })}
                options={state.checkpoints.map((c) => [
                  c.id,
                  `${c.name} · ${c.parameters}`,
                ])}
              />
              <InfoRow label={t("repository")} value={checkpoint.repository} />
              <InfoRow label={t("revision")} value={checkpoint.revision} />
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={3}
              >
                <Typography variant="body2">
                  {t(checkpoint.availability)} · {checkpoint.size}
                </Typography>
                {checkpoint.availability !== "ready" && (
                  <Button
                    size="small"
                    startIcon={<DownloadOutlined />}
                    disabled={checkpoint.availability === "downloading"}
                    onClick={() => store.downloadCheckpoint(checkpoint.id)}
                  >
                    {t("download")}
                  </Button>
                )}
              </Stack>
            </Stack>
          </Section>
          <Section title={t("method")}>
            <ToggleButtonGroup
              value={draft.method}
              exclusive
              onChange={(_, method) => method && patch({ method })}
              size="small"
              aria-label={t("method")}
            >
              <ToggleButton value="qlora">QLoRA · 4-bit</ToggleButton>
              <ToggleButton value="lora">LoRA</ToggleButton>
            </ToggleButtonGroup>
          </Section>
        </>
      )}
      {step === 1 && (
        <>
          <Section
            title={t("dataset")}
            action={
              <Button
                size="small"
                startIcon={<UploadFileOutlined />}
                onClick={() =>
                  navigate(
                    `/app/data/datasets/new?fineTuningSession=${session.id}`,
                  )
                }
              >
                {t("importData")}
              </Button>
            }
          >
            <Stack spacing={4}>
              <Selection
                label={t("dataset")}
                value={draft.datasetId}
                onChange={(id) => {
                  store.selectDataset(session.id, id);
                  setValidated(false);
                }}
                options={state.datasets.map((d) => [
                  d.id,
                  `${d.name} · ${d.rows.length} ${t("rows")}`,
                ])}
              />
              <Typography variant="body2" color="text.secondary">
                {dataset?.source}
              </Typography>
              <Selection
                label={t("format")}
                value={draft.format}
                onChange={(format) => patch({ format })}
                options={["alpaca", "pairs", "messages"].map((f) => [f, t(f)])}
              />
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 4,
                }}
              >
                {(draft.format === "messages"
                  ? ["messages"]
                  : draft.format === "alpaca"
                    ? ["instruction", "input", "response"]
                    : ["instruction", "response"]
                ).map((key) => (
                  <Selection
                    key={key}
                    label={t(key === "messages" ? "messagesColumn" : key)}
                    value={draft.mapping[key] || ""}
                    onChange={(value) =>
                      patch({ mapping: { ...draft.mapping, [key]: value } })
                    }
                    options={[
                      ...(key === "input" ? [["", t("none")]] : []),
                      ...dataset.columns.map((c) => [c, c]),
                    ]}
                  />
                ))}
              </Box>
            </Stack>
          </Section>
          <Section title={t("partitions")}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label={t("validation")}
                value={draft.validation}
                onChange={(e) => patch({ validation: Number(e.target.value) })}
                slotProps={{ htmlInput: { step: 0.05, min: 0, max: 0.45 } }}
              />
              <TextField
                fullWidth
                size="small"
                type="number"
                label={t("seed")}
                value={draft.seed}
                onChange={(e) => patch({ seed: Number(e.target.value) })}
              />
            </Stack>
            <InfoRow label={t("trainRows")} value={report.train} />
            <InfoRow label={t("evalRows")} value={report.evaluation} />
          </Section>
          <Section title={t("preview")}>
            <Tabs
              value={previewTab}
              onChange={(_, value) => setPreviewTab(value)}
              sx={{ mb: 3 }}
            >
              <Tab label={t("raw")} />
              <Tab label={t("normalized")} />
            </Tabs>
            {previewTab === 0 ? (
              <TableContainer sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {dataset.columns.map((c) => (
                        <TableCell key={c}>{c}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dataset.rows.slice(0, 3).map((row, i) => (
                      <TableRow key={i}>
                        {dataset.columns.map((c) => (
                          <TableCell
                            key={c}
                            sx={{
                              verticalAlign: "top",
                              minWidth: 160,
                              maxWidth: 320,
                              overflowWrap: "anywhere",
                            }}
                          >
                            {String(row[c]).slice(0, 260)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : report.examples.length ? (
              <>
                <Typography variant="caption" color="text.secondary">
                  {t("pretrainedTemplate")}
                </Typography>
                {report.examples.slice(0, 2).map((ex, i) => (
                  <Box
                    key={i}
                    sx={{ py: 3, borderBottom: 1, borderColor: "divider" }}
                  >
                    {ex.messages.map((m, j) => (
                      <Box key={j} sx={{ mb: 2 }}>
                        <Typography
                          variant="caption"
                          color={
                            m.role === "assistant"
                              ? "success.main"
                              : "text.secondary"
                          }
                        >
                          {m.role}
                          {m.role === "assistant"
                            ? ` · ${t("lossPolicy")}`
                            : ""}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ whiteSpace: "pre-wrap" }}
                        >
                          {m.content}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ))}
              </>
            ) : (
              <Alert severity="error">{t("errors.invalid_data")}</Alert>
            )}
          </Section>
        </>
      )}
      {step === 2 && (
        <>
          <Section title={t("duration")}>
            <ToggleButtonGroup
              value={draft.durationMode}
              exclusive
              size="small"
              onChange={(_, value) => value && patch({ durationMode: value })}
              sx={{ mb: 4 }}
            >
              <ToggleButton value="steps">{t("steps")}</ToggleButton>
              <ToggleButton value="epochs">{t("epochs")}</ToggleButton>
            </ToggleButtonGroup>
            {numberField(draft.durationMode)}
          </Section>
          <Section title={t("parameters")}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 4,
              }}
            >
              {numberField("learningRate", "number")}
              {numberField("maxLength")}
              {numberField("batch")}
              {numberField("accumulation")}
            </Box>
            <InfoRow
              label={t("effectiveBatch")}
              value={`${parameters.batch} × ${parameters.accumulation} = ${
                parameters.batch * parameters.accumulation
              }`}
            />
          </Section>
          <Button
            onClick={() => setAdvanced(!advanced)}
            endIcon={advanced ? <ExpandLess /> : <ExpandMore />}
            sx={{ my: 4 }}
          >
            {t("advanced")}
          </Button>
          <Collapse in={advanced}>
            <Section title="LoRA">
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 4,
                }}
              >
                {numberField("rank")}
                {numberField("alpha")}
                {numberField("dropout", "number")}
                <Selection
                  label={t("targetModules")}
                  value={parameters.targetModules}
                  onChange={(value) =>
                    patch({
                      parameters: { ...parameters, targetModules: value },
                    })
                  }
                  options={[
                    ["all-linear", "all-linear"],
                    ["q_proj,v_proj", "q_proj, v_proj"],
                  ]}
                />
                <Selection
                  label={t("optimizer")}
                  value={parameters.optimizer}
                  onChange={(value) =>
                    patch({ parameters: { ...parameters, optimizer: value } })
                  }
                  options={[["adamw_torch", "AdamW"]]}
                />
                <Selection
                  label={t("scheduler")}
                  value={parameters.scheduler}
                  onChange={(value) =>
                    patch({ parameters: { ...parameters, scheduler: value } })
                  }
                  options={[
                    ["linear", "Linear"],
                    ["cosine", "Cosine"],
                  ]}
                />
              </Box>
            </Section>
          </Collapse>
        </>
      )}
      {step === 3 && (
        <>
          <Section title={t("review")}>
            <InfoRow label={t("checkpoint")} value={checkpoint.name} />
            <InfoRow label={t("dataset")} value={dataset.name} />
            <InfoRow label={t("method")} value={draft.method.toUpperCase()} />
            <InfoRow
              label={t("duration")}
              value={`${parameters[draft.durationMode]} ${t(
                draft.durationMode,
              )}`}
            />
            <InfoRow label={t("fingerprint")} value={dataset.fingerprint} />
            <InfoRow
              label={t("lossPolicy")}
              value={t(
                draft.format === "messages" ? "assistant" : "completion",
              )}
            />
          </Section>
          {checkpoint.availability !== "ready" && (
            <Alert severity="info" sx={{ mt: 4 }}>
              {t("downloadPending")}
            </Alert>
          )}
          <Alert severity="warning" sx={{ my: 4 }}>
            {t("memoryWarning")}
          </Alert>
          {validated && report.ready && (
            <Alert severity="success" sx={{ mb: 4 }}>
              {t("valid")}
            </Alert>
          )}
          <Stack direction="row" flexWrap="wrap" gap={3}>
            <Button
              variant="outlined"
              startIcon={<FactCheckOutlined />}
              onClick={() => setValidated(true)}
            >
              {t("validate")}
            </Button>
            <Button
              variant="contained"
              startIcon={<PlayArrow />}
              onClick={start}
              disabled={
                !report.ready ||
                state.runs.some((r) =>
                  ["DELIVERED", "STARTED"].includes(r.status),
                )
              }
            >
              {t("start")}
            </Button>
          </Stack>
          {state.runs.some((r) =>
            ["DELIVERED", "STARTED"].includes(r.status),
          ) && (
            <Alert severity="info" sx={{ mt: 3 }}>
              {t("jobWaiting")}
            </Alert>
          )}
        </>
      )}
      <Stack direction="row" justifyContent="space-between" sx={{ py: 6 }}>
        <Button
          startIcon={<ArrowBack />}
          disabled={step === 0}
          onClick={() => navigate(`${path}/${wizardSteps[step - 1]}`)}
        >
          {t("back")}
        </Button>
        {step < 3 && (
          <Button variant="contained" endIcon={<ArrowForward />} onClick={next}>
            {t("next")}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
