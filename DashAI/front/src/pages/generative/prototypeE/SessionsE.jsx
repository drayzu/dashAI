import { createContext, useContext, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Slider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ModuleContainer from "../../../components/layout/ModuleContainer";
import LeftPanel from "../../../components/threeSectionLayout/panels/LeftPanel";
import CenterPanel from "../../../components/threeSectionLayout/panels/CenterPanel";
import RightPanel from "../../../components/threeSectionLayout/panels/RightPanel";
import { ThreePanelLayoutContext } from "../../../components/threeSectionLayout/panels/ThreePanelLayoutContext";
import { useThreePanelLayout } from "../../../hooks/useThreePanelsLayout";
import {
  FineTuningProvider,
  buildRoutesA,
  buildRoutesB,
  useFineTuningActions,
  useFineTuningStore,
} from "../../../components/fineTuning/FineTuningContext";
import { getPrototypeStore } from "../../../components/fineTuning/data/instances";
import { chatById } from "../../../components/fineTuning/data/selectors";
import ComponentSelector from "../../../components/custom/ComponentSelector";
import AdapterChat from "../../../components/fineTuning/inference/AdapterChat";
import GenerationParamsPanel from "../../../components/fineTuning/inference/GenerationParamsPanel";

export const FT_E_PATH = "/app/generative/fine-tuning-e";
export const SESSIONS_E_PATH = "/app/generative/sessions-e";

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
  gap: 3,
};

function ModelCard({ icon: Icon, title, subtitle, note, selected, onSelect }) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: selected ? "primary.main" : "divider",
        borderWidth: selected ? 2 : 1,
      }}
    >
      <CardActionArea onClick={onSelect} sx={{ p: 4, height: "100%" }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Icon color="primary" fontSize="small" />
          <Typography variant="body1" sx={{ fontWeight: 600, flex: 1 }} noWrap>
            {title}
          </Typography>
          {note && <Chip size="small" variant="outlined" label={note} />}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {subtitle}
        </Typography>
      </CardActionArea>
    </Card>
  );
}

ModelCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  note: PropTypes.string,
  selected: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
};

/** "Crear nueva sesión": 1) pick a model (base or adapted) 2) configure. */
const NS = "fineTuning:sessionsE";

// Base path of this unified "Crear nueva sesión" page (prototype E or B).
const SessionsPathContext = createContext(SESSIONS_E_PATH);

