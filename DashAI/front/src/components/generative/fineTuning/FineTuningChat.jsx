import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Send } from "@mui/icons-material";
import { fineTuningDemoStore as store } from "../../../api/fineTuningDemo/store";
import { Section } from "./DemoCommon";

export function ChatParameters({ chat }) {
  const { t } = useTranslation("fineTuningDemo");
  return (
    <Section title={t("parameters")}>
      {[
        ["temperature", "temperature", 0, 2, 0.1],
        ["maxTokens", "maxTokens", 1, 4096, 1],
        ["topP", "topP", 0.01, 1, 0.05],
      ].map(([key, label, min, max, step]) => (
        <TextField
          key={key}
          type="number"
          fullWidth
          size="small"
          sx={{ mb: 4 }}
          label={t(label)}
          value={chat.parameters[key]}
          slotProps={{ htmlInput: { min, max, step } }}
          onChange={(e) =>
            store.updateChat(chat.id, {
              parameters: { ...chat.parameters, [key]: Number(e.target.value) },
            })
          }
        />
      ))}
    </Section>
  );
}

export default function FineTuningChat({ state, chat }) {
  const adapterLabelId = useId();
  const { t } = useTranslation("fineTuningDemo");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const adapter = state.adaptedModels.find((a) => a.id === chat.adapterId);
  const run = state.runs.find((r) => r.id === adapter?.runId);
  const baseReady =
    state.checkpoints.find((c) => c.id === run?.snapshot.checkpoint.id)
      ?.availability === "ready";
  const pending = chat.messages.some((m) => m.status === "pending");
  const parametersValid =
    Number.isFinite(chat.parameters.temperature) &&
    chat.parameters.temperature >= 0 &&
    chat.parameters.temperature <= 2 &&
    Number.isInteger(chat.parameters.maxTokens) &&
    chat.parameters.maxTokens > 0 &&
    chat.parameters.maxTokens <= 4096 &&
    chat.parameters.topP > 0 &&
    chat.parameters.topP <= 1;
  const blocked =
    adapter?.availability !== "ready" || !baseReady || !parametersValid;
  const send = () => {
    try {
      store.sendMessage(chat.id, input);
      setInput("");
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: 520,
        height: "calc(100dvh - 190px)",
        minWidth: 0,
      }}
    >
      <FormControl fullWidth size="small" sx={{ mt: 5, mb: 4 }}>
        <InputLabel id={adapterLabelId}>{t("adapter")}</InputLabel>
        <Select
          labelId={adapterLabelId}
          label={t("adapter")}
          value={chat.adapterId}
          onChange={(e) =>
            store.updateChat(chat.id, { adapterId: e.target.value })
          }
        >
          {state.adaptedModels.map((a) => (
            <MenuItem
              key={a.id}
              value={a.id}
              disabled={a.availability !== "ready"}
            >
              {a.name} · {t(a.availability)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {(blocked || error) && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t(!parametersValid ? "errors.parameters" : "errors.missing_adapter")}
        </Alert>
      )}
      <Box
        sx={{ flex: 1, overflow: "auto", minHeight: 160, py: 3 }}
        aria-live="polite"
      >
        {!chat.messages.length && (
          <Stack spacing={3} sx={{ pt: 10, alignItems: "flex-start" }}>
            {[
              "¿Cómo restablezco mi contraseña?",
              "¿Cómo solicito una devolución?",
            ].map((text) => (
              <Button
                key={text}
                size="small"
                variant="outlined"
                sx={{ textTransform: "none", textAlign: "left" }}
                onClick={() => setInput(text)}
              >
                {text}
              </Button>
            ))}
          </Stack>
        )}
        {chat.messages.map((message) => (
          <Box key={message.id} sx={{ mb: 6 }}>
            <Box
              sx={{
                ml: "auto",
                maxWidth: "90%",
                width: "fit-content",
                p: 4,
                bgcolor: "action.selected",
                borderRadius: 1,
              }}
            >
              <Typography
                variant="body2"
                sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
              >
                {message.input}
              </Typography>
            </Box>
            <Box
              sx={{ mt: 4, borderLeft: 2, borderColor: "primary.main", pl: 4 }}
            >
              <Typography variant="caption" color="text.secondary">
                {message.snapshot.adapterName} · {t("responseDemo")}
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 2, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
              >
                {message.status === "pending"
                  ? t("generating")
                  : message.status === "error"
                    ? t("errors.missing_adapter")
                    : t(message.outputKey)}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
      <Stack
        direction="row"
        alignItems="flex-end"
        spacing={3}
        sx={{ pt: 4, pb: 4, borderTop: 1, borderColor: "divider" }}
      >
        <TextField
          fullWidth
          multiline
          maxRows={4}
          size="small"
          label={t("prompt")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={blocked}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              input.trim() &&
              !blocked &&
              !pending &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Tooltip title={t("send")}>
          <span>
            <IconButton
              aria-label={t("send")}
              color="primary"
              disabled={!input.trim() || blocked || pending}
              onClick={send}
            >
              <Send />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  );
}
