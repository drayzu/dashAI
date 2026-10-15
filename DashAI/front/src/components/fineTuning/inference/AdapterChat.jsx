import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Divider,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import ReplayIcon from "@mui/icons-material/Replay";
import DownloadIcon from "@mui/icons-material/Download";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { ChatBubble } from "../../generative/ChatBubble";
import {
  useFineTuningActions,
  useFineTuningRoutes,
  useFineTuningStore,
} from "../FineTuningContext";
import { chatById } from "../data/selectors";
import { CHAT_SUGGESTIONS } from "../data/sampleDatasets";
import { failureInfo, generationErrorLabel } from "../data/labels";
import ModelPickerMenu, { modelBlockReason } from "./ModelPickerMenu";
import {
  downloadPercent,
  formatNumber,
  formatTime,
  gpuBlockCause,
  modelRefStatus,
} from "./modelAvailability";
import Hideable from "../viewEditing/Hideable";

const AVATAR_OFFSET = "40px"; // ChatAvatar width + gap, to align captions with bubbles

/** Renders JSON answers (the ficha) as a fenced block so ChatBubble shows code. */
function messageMarkdown(text) {
  const raw = String(text || "").trim();
  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      return `\`\`\`json\n${JSON.stringify(JSON.parse(raw), null, 2)}\n\`\`\``;
    } catch (e) {
      return raw;
    }
  }
  return raw;
}

function sameRef(a, b) {
  return Boolean(a && b && a.kind === b.kind && a.id === b.id);
}

/**
 * Adapter chat (SPEC §4 inference/AdapterChat; R70–R73).
 * Each assistant message shows the frozen snapshot it was generated with
 * (model + temperature), so switching models never alters past or pending
 * messages. A missing/invalid adapter or base is reported explicitly and
 * never replaced by another model.
 *
 * Props:
 * - chatId?: string — chat to show. Without it (or if not found) the
 *   component shows a model picker that opens a new chat and navigates to
 *   `routes.chat(newId)`.
 */
