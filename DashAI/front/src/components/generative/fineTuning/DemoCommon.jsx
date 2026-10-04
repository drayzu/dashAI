import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add,
  ArrowBack,
  CheckCircleOutline,
  EditOutlined,
  History,
  ModelTrainingOutlined,
} from "@mui/icons-material";
import { DEMO_ROUTE } from "../../../api/fineTuningDemo/config";
import {
  fineTuningDemoStore as store,
  validateDraft,
} from "../../../api/fineTuningDemo/store";
import "./demoStrings";

export function Section({ title, children, action }) {
  return (
    <Box
      component="section"
      sx={{ py: 5, borderBottom: 1, borderColor: "divider", minWidth: 0 }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 4 }}
      >
        <Typography variant="h6" sx={{ letterSpacing: 0 }}>
          {title}
        </Typography>
        {action}
      </Stack>
      {children}
    </Box>
  );
}

export function InfoRow({ label, value }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.3fr)",
        gap: 3,
        py: 2,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ overflowWrap: "anywhere", textAlign: "right", fontWeight: 500 }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export function RunStatus({ run }) {
  const { t } = useTranslation("fineTuningDemo");
  const label = run.terminationReason
    ? t(run.terminationReason)
    : t(`statuses.${run.status}`);
  return (
    <Chip
      size="small"
      label={label}
      color={
        run.status === "FINISHED"
          ? "success"
          : run.status === "ERROR"
            ? run.terminationReason === "cancelled"
              ? "warning"
              : "error"
            : run.status === "STARTED"
              ? "info"
              : "default"
      }
    />
  );
}