function NewSession() {
  const sessionsPath = useContext(SessionsPathContext);
  const { t } = useTranslation(["fineTuning", "generative"]);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const store = useFineTuningActions();
  const checkpoints = useFineTuningStore((s) => s.checkpoints);
  const adapters = useFineTuningStore((s) => s.adapters);

  const initialAdapter = params.get("adapter");
  const [selected, setSelected] = useState(
    initialAdapter ? { kind: "adapter", id: initialAdapter } : null,
  );
  const [step, setStep] = useState(initialAdapter ? 1 : 0);
  const [config, setConfig] = useState({
    name: "",
    temperature: 0.7,
    maxNewTokens: 256,
  });

  const ckName = (id) => checkpoints.find((c) => c.id === id)?.name || id;
  const selectedAdapter =
    selected?.kind === "adapter"
      ? adapters.find((a) => a.id === selected.id)
      : null;
  const selectedLabel = selectedAdapter
    ? `${ckName(selectedAdapter.checkpointId)} + ${selectedAdapter.name}`
    : selected
      ? ckName(selected.id)
      : "";

  const isSelected = (kind, id) =>
    Boolean(selected && selected.kind === kind && selected.id === id);

  const create = () => {
    const chatId = store.openChat(selected, {
      name: config.name.trim() || undefined,
    });
    store.updateChatParams(chatId, {
      temperature: config.temperature,
      maxNewTokens: config.maxNewTokens,
    });
    navigate(`${sessionsPath}/${chatId}`);
  };

  // Same items the real model picker shows, plus the trained adapters as
  // their own group ("Mis modelos adaptados").
  const selectorItems = [
    ...checkpoints.map((ck) => ({
      name: `base:${ck.id}`,
      display_name: ck.name,
      description: t(`${NS}.modelSubtitle`, {
        params: ck.parametersB,
        license: ck.license || "",
      }),
      task_display_name: t(`${NS}.categoryBase`),
    })),
    ...adapters.map((a) => ({
      name: `adapter:${a.id}`,
      display_name: a.name,
      description: t(`${NS}.adapterDescription`, {
        base: ckName(a.checkpointId),
        method: String(a.method || "").toUpperCase(),
      }),
      task_display_name: t(`${NS}.categoryAdapted`),
    })),
  ];

  return (
    <Stack sx={{ height: "100%", p: 4, boxSizing: "border-box" }} spacing={4}>
      <Box>
        <Typography variant="h5" component="h2">
          {step === 0
            ? t("generative:label.selectModel")
            : t(`${NS}.stepConfig`)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {step === 0
            ? t("generative:label.pickAModelGroupedByTask")
            : t(`${NS}.step`, { current: 2, label: t(`${NS}.stepConfig`) })}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 1 }}>
        {step === 0 ? (
          <ComponentSelector
            components={selectorItems}
            selected={
              selected ? { name: `${selected.kind}:${selected.id}` } : null
            }
            onSelect={(component) => {
              const [kind, ...rest] = component.name.split(":");
              setSelected({ kind, id: rest.join(":") });
            }}
            categoryKey="task_display_name"
            searchPlaceholder={t("generative:label.searchModels")}
          />
        ) : (
          <Stack spacing={5} sx={{ maxWidth: 560 }}>
            <Alert severity="info" variant="outlined">
              {selectedAdapter
                ? t(`${NS}.loadsAdapter`, {
                    base: ckName(selectedAdapter.checkpointId),
                    adapter: selectedAdapter.name,
                  })
                : t(`${NS}.loadsModel`, { model: selectedLabel })}
            </Alert>
            <TextField
              size="small"
              label={t(`${NS}.sessionName`)}
              placeholder={selectedLabel}
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
            />
            <Box>
              <Typography variant="body2">
                {t(`${NS}.temperature`, { value: config.temperature })}
              </Typography>
              <Slider
                min={0}
                max={1.5}
                step={0.1}
                value={config.temperature}
                onChange={(_, temperature) =>
                  setConfig({ ...config, temperature })
                }
              />
            </Box>
            <TextField
              size="small"
              type="number"
              label={t(`${NS}.maxNewTokens`)}
              value={config.maxNewTokens}
              onChange={(e) =>
                setConfig({ ...config, maxNewTokens: Number(e.target.value) })
              }
            />
            <Typography variant="caption" color="text.secondary">
              {t(`${NS}.paramsLater`)}
            </Typography>
          </Stack>
        )}
      </Box>

      <Divider />
      <Stack direction="row" justifyContent="space-between">
        <Button disabled={step === 0} onClick={() => setStep(0)}>
          {t(`${NS}.back`)}
        </Button>
        {step === 0 ? (
          <Button
            variant="contained"
            disabled={!selected}
            onClick={() => setStep(1)}
          >
            {t(`${NS}.next`)}
          </Button>
        ) : (
          <Button variant="contained" onClick={create}>
            {t(`${NS}.create`)}
          </Button>
        )}
      </Stack>
    </Stack>
  );
}