export default function AdapterChat({ chatId }) {
  const { t, i18n } = useTranslation(["fineTuning", "common"]);
  const store = useFineTuningActions();
  const routes = useFineTuningRoutes();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const chat = useFineTuningStore((s) => chatById(s, chatId));
  // Flat primitives so the default shallow equality avoids extra renders.
  const availability = useFineTuningStore((s) => {
    const st = chat ? modelRefStatus(s, chat.modelRef) : null;
    const ck = st && st.checkpoint;
    return {
      hasStatus: Boolean(st),
      usable: Boolean(st && st.usable),
      reason: st ? st.reason : null,
      errorCode: st ? st.errorCode : null,
      hasAdapter: Boolean(st && st.adapter),
      ckId: ck ? ck.id : null,
      ckName: ck ? ck.name : "",
      ckAvailability: ck ? ck.availability : null,
      ckGated: Boolean(ck && ck.gated),
      ckPercent: ck ? downloadPercent(ck) : 0,
      gpuCause: gpuBlockCause(s),
      hfCredential: Boolean(s.demo && s.demo.hfCredential),
    };
  });

  const [text, setText] = useState("");
  const listRef = useRef(null);
  const language = i18n.language;

  const messages = chat ? chat.messages : [];
  const pending = messages.some(
    (m) => m.role === "assistant" && m.status === "pending",
  );
  const status = availability.hasStatus
    ? {
        usable: availability.usable,
        reason: availability.reason,
        errorCode: availability.errorCode,
        adapter: availability.hasAdapter ? {} : null,
        checkpoint: availability.ckId
          ? {
              id: availability.ckId,
              name: availability.ckName,
              availability: availability.ckAvailability,
              gated: availability.ckGated,
              diskBytes: 100,
              downloadedBytes: availability.ckPercent,
            }
          : null,
      }
    : null;
  const usable = availability.usable;

  useEffect(() => {
    const el = listRef.current;
    if (el && typeof el.scrollTo === "function")
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, pending, chatId]);

  // Reset the composer when switching chats.
  useEffect(() => {
    setText("");
  }, [chatId]);

  const send = (value) => {
    const clean = String(value || "").trim();
    if (!clean || !chat || !usable || pending) return;
    try {
      store.sendMessage(chat.id, clean);
      setText("");
    } catch (error) {
      enqueueSnackbar(t("fineTuning:chat.sendFailed"), { variant: "error" });
    }
  };

  const openNewChat = (modelRef) => {
    try {
      const id = store.openChat(modelRef);
      navigate(routes.chat(id));
    } catch (error) {
      enqueueSnackbar(t("fineTuning:chat.openFailed"), { variant: "error" });
    }
  };

  const downloadBase = (checkpointId) => {
    const code = store.downloadCheckpoint(checkpointId);
    if (code === "credential_required") {
      enqueueSnackbar(t("fineTuning:chat.credentialRequired"), {
        variant: "warning",
      });
    } else if (code) {
      enqueueSnackbar(t("fineTuning:chat.downloadFailed"), {
        variant: "error",
      });
    } else {
      enqueueSnackbar(t("fineTuning:chat.downloadStarted"), {
        variant: "info",
      });
    }
  };

  // Marks where the model used by the conversation changed (R72).
  const rows = useMemo(() => {
    const out = [];
    let prevRef = null;
    messages.forEach((m) => {
      if (m.role === "user" && m.snapshot) {
        if (prevRef && !sameRef(prevRef, m.snapshot.modelRef)) {
          out.push({
            type: "modelChange",
            id: `change-${m.id}`,
            name: m.snapshot.modelName,
          });
        }
        prevRef = m.snapshot.modelRef;
      }
      out.push({ type: "message", id: m.id, message: m });
    });
    return out;
  }, [messages]);

  if (!chat) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          p: 6,
          textAlign: "center",
        }}
      >
        <ForumOutlinedIcon sx={{ fontSize: 48, opacity: 0.4 }} />
        <Typography variant="h6" component="h2">
          {chatId
            ? t("fineTuning:chat.notFound")
            : t("fineTuning:chat.noChatTitle")}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ maxWidth: 440 }}
        >
          {t("fineTuning:chat.noChatSubtitle")}
        </Typography>
        <ModelPickerMenu
          value={null}
          onChange={openNewChat}
          placeholder={t("fineTuning:chat.picker.choose")}
        />
      </Box>
    );
  }

  const blockReason =
    status && !status.usable
      ? modelBlockReason(status, t, {
          gatedLocked: Boolean(
            status.checkpoint &&
            status.checkpoint.gated &&
            !availability.hfCredential,
          ),
        })
      : "";
  const blockInfo =
    status && status.errorCode ? failureInfo(status.errorCode, t) : null;
  const canDownloadBase =
    status &&
    status.errorCode === "base_missing" &&
    status.checkpoint &&
    ["missing", "invalid"].includes(status.checkpoint.availability);

  const snapshotCaption = (m) => {
    const snap = m.snapshot || {};
    const params = snap.params || {};
    const parts = [
      t("fineTuning:chat.snapshot", {
        model: snap.modelName || "",
        temperature: formatNumber(Number(params.temperature), language, 2),
      }),
    ];
    if (m.status === "done" && typeof m.latencyMs === "number") {
      parts.push(
        t("fineTuning:chat.latency", {
          seconds: formatNumber(m.latencyMs / 1000, language, 1),
        }),
      );
    }
    return parts.join(" · ");
  };

  const snapshotTooltip = (m) => {
    const params = (m.snapshot && m.snapshot.params) || {};
    return t("fineTuning:chat.snapshotTooltip", {
      temperature: formatNumber(Number(params.temperature), language, 2),
      topP: formatNumber(Number(params.topP), language, 2),
      maxNewTokens: params.maxNewTokens,
    });
  };

  // Every per-message snapshot caption shares one view-editing id.
  const hideableCaption = (node) => (
    <Hideable
      id="shared.chat.snapshotCaptions"
      label={t("fineTuning:viewEditing.sections.chatSnapshotCaptions")}
      level="full"
    >
      {node}
    </Hideable>
  );

  const renderAssistant = (m) => {
    const caption = hideableCaption(
      <Tooltip title={snapshotTooltip(m)} placement="bottom-start">
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: "block",
            ml: AVATAR_OFFSET,
            mt: -3,
            mb: 3,
            px: 2,
            width: "fit-content",
          }}
          data-testid="message-snapshot"
        >
          {snapshotCaption(m)}
        </Typography>
      </Tooltip>,
    );
    if (m.status === "pending") {
      return (
        <>
          <ChatBubble
            isWaiting
            sender={m.snapshot ? m.snapshot.modelName : ""}
          />
          {caption}
        </>
      );
    }
    if (m.status === "error") {
      const info = failureInfo(m.errorCode, t, m.errorParams || {});
      const params = m.errorParams || {};
      const errorStatus = m.snapshot
        ? modelRefStatus(store.getSnapshot(), m.snapshot.modelRef)
        : null;
      const showDownload =
        m.errorCode === "base_missing" &&
        errorStatus &&
        errorStatus.checkpoint &&
        ["missing", "invalid"].includes(errorStatus.checkpoint.availability);
      return (
        <Box sx={{ ml: AVATAR_OFFSET, mb: 4, maxWidth: "80%" }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ ml: 2, mb: 1 }}
          >
            {m.snapshot ? m.snapshot.modelName : ""}
          </Typography>
          <Alert
            severity="error"
            action={
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  alignItems: "flex-end",
                }}
              >
                {showDownload && (
                  <Button
                    color="inherit"
                    size="small"
                    startIcon={<DownloadIcon fontSize="small" />}
                    onClick={() => downloadBase(errorStatus.checkpoint.id)}
                  >
                    {t("fineTuning:chat.downloadBase")}
                  </Button>
                )}
                <Button
                  color="inherit"
                  size="small"
                  startIcon={<ReplayIcon fontSize="small" />}
                  onClick={() => send(m.input)}
                  disabled={!usable || pending}
                >
                  {t("fineTuning:chat.retry")}
                </Button>
              </Box>
            }
          >
            <AlertTitle>{info.title}</AlertTitle>
            {generationErrorLabel(m.errorCode, t, params)}
            {info.actions.length > 0 && (
              <Box component="ul" sx={{ m: 0, mt: 1, pl: 4 }}>
                {info.actions.map((a) => (
                  <Typography key={a} component="li" variant="body2">
                    {a}
                  </Typography>
                ))}
              </Box>
            )}
            <Typography variant="caption" sx={{ display: "block", mt: 1 }}>
              {t("fineTuning:chat.noFallback")}
            </Typography>
          </Alert>
          {hideableCaption(
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 1, px: 2 }}
            >
              {snapshotCaption(m)}
            </Typography>,
          )}
        </Box>
      );
    }
    return (
      <>
        <ChatBubble
          messages={[
            { id: m.id, data_type: "str", data: messageMarkdown(m.text) },
          ]}
          sender={m.snapshot ? m.snapshot.modelName : ""}
          timestamp={formatTime(m.resolvedAt || m.createdAt, language)}
        />
        {caption}
      </>
    );
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* Header: chat name + model picker */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          my: 2,
          px: 1,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" component="h2" noWrap>
            {chat.name}
          </Typography>
          <Hideable
            id="shared.chat.messageCount"
            label={t("fineTuning:viewEditing.sections.chatMessageCount")}
            level="full"
          >
            <Typography variant="caption" color="text.secondary">
              {t("fineTuning:chat.messagesCount", {
                count: messages.filter((m) => m.role === "user").length,
              })}
            </Typography>
          </Hideable>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {t("fineTuning:chat.picker.label")}
          </Typography>
          <ModelPickerMenu
            value={chat.modelRef}
            onChange={(ref) => store.setChatModel(chat.id, ref)}
          />
        </Box>
      </Box>

      <Divider />

      {/* Messages */}
      <Box
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label={t("fineTuning:chat.messagesAria")}
        sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 2, mt: 1 }}
      >
        {messages.length === 0 ? (
          <Box
            sx={{
              minHeight: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              textAlign: "center",
              py: 6,
            }}
          >
            <ForumOutlinedIcon sx={{ fontSize: 48, opacity: 0.4 }} />
            <Typography variant="h6" component="p">
              {t("fineTuning:chat.emptyTitle")}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ maxWidth: 480 }}
            >
              {t("fineTuning:chat.emptySubtitle")}
            </Typography>
            <Hideable
              id="shared.chat.suggestions"
              label={t("fineTuning:viewEditing.sections.chatSuggestions")}
              level="intermediate"
            >
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  alignItems: "center",
                  maxWidth: 560,
                }}
              >
                {CHAT_SUGGESTIONS.map((suggestion) => (
                  <Chip
                    key={suggestion}
                    label={suggestion}
                    variant="outlined"
                    clickable
                    disabled={!usable}
                    onClick={() => send(suggestion)}
                    sx={{
                      height: "auto",
                      py: 1.5,
                      "& .MuiChip-label": {
                        whiteSpace: "normal",
                        textAlign: "left",
                      },
                    }}
                  />
                ))}
              </Box>
            </Hideable>
          </Box>
        ) : (
          rows.map((row) => {
            if (row.type === "modelChange") {
              return (
                <Typography
                  key={row.id}
                  variant="caption"
                  color="text.secondary"
                  component="div"
                  sx={{ textAlign: "center", my: 2 }}
                >
                  {t("fineTuning:chat.modelChanged", { model: row.name })}
                </Typography>
              );
            }
            const m = row.message;
            return (
              <Fragment key={m.id}>
                {m.role === "user" ? (
                  <ChatBubble
                    messages={[{ id: m.id, data_type: "str", data: m.text }]}
                    sender={t("fineTuning:chat.you")}
                    timestamp={formatTime(m.createdAt, language)}
                    isUser
                  />
                ) : (
                  renderAssistant(m)
                )}
              </Fragment>
            );
          })
        )}
      </Box>

      {/* Model / GPU state (explicit diagnosis, no fallback) */}
      {status && !status.usable && blockInfo && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
                alignItems: "flex-end",
              }}
            >
              {canDownloadBase && (
                <Button
                  color="inherit"
                  size="small"
                  startIcon={<DownloadIcon fontSize="small" />}
                  onClick={() => downloadBase(status.checkpoint.id)}
                >
                  {t("fineTuning:chat.downloadBase")}
                </Button>
              )}
              {status.errorCode === "adapter_missing" && (
                <Button
                  color="inherit"
                  size="small"
                  startIcon={<ExtensionOutlinedIcon fontSize="small" />}
                  onClick={() => navigate(routes.adapters())}
                >
                  {t("fineTuning:chat.viewAdapters")}
                </Button>
              )}
            </Box>
          }
        >
          <AlertTitle>{blockInfo.title}</AlertTitle>
          <Typography variant="body2" component="div">
            {blockReason}
          </Typography>
          <Typography variant="body2" component="div" sx={{ mt: 1 }}>
            {t("fineTuning:chat.blockedHint")}
          </Typography>
        </Alert>
      )}
      {usable && availability.gpuCause && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {generationErrorLabel("gpu_busy", t, {
            cause: availability.gpuCause,
          })}
        </Alert>
      )}

      {/* Composer */}
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}
      >
        <TextField
          fullWidth
          multiline
          minRows={2}
          maxRows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            usable
              ? t("fineTuning:chat.placeholder")
              : t("fineTuning:chat.placeholderBlocked")
          }
          disabled={!usable}
          slotProps={{
            htmlInput: { "aria-label": t("fineTuning:chat.inputAria") },
          }}
          onKeyDown={(e) => {
            // IME-safe: never send while a composition is in progress.
            if (e.key !== "Enter" || e.shiftKey) return;
            if (
              e.nativeEvent &&
              (e.nativeEvent.isComposing || e.keyCode === 229)
            )
              return;
            e.preventDefault();
            send(text);
          }}
        />
        <Tooltip
          title={pending ? t("fineTuning:chat.waiting") : t("common:send")}
        >
          <span>
            <Button
              variant="contained"
              color="primary"
              onClick={() => send(text)}
              disabled={!usable || pending || !text.trim()}
              aria-label={t("common:send")}
              sx={{ minWidth: 40, width: 40, height: 40, p: 0 }}
            >
              <SendIcon />
            </Button>
          </span>
        </Tooltip>
      </Box>
      <Hideable
        id="shared.chat.composerHint"
        label={t("fineTuning:viewEditing.sections.chatComposerHint")}
        level="full"
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 1, px: 1 }}
        >
          {t("fineTuning:chat.composerHint")}
        </Typography>
      </Hideable>
    </Box>
  );
}

AdapterChat.propTypes = {
  chatId: PropTypes.string,
};
