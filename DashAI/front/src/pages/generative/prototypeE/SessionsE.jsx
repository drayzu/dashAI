import { useMemo, useState } from "react";
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
import ModuleContainer from "../../../components/layout/ModuleContainer";
import LeftPanel from "../../../components/threeSectionLayout/panels/LeftPanel";
import CenterPanel from "../../../components/threeSectionLayout/panels/CenterPanel";
import RightPanel from "../../../components/threeSectionLayout/panels/RightPanel";
import { ThreePanelLayoutContext } from "../../../components/threeSectionLayout/panels/ThreePanelLayoutContext";
import { useThreePanelLayout } from "../../../hooks/useThreePanelsLayout";
import {
  FineTuningProvider,
  buildRoutesA,
  useFineTuningActions,
  useFineTuningStore,
} from "../../../components/fineTuning/FineTuningContext";
import { getPrototypeStore } from "../../../components/fineTuning/data/instances";
import { chatById } from "../../../components/fineTuning/data/selectors";
import AdapterChat from "../../../components/fineTuning/inference/AdapterChat";
import GenerationParamsPanel from "../../../components/fineTuning/inference/GenerationParamsPanel";

export const FT_E_PATH = "/app/generative/fine-tuning-e";
export const SESSIONS_E_PATH = "/app/generative/sessions-e";

const AVAILABILITY = {
  ready: null,
  missing: "No descargado",
  downloading: "Descargando",
  invalid: "No válido",
};

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
function NewSession() {
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
    navigate(`${SESSIONS_E_PATH}/${chatId}`);
  };

  const visibleAdapters = adapters;

  return (
    <Stack sx={{ height: "100%", p: 4, boxSizing: "border-box" }} spacing={4}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Crear nueva sesión
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Paso {step + 1} de 2 ·{" "}
          {step === 0 ? "Elige un modelo" : "Configura la sesión"}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 1 }}>
        {step === 0 ? (
          <Stack spacing={6}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                Modelos
              </Typography>
              <Box sx={grid}>
                {checkpoints.map((ck) => (
                  <ModelCard
                    key={ck.id}
                    icon={SmartToyOutlinedIcon}
                    title={ck.name}
                    subtitle={`${ck.parametersB} B parámetros · ${
                      ck.license || ""
                    }`}
                    note={AVAILABILITY[ck.availability] ?? null}
                    selected={isSelected("base", ck.id)}
                    onSelect={() => setSelected({ kind: "base", id: ck.id })}
                  />
                ))}
              </Box>
            </Box>
            <Box>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 2 }}
              >
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Mis modelos adaptados
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Modelo base + adaptador LoRA/QLoRA entrenado en Fine-tuning.
                  </Typography>
                </Box>
                <Button size="small" onClick={() => navigate(FT_E_PATH)}>
                  Ir a Fine-tuning
                </Button>
              </Stack>
              {visibleAdapters.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Todavía no hay adaptadores. Entrena uno en Fine-tuning.
                </Typography>
              ) : (
                <Box sx={grid}>
                  {visibleAdapters.map((a) => (
                    <ModelCard
                      key={a.id}
                      icon={ExtensionOutlinedIcon}
                      title={a.name}
                      subtitle={`${ckName(a.checkpointId)} · ${String(
                        a.method || "",
                      ).toUpperCase()}`}
                      note={a.availability === "ready" ? null : "No disponible"}
                      selected={isSelected("adapter", a.id)}
                      onSelect={() =>
                        setSelected({ kind: "adapter", id: a.id })
                      }
                    />
                  ))}
                </Box>
              )}
            </Box>
          </Stack>
        ) : (
          <Stack spacing={5} sx={{ maxWidth: 560 }}>
            <Alert severity="info" variant="outlined">
              {selectedAdapter
                ? `Se cargará ${ckName(
                    selectedAdapter.checkpointId,
                  )} con el adaptador «${selectedAdapter.name}» encima.`
                : `Modelo: ${selectedLabel}.`}
            </Alert>
            <TextField
              size="small"
              label="Nombre de la sesión"
              placeholder={selectedLabel}
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
            />
            <Box>
              <Typography variant="body2">
                Temperatura: {config.temperature}
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
              label="Máximo de tokens nuevos"
              value={config.maxNewTokens}
              onChange={(e) =>
                setConfig({ ...config, maxNewTokens: Number(e.target.value) })
              }
            />
            <Typography variant="caption" color="text.secondary">
              Estos parámetros se pueden cambiar después en el panel derecho.
            </Typography>
          </Stack>
        )}
      </Box>

      <Divider />
      <Stack direction="row" justifyContent="space-between">
        <Button disabled={step === 0} onClick={() => setStep(0)}>
          Atrás
        </Button>
        {step === 0 ? (
          <Button
            variant="contained"
            disabled={!selected}
            onClick={() => setStep(1)}
          >
            Siguiente
          </Button>
        ) : (
          <Button variant="contained" onClick={create}>
            Crear sesión
          </Button>
        )}
      </Stack>
    </Stack>
  );
}

function SessionsList({ chatId }) {
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
        onClick={() => navigate(`${SESSIONS_E_PATH}/new`)}
      >
        Nueva sesión
      </Button>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ px: 2, textTransform: "uppercase", fontWeight: 600 }}
      >
        Sesiones
      </Typography>
      <List dense disablePadding>
        {sorted.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
            Aún no hay sesiones.
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
              onClick={() => navigate(`${SESSIONS_E_PATH}/${c.id}`)}
              sx={{ borderRadius: 1 }}
            >
              <ListItemText
                primary={c.name}
                secondary={
                  adapter ? `Modelo adaptado · ${adapter.name}` : "Modelo base"
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
                Información
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Los modelos adaptados se usan como cualquier otro modelo: se
                eligen al crear la sesión. Las respuestas son simuladas.
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
export default function SessionsE() {
  const store = useMemo(() => getPrototypeStore("E"), []);
  const routes = useMemo(
    () => ({
      ...buildRoutesA(FT_E_PATH),
      externalChat: true,
      chat: (chatId) =>
        chatId ? `${SESSIONS_E_PATH}/${chatId}` : `${SESSIONS_E_PATH}/new`,
      useInSession: (adapterId) =>
        `${SESSIONS_E_PATH}/new?adapter=${adapterId}`,
    }),
    [],
  );
  return (
    <FineTuningProvider store={store} routes={routes} prototype="A">
      <SessionsShell />
    </FineTuningProvider>
  );
}