export function SessionSidebar({ state, selectedId }) {
  const { t } = useTranslation("fineTuningDemo");
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState(null);
  const [name, setName] = useState("");
  const sessions = state.sessions.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );
  const save = () => {
    if (dialog === "new") {
      const id = store.createSession(name);
      navigate(`${DEMO_ROUTE}/sessions/${id}/configure/model`);
    } else store.renameSession(dialog, name);
    setDialog(null);
  };
  return (
    <Box
      sx={{
        height: "100%",
        overflow: "auto",
        px: 4,
        py: 5,
        bgcolor: "background.box",
      }}
    >
      <Button
        size="small"
        startIcon={<ArrowBack />}
        onClick={() => navigate("/app/generative")}
        sx={{ mb: 5 }}
      >
        {t("generative")}
      </Button>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 4 }}
      >
        <Typography variant="h6">{t("sessions")}</Typography>
        <Tooltip title={t("newSession")}>
          <IconButton
            aria-label={t("newSession")}
            size="small"
            onClick={() => {
              setName("");
              setDialog("new");
            }}
          >
            <Add />
          </IconButton>
        </Tooltip>
      </Stack>
      <TextField
        size="small"
        label={t("search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
        sx={{ mb: 3 }}
      />
      <List disablePadding>
        {sessions.map((s) => (
          <Box
            key={s.id}
            sx={{
              display: "flex",
              alignItems: "center",
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <ListItemButton
              selected={s.id === selectedId}
              onClick={() =>
                navigate(`${DEMO_ROUTE}/sessions/${s.id}/configure/model`)
              }
              sx={{ minWidth: 0, borderRadius: 1, px: 2 }}
            >
              <ModelTrainingOutlined
                sx={{ mr: 2, fontSize: 18, flexShrink: 0 }}
              />
              <ListItemText
                primary={s.name}
                secondary={`${
                  state.runs.filter((r) => r.sessionId === s.id).length
                } ${t("history").toLowerCase()}`}
                slotProps={{
                  primary: { fontSize: 13, overflowWrap: "anywhere" },
                  secondary: { fontSize: 11 },
                }}
              />
            </ListItemButton>
            <Tooltip title={t("rename")}>
              <IconButton
                size="small"
                aria-label={`${t("rename")} ${s.name}`}
                onClick={() => {
                  setName(s.name);
                  setDialog(s.id);
                }}
              >
                <EditOutlined sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        ))}
      </List>
      {!sessions.length && (
        <Typography variant="body2" sx={{ py: 5 }}>
          {t("noSessions")}
        </Typography>
      )}
      <Divider sx={{ my: 5 }} />
      <Button
        startIcon={<CheckCircleOutline />}
        onClick={() => navigate(`${DEMO_ROUTE}/results`)}
      >
        {t("results")}
      </Button>
      {selectedId && (
        <Button
          startIcon={<History />}
          onClick={() =>
            navigate(`${DEMO_ROUTE}/sessions/${selectedId}/history`)
          }
        >
          {t("history")}
        </Button>
      )}
      <Dialog
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {t(dialog === "new" ? "newSession" : "rename")}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label={t("name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mt: 2 }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) save();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>{t("cancel")}</Button>
          <Button variant="contained" disabled={!name.trim()} onClick={save}>
            {t(dialog === "new" ? "create" : "save")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export function RunSummary({ state, session, run, chat }) {
  const { t } = useTranslation("fineTuningDemo");
  const chatAdapter = state.adaptedModels.find((a) => a.id === chat?.adapterId);
  const chatRun = state.runs.find((r) => r.id === chatAdapter?.runId);
  const draft =
    run?.snapshot.draft || chatRun?.snapshot.draft || session?.draft;
  const checkpoint =
    run?.snapshot.checkpoint ||
    chatRun?.snapshot.checkpoint ||
    state.checkpoints.find((c) => c.id === draft?.checkpointId);
  const dataset =
    run?.snapshot.dataset ||
    chatRun?.snapshot.dataset ||
    state.datasets.find((d) => d.id === draft?.datasetId);
  if (!draft)
    return (
      <Box sx={{ p: 5 }}>
        <Typography variant="h6">{t("summary")}</Typography>
        <Typography variant="body2" sx={{ mt: 4 }}>
          {t("selectSession")}
        </Typography>
      </Box>
    );
  const report = validateDraft(draft, {
    ...state,
    datasets: [dataset],
    checkpoints: [checkpoint],
  });
  const duration =
    draft.durationMode === "steps"
      ? `${draft.parameters.steps} ${t("steps")}`
      : `${draft.parameters.epochs} ${t("epochs")}`;
  return (
    <Box sx={{ p: 5, bgcolor: "background.box" }}>
      <Typography variant="h6" sx={{ mb: 5 }}>
        {t("summary")}
      </Typography>
      <Typography variant="h6" sx={{ mb: 2, overflowWrap: "anywhere" }}>
        {checkpoint?.name}
      </Typography>
      <Chip
        label={draft.method.toUpperCase()}
        size="small"
        variant="outlined"
      />
      <Divider sx={{ my: 5 }} />
      <InfoRow label={t("dataset")} value={dataset?.name} />
      <InfoRow label={t("duration")} value={duration} />
      <InfoRow
        label={t("effectiveBatch")}
        value={`${draft.parameters.batch} × ${
          draft.parameters.accumulation
        } = ${draft.parameters.batch * draft.parameters.accumulation}`}
      />
      <InfoRow label={t("maxLength")} value={draft.parameters.maxLength} />
      <InfoRow
        label={t("learningRate")}
        value={draft.parameters.learningRate}
      />
      <Divider sx={{ my: 4 }} />
      <InfoRow
        label={t("trainRows")}
        value={run?.snapshot.splits.train.length ?? report.train}
      />
      <InfoRow
        label={t("evalRows")}
        value={run?.snapshot.splits.evaluation.length ?? report.evaluation}
      />
      <InfoRow
        label={t("lossPolicy")}
        value={t(draft.format === "messages" ? "assistant" : "completion")}
      />
      <Divider sx={{ my: 4 }} />
      <InfoRow label={t("revision")} value={checkpoint?.revision} />
      <InfoRow label={t("fingerprint")} value={dataset?.fingerprint} />
      {run && (
        <>
          <Divider sx={{ my: 4 }} />
          <RunStatus run={run} />
          <InfoRow label={t("queue")} value={run.queueStatus} />
          <InfoRow label={t("phase")} value={t(`phases.${run.phase}`)} />
        </>
      )}
      {chatAdapter && <InfoRow label={t("adapter")} value={chatAdapter.name} />}
      <Alert severity="info" sx={{ mt: 5, fontSize: 12 }}>
        {t("memoryWarning")}
      </Alert>
    </Box>
  );
}
