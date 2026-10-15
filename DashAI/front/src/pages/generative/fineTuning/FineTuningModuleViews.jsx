import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import EmptyState from "../../../components/fineTuning/common/EmptyState";
import AdaptersRegistry from "../../../components/fineTuning/adapters/AdaptersRegistry";
import AdapterChat from "../../../components/fineTuning/inference/AdapterChat";
import ComparePanel from "../../../components/fineTuning/inference/ComparePanel";
import {
  useFineTuningRoutes,
  useFineTuningStore,
} from "../../../components/fineTuning/FineTuningContext";
import {
  adapterById,
  chatById,
} from "../../../components/fineTuning/data/selectors";
import { adapterAvailabilityLabel } from "../../../components/fineTuning/data/labels";

const NS = "fineTuning:shellA.views";

const scrollSx = { flex: 1, minHeight: 0, overflowY: "auto", pr: 1, pb: 4 };

/** Adapters registry (`/adapters` and `/adapters/:adapterId`). */
export function AdaptersView({ adapterId = null }) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const navigate = useNavigate();
  const routes = useFineTuningRoutes();
  const exists = useFineTuningStore((s) =>
    adapterId ? Boolean(adapterById(s, adapterId)) : true,
  );

  return (
    <Box sx={scrollSx}>
      {!exists && (
        <Alert
          severity="warning"
          sx={{ mb: 4, py: 0.5 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => navigate(routes.adapters(), { replace: true })}
            >
              {t(`${NS}.clearSelection`)}
            </Button>
          }
        >
          {t(`${NS}.adapterNotFound`)}
        </Alert>
      )}
      <AdaptersRegistry
        selectedId={exists ? adapterId : null}
        onSelect={(id) => navigate(routes.adapter(id))}
      />
    </Box>
  );
}

AdaptersView.propTypes = { adapterId: PropTypes.string };

function selectRecentChats(state) {
  return [...state.chats]
    .sort((a, b) => lastActivity(b) - lastActivity(a))
    .slice(0, 6)
    .map((c) => `${c.id}\u0000${c.name}`);
}

function lastActivity(chat) {
  const last = chat.messages && chat.messages[chat.messages.length - 1];
  return (last && last.createdAt) || chat.createdAt || 0;
}

/** Adapter chat (`/chat` and `/chat/:chatId`). */
export function ChatView({ chatId = null }) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const navigate = useNavigate();
  const routes = useFineTuningRoutes();
  const exists = useFineTuningStore((s) =>
    chatId ? Boolean(chatById(s, chatId)) : true,
  );
  const recent = useFineTuningStore(selectRecentChats);

  if (!exists) {
    return (
      <EmptyState
        icon={SearchOffIcon}
        size="page"
        title={t(`${NS}.chatNotFoundTitle`)}
        description={t(`${NS}.chatNotFoundDescription`)}
        action={
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate(routes.chat(), { replace: true })}
          >
            {t(`${NS}.newChat`)}
          </Button>
        }
        minHeight="50vh"
      />
    );
  }

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
    >
      {recent.length > 0 && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
            mb: 4,
            flexShrink: 0,
          }}
          role="navigation"
          aria-label={t(`${NS}.recentChats`)}
        >
          <Typography variant="caption" color="text.secondary">
            {t(`${NS}.recentChats`)}
          </Typography>
          {recent.map((key) => {
            const [id, name] = key.split("\u0000");
            const selected = id === chatId;
            return (
              <Chip
                key={id}
                size="small"
                label={name}
                clickable
                color={selected ? "primary" : "default"}
                variant={selected ? "filled" : "outlined"}
                onClick={() => navigate(routes.chat(id))}
              />
            );
          })}
          {chatId && (
            <Button
              size="small"
              variant="text"
              onClick={() => navigate(routes.chat())}
            >
              {t(`${NS}.newChat`)}
            </Button>
          )}
        </Box>
      )}
      <Box
        sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        <AdapterChat key={chatId || "new"} chatId={chatId || undefined} />
      </Box>
    </Box>
  );
}

ChatView.propTypes = { chatId: PropTypes.string };

function selectAdapterOptions(state) {
  return [...state.adapters]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .map((a) => `${a.id}\u0000${a.name}\u0000${a.availability}`);
}

/** Base vs adapted comparison (`/compare` and `/compare/:adapterId`). */
export function CompareView({ adapterId = null, comparisonId = null }) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const navigate = useNavigate();
  const routes = useFineTuningRoutes();
  const optionKeys = useFineTuningStore(selectAdapterOptions);
  const options = optionKeys.map((key) => {
    const [id, name, availability] = key.split("\u0000");
    return { id, name, availability };
  });
  const exists = adapterId ? options.some((o) => o.id === adapterId) : false;

  const picker = options.length > 0 && (
    <TextField
      select
      size="small"
      label={t(`${NS}.compareAdapter`)}
      value={exists ? adapterId : ""}
      onChange={(e) => navigate(routes.compare(e.target.value))}
      sx={{ minWidth: 320, mb: 4, alignSelf: "flex-start" }}
    >
      {options.map((o) => (
        <MenuItem key={o.id} value={o.id}>
          {o.availability === "ready"
            ? o.name
            : `${o.name} · ${adapterAvailabilityLabel(o.availability, t)}`}
        </MenuItem>
      ))}
    </TextField>
  );

  if (!adapterId || !exists) {
    return (
      <Box sx={{ ...scrollSx, display: "flex", flexDirection: "column" }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" component="h2">
            {t(`${NS}.compareTitle`)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(`${NS}.compareSubtitle`)}
          </Typography>
        </Box>
        {adapterId && !exists && (
          <Alert severity="warning" sx={{ mb: 4, py: 0.5 }}>
            {t(`${NS}.adapterNotFound`)}
          </Alert>
        )}
        {picker}
        {options.length === 0 && (
          <EmptyState
            icon={CompareArrowsIcon}
            title={t(`${NS}.compareEmptyTitle`)}
            description={t(`${NS}.compareEmptyDescription`)}
            action={
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate(routes.home())}
              >
                {t(`${NS}.goHome`)}
              </Button>
            }
            minHeight="40vh"
          />
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ ...scrollSx, display: "flex", flexDirection: "column" }}>
      {picker}
      <ComparePanel
        key={adapterId}
        adapterId={adapterId}
        comparisonId={comparisonId || undefined}
      />
    </Box>
  );
}

CompareView.propTypes = {
  adapterId: PropTypes.string,
  comparisonId: PropTypes.string,
};