function SessionsList({ chatId }) {
  const sessionsPath = useContext(SessionsPathContext);
  const { t } = useTranslation(["fineTuning"]);
  const navigate = useNavigate();
  const chats = useFineTuningStore((s) => s.chats);
  const adapters = useFineTuningStore((s) => s.adapters);
  const sorted = useMemo(
    () => [...chats].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    [chats],
  );

  return (
    <Stack sx={{ height: "100%", p: 3, overflowY: "auto" }} spacing={3}>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => navigate(`${sessionsPath}/new`)}
      >
        {t(`${NS}.newSession`)}
      </Button>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ px: 2, textTransform: "uppercase", fontWeight: 600 }}
      >
        {t(`${NS}.sessions`)}
      </Typography>
      <List dense disablePadding>
        {sorted.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
            {t(`${NS}.noSessions`)}
          </Typography>
        )}
        {sorted.map((c) => {
          const adapter =
            c.modelRef?.kind === "adapter"
              ? adapters.find((a) => a.id === c.modelRef.id)
              : null;
          return (
            <ListItemButton
              key={c.id}
              selected={c.id === chatId}
              onClick={() => navigate(`${sessionsPath}/${c.id}`)}
              sx={{ borderRadius: 1 }}
            >
              <ListItemText
                primary={c.name}
                secondary={
                  adapter
                    ? t(`${NS}.adaptedModel`, { name: adapter.name })
                    : t(`${NS}.baseModel`)
                }
                primaryTypographyProps={{ noWrap: true }}
                secondaryTypographyProps={{ noWrap: true }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Stack>
  );
}

SessionsList.propTypes = { chatId: PropTypes.string };

function SessionsShell() {
  const { t } = useTranslation(["fineTuning"]);
  const layout = useThreePanelLayout({ storageKey: "sessionsE" });
  const { "*": rest = "" } = useParams();
  const [params] = useSearchParams();
  const chatId = rest && rest !== "new" ? rest : null;
  const exists = useFineTuningStore((s) => Boolean(chatById(s, chatId)));

  return (
    <ThreePanelLayoutContext.Provider value={layout}>
      <ModuleContainer>
        <LeftPanel>
          <SessionsList chatId={chatId} />
        </LeftPanel>
        <CenterPanel>
          {chatId && exists ? (
            <Box
              sx={{
                height: "100%",
                p: 4,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
              }}
            >
              <AdapterChat chatId={chatId} />
            </Box>
          ) : (
            <NewSession key={params.toString()} />
          )}
        </CenterPanel>
        <RightPanel>
          {chatId && exists ? (
            <GenerationParamsPanel chatId={chatId} />
          ) : (
            <Stack sx={{ p: 4 }} spacing={2}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t(`${NS}.infoTitle`)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t(`${NS}.infoBody`)}
              </Typography>
            </Stack>
          )}
        </RightPanel>
      </ModuleContainer>
    </ThreePanelLayoutContext.Provider>
  );
}

/**
 * Prototype E, inference side: simulated copy of the Generative "Crear nueva
 * sesión" flow backed by the prototype-E store. Every session is a chat of
 * the full prototype (per-message snapshots, availability checks), so the
 * adapters trained in the full fine-tuning module are used from here only.
 */
export const SESSIONS_B_PATH = "/app/generative/sessions-b";

export default function SessionsE({
  prototype = "E",
  sessionsPath = SESSIONS_E_PATH,
}) {
  const store = useMemo(() => getPrototypeStore(prototype), [prototype]);
  const routes = useMemo(
    () => ({
      // Prototype B trains in Models; E trains in its own Generative module.
      ...(prototype === "B" ? buildRoutesB() : buildRoutesA(FT_E_PATH)),
      externalChat: true,
      chat: (chatId) =>
        chatId ? `${sessionsPath}/${chatId}` : `${sessionsPath}/new`,
      useInSession: (adapterId) => `${sessionsPath}/new?adapter=${adapterId}`,
    }),
    [prototype, sessionsPath],
  );
  return (
    <SessionsPathContext.Provider value={sessionsPath}>
      <FineTuningProvider
        store={store}
        routes={routes}
        prototype={prototype === "B" ? "B" : "A"}
      >
        <SessionsShell />
      </FineTuningProvider>
    </SessionsPathContext.Provider>
  );
}

SessionsE.propTypes = {
  prototype: PropTypes.oneOf(["E", "B"]),
  sessionsPath: PropTypes.string,
};
