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
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { ChatBubbleOutline, Replay, Stop } from "@mui/icons-material";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "@mui/material/styles";
import { DEMO_ROUTE } from "../../../api/fineTuningDemo/config";
import { fineTuningDemoStore as store } from "../../../api/fineTuningDemo/store";
import { defaultDraft } from "../../../api/fineTuningDemo/fixtures";
import { InfoRow, RunStatus, Section } from "./DemoCommon";

export function RunsList({ state, sessionId }) {
  const { t } = useTranslation("fineTuningDemo");
  const navigate = useNavigate();
  const runs = state.runs
    .filter((r) => r.sessionId === sessionId)
    .sort((a, b) => b.startedAt - a.startedAt);
  if (!runs.length)
    return (
      <Alert severity="info" sx={{ mt: 5 }}>
        {t("noRuns")}
      </Alert>
    );
  return (
    <TableContainer sx={{ mt: 5 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t("run")}</TableCell>
            <TableCell>{t("status")}</TableCell>
            <TableCell>{t("loss")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {runs.map((run) => (
            <TableRow
              key={run.id}
              hover
              sx={{ cursor: "pointer" }}
              onClick={() => navigate(`${DEMO_ROUTE}/runs/${run.id}`)}
            >
              <TableCell>
                <Button
                  size="small"
                  onClick={() => navigate(`${DEMO_ROUTE}/runs/${run.id}`)}
                  sx={{
                    textTransform: "none",
                    textAlign: "left",
                    justifyContent: "flex-start",
                  }}
                >
                  {run.name}
                </Button>
                <Typography
                  variant="caption"
                  component="div"
                  color="text.secondary"
                >
                  {new Date(run.startedAt).toLocaleString()}
                </Typography>
              </TableCell>
              <TableCell>
                <RunStatus run={run} />
              </TableCell>
              <TableCell>
                {run.metrics.at(-1)?.train.toFixed(3) || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function RunDetail({ state, run }) {
  const { t } = useTranslation("fineTuningDemo");
  const navigate = useNavigate();
  const theme = useTheme();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const adapter = state.adaptedModels.find((a) => a.runId === run.id);
  const isActive = ["DELIVERED", "STARTED"].includes(run.status);
  const openChat = () => {
    const id = store.openChat(adapter.id);
    navigate(`${DEMO_ROUTE}/chats/${id}`);
  };
  const repeat = () => {
    store.updateDraft(run.sessionId, {
      ...run.snapshot.draft,
      parameters: {
        ...defaultDraft().parameters,
        ...run.snapshot.draft.parameters,
      },
      scenario: "success",
    });
    navigate(`${DEMO_ROUTE}/sessions/${run.sessionId}/configure/parameters`);
  };
  return (
    <>
      <Section title={run.name} action={<RunStatus run={run} />}>
        <Stack
          direction="row"
          justifyContent="space-between"
          spacing={3}
          sx={{ mb: 3 }}
        >
          <Typography variant="body2">{t(`phases.${run.phase}`)}</Typography>
          <Typography variant="body2">
            {Math.round(run.progress * 100)}%
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={run.progress * 100}
          sx={{ height: 6, borderRadius: 1 }}
        />
        <InfoRow label={t("steps")} value={run.step} />
        <InfoRow
          label={t("elapsed")}
          value={`${Math.round((run.updatedAt - run.startedAt) / 1000)} s`}
        />
        {run.error && (
          <Alert
            severity={
              run.terminationReason === "cancelled" ? "warning" : "error"
            }
            sx={{ my: 4 }}
          >
            {t(`errors.${run.error}`)}
          </Alert>
        )}
        {adapter?.availability === "missing" && (
          <Alert severity="warning" sx={{ my: 4 }}>
            {t("resultMissing")}
          </Alert>
        )}
        <Stack direction="row" gap={3} flexWrap="wrap" sx={{ mt: 4 }}>
          {isActive ? (
            <Button
              color="warning"
              variant="outlined"
              startIcon={<Stop />}
              onClick={() => setConfirmCancel(true)}
            >
              {t("cancel")}
            </Button>
          ) : (
            <Button startIcon={<Replay />} onClick={repeat}>
              {t("repeat")}
            </Button>
          )}
          {adapter && (
            <Button
              startIcon={<ChatBubbleOutline />}
              variant="contained"
              disabled={
                adapter.availability !== "ready" ||
                state.checkpoints.find(
                  (c) => c.id === run.snapshot.checkpoint.id,
                )?.availability !== "ready"
              }
              onClick={openChat}
            >
              {t("openChat")}
            </Button>
          )}
        </Stack>
      </Section>
      <Section title={`${t("loss")} · ${t("simulated")}`}>
        {run.metrics.length ? (
          <Box sx={{ width: "100%", minWidth: 0, height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={run.metrics}
                margin={{ left: 0, right: 12, top: 8, bottom: 0 }}
              >
                <CartesianGrid
                  stroke={theme.palette.divider}
                  vertical={false}
                />
                <XAxis
                  dataKey="step"
                  tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                />
                <YAxis
                  width={35}
                  domain={[1, 3]}
                  tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    borderColor: theme.palette.divider,
                    borderRadius: 4,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  name={t("trainRows")}
                  dataKey="train"
                  stroke={theme.palette.chart.train}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  name={t("evalRows")}
                  dataKey="evaluation"
                  stroke={theme.palette.chart.validation}
                  strokeWidth={2}
                  dot={false}
                  hide={run.snapshot.splits.evaluation.length === 0}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t("empty")}
          </Typography>
        )}
      </Section>
      <Section title={t("resources")}>
        <Stack direction="row" gap={6} flexWrap="wrap">
          <Box>
            <Typography variant="caption" color="text.secondary">
              VRAM
            </Typography>
            <Typography variant="h6">
              {(2.2 + run.progress * 1.6).toFixed(1)} / 8 GB
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              RAM
            </Typography>
            <Typography variant="h6">
              {(4 + run.progress).toFixed(1)} / 16 GB
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t("availability")}
            </Typography>
            <Typography variant="h6">
              {t(adapter?.availability || "missing")}
            </Typography>
          </Box>
        </Stack>
      </Section>
      <Section title={t("logs")}>
        <Box
          sx={{
            fontFamily: "Geist Mono, monospace",
            fontSize: 12,
            lineHeight: 1.8,
            bgcolor: "background.box",
            p: 4,
            borderRadius: 1,
            overflowWrap: "anywhere",
          }}
        >
          <Box>
            [{run.id}] {t("statuses.DELIVERED")}
          </Box>
          <Box>
            {run.snapshot.checkpoint.name} ·{" "}
            {run.snapshot.draft.method.toUpperCase()}
          </Box>
          <Box>
            {run.snapshot.dataset.fingerprint} ·{" "}
            {run.snapshot.splits.train.length} /{" "}
            {run.snapshot.splits.evaluation.length}
          </Box>
          <Box>
            {t(`phases.${run.phase}`)} · {run.step} {t("steps")}
          </Box>
          <Box>
            {run.error ? t(`errors.${run.error}`) : t(`statuses.${run.status}`)}
          </Box>
        </Box>
      </Section>
      <Section title={t("snapshot")}>
        <Box
          component="pre"
          sx={{
            fontSize: 11,
            m: 0,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {JSON.stringify(
            {
              ...run.snapshot.draft,
              revision: run.snapshot.checkpoint.revision,
              fingerprint: run.snapshot.dataset.fingerprint,
              splits: run.snapshot.splits,
            },
            null,
            2,
          )}
        </Box>
      </Section>
      <Dialog open={confirmCancel} onClose={() => setConfirmCancel(false)}>
        <DialogTitle>{t("cancelConfirm")}</DialogTitle>
        <DialogActions>
          <Button onClick={() => setConfirmCancel(false)}>{t("back")}</Button>
          <Button
            color="warning"
            onClick={() => {
              store.cancelRun(run.id);
              setConfirmCancel(false);
            }}
          >
            {t("cancel")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export function AdaptedModels({ state }) {
  const { t } = useTranslation("fineTuningDemo");
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(null);
  const selected = state.adaptedModels.find((a) => a.id === selectedId);
  const selectedRun = state.runs.find((r) => r.id === selected?.runId);
  const openChat = (id) => {
    const chatId = store.openChat(id);
    navigate(`${DEMO_ROUTE}/chats/${chatId}`);
  };
  return (
    <>
      {!state.adaptedModels.length ? (
        <Alert severity="info" sx={{ mt: 5 }}>
          {t("noResults")}
        </Alert>
      ) : (
        <TableContainer sx={{ mt: 5 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("adapter")}</TableCell>
                <TableCell>{t("availability")}</TableCell>
                <TableCell>{t("chat")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {state.adaptedModels.map((adapter) => {
                const run = state.runs.find((r) => r.id === adapter.runId);
                const baseReady =
                  state.checkpoints.find(
                    (c) => c.id === run.snapshot.checkpoint.id,
                  )?.availability === "ready";
                return (
                  <TableRow key={adapter.id}>
                    <TableCell>
                      <Button
                        size="small"
                        sx={{ textTransform: "none", textAlign: "left" }}
                        onClick={() => setSelectedId(adapter.id)}
                      >
                        {adapter.name}
                      </Button>
                      <Typography
                        variant="caption"
                        component="div"
                        color="text.secondary"
                        sx={{ overflowWrap: "anywhere" }}
                      >
                        {run.snapshot.checkpoint.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={t(adapter.availability)}
                        color={
                          adapter.availability === "ready"
                            ? "success"
                            : "warning"
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        aria-label={`${t("openChat")} ${adapter.name}`}
                        disabled={
                          adapter.availability !== "ready" || !baseReady
                        }
                        onClick={() => openChat(adapter.id)}
                      >
                        <ChatBubbleOutline fontSize="small" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{selected?.name}</DialogTitle>
        <DialogContent>
          {selectedRun && (
            <>
              <InfoRow
                label={t("checkpoint")}
                value={selectedRun.snapshot.checkpoint.name}
              />
              <InfoRow
                label={t("revision")}
                value={selectedRun.snapshot.checkpoint.revision}
              />
              <InfoRow
                label={t("fingerprint")}
                value={selectedRun.snapshot.dataset.fingerprint}
              />
              <InfoRow label={t("run")} value={selectedRun.id} />
              <InfoRow
                label={t("availability")}
                value={t(selected.availability)}
              />
              <Section title={t("artifact")}>
                <Typography
                  variant="body2"
                  sx={{ fontFamily: "Geist Mono, monospace" }}
                >
                  adapter_model.safetensors
                  <br />
                  adapter_config.json
                  <br />
                  manifest.json
                </Typography>
              </Section>
              <Button
                sx={{ mt: 4 }}
                onClick={() =>
                  store.setAdapterAvailability(
                    selected.id,
                    selected.availability === "ready" ? "missing" : "ready",
                  )
                }
              >
                {t(
                  selected.availability === "ready" ? "markMissing" : "restore",
                )}
              </Button>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedId(null)}>{t("close")}</Button>
          <Button
            onClick={() => navigate(`${DEMO_ROUTE}/runs/${selectedRun.id}`)}
          >
            {t("run")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
