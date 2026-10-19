import { useEffect, useMemo, useRef, useState } from "react";
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
import SendIcon from "@mui/icons-material/Send";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import ModuleContainer from "../../../components/layout/ModuleContainer";
import LeftPanel from "../../../components/threeSectionLayout/panels/LeftPanel";
import CenterPanel from "../../../components/threeSectionLayout/panels/CenterPanel";
import RightPanel from "../../../components/threeSectionLayout/panels/RightPanel";
import { ThreePanelLayoutContext } from "../../../components/threeSectionLayout/panels/ThreePanelLayoutContext";
import { useThreePanelLayout } from "../../../hooks/useThreePanelsLayout";
import { TEST_PROMPTS } from "../fineTuningSimple/simpleData";
import { FT_D_PATH, SESSIONS_D_PATH, storeD, useStoreD } from "./storeD";

// Mock catalogue of regular generative models (as in "Crear nueva sesión").
const BASE_MODELS = [
  { id: "qwen", name: "Qwen2.5-0.5B-Instruct", info: "0,5 B · texto a texto" },
  { id: "llama", name: "Llama-3.2-1B-Instruct", info: "1,2 B · texto a texto" },
  { id: "phi", name: "Phi-3-mini-4k-Instruct", info: "3,8 B · texto a texto" },
  { id: "tiny", name: "TinyLlama-1.1B-Chat", info: "1,1 B · texto a texto" },
];

function modelLabel(model) {
  return model.kind === "adapter"
    ? `${model.base} + ${model.name}`
    : model.name;
}

function fakeReply(model, prompt) {
  const known = TEST_PROMPTS.find((p) =>
    prompt.toLowerCase().includes(p.prompt.slice(0, 18).toLowerCase()),
  );
  if (model.kind === "adapter") {
    return known
      ? known.adapted
      : "Según los procedimientos de soporte: revisa la sección Ayuda → Solicitudes y abre un ticket con el detalle; te responderemos en menos de 24 horas.";
  }
  return known
    ? known.base
    : "Es una buena pregunta. Depende de varios factores; te recomiendo revisar la documentación oficial o contactar al soporte correspondiente.";
}

function ModelCard({ model, selected, onSelect }) {
  const adapter = model.kind === "adapter";
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
          {adapter ? (
            <ExtensionOutlinedIcon color="primary" fontSize="small" />
          ) : (
            <SmartToyOutlinedIcon color="primary" fontSize="small" />
          )}
          <Typography variant="body1" sx={{ fontWeight: 600 }} noWrap>
            {model.name}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {adapter
            ? `${model.base} · ${model.method}${
                model.dataset ? ` · ${model.dataset}` : ""
              }`
            : model.info}
        </Typography>
      </CardActionArea>
    </Card>
  );
}

ModelCard.propTypes = {
  model: PropTypes.object.isRequired,
  selected: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: 3,
};

function NewSession({ adapters }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const models = useMemo(
    () => [
      ...BASE_MODELS.map((m) => ({ ...m, kind: "base" })),
      ...adapters.map((a) => ({ ...a, kind: "adapter" })),
    ],
    [adapters],
  );
  const [selectedId, setSelectedId] = useState(params.get("adapter"));
  const [step, setStep] = useState(params.get("adapter") ? 1 : 0);
  const [config, setConfig] = useState({
    name: "",
    temperature: 0.7,
    maxTokens: 256,
    system: "Eres un asistente de soporte. Responde en español.",
  });
  const selected = models.find((m) => m.id === selectedId);

  const create = () => {
    const session = storeD.addSession({
      name: config.name || `Sesión ${modelLabel(selected)}`,
      model: selected,
      config,
    });
    navigate(`${SESSIONS_D_PATH}/${session.id}`);
  };

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
                {models
                  .filter((m) => m.kind === "base")
                  .map((m) => (
                    <ModelCard
                      key={m.id}
                      model={m}
                      selected={m.id === selectedId}
                      onSelect={() => setSelectedId(m.id)}
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
                <Button size="small" onClick={() => navigate(FT_D_PATH)}>
                  Entrenar uno nuevo
                </Button>
              </Stack>
              <Box sx={grid}>
                {models
                  .filter((m) => m.kind === "adapter")
                  .map((m) => (
                    <ModelCard
                      key={m.id}
                      model={m}
                      selected={m.id === selectedId}
                      onSelect={() => setSelectedId(m.id)}
                    />
                  ))}
              </Box>
            </Box>
          </Stack>
        ) : (
          <Stack spacing={5} sx={{ maxWidth: 560 }}>
            {selected?.kind === "adapter" && (
              <Alert severity="info" variant="outlined">
                Se cargará {selected.base} con el adaptador «{selected.name}»
                encima.
              </Alert>
            )}
            <TextField
              size="small"
              label="Nombre de la sesión"
              placeholder={`Sesión ${selected ? modelLabel(selected) : ""}`}
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
              label="Máximo de tokens"
              value={config.maxTokens}
              onChange={(e) =>
                setConfig({ ...config, maxTokens: Number(e.target.value) })
              }
            />
            <TextField
              size="small"
              multiline
              minRows={2}
              label="Instrucción de sistema"
              value={config.system}
              onChange={(e) => setConfig({ ...config, system: e.target.value })}
            />
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

NewSession.propTypes = { adapters: PropTypes.array.isRequired };

function ChatSession({ session }) {
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [session.messages.length, thinking]);

  const send = (text) => {
    const prompt = text.trim();
    if (!prompt || thinking) return;
    setInput("");
    storeD.addMessages(session.id, [{ role: "user", text: prompt }]);
    setThinking(true);
    setTimeout(() => {
      storeD.addMessages(session.id, [
        { role: "assistant", text: fakeReply(session.model, prompt) },
      ]);
      setThinking(false);
    }, 700);
  };

  const adapter = session.model.kind === "adapter";

  return (
    <Stack sx={{ height: "100%", p: 4, boxSizing: "border-box" }} spacing={3}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }} noWrap>
          {session.name}
        </Typography>
        <Chip
          size="small"
          icon={adapter ? <ExtensionOutlinedIcon /> : <SmartToyOutlinedIcon />}
          label={modelLabel(session.model)}
          color={adapter ? "primary" : "default"}
          variant="outlined"
        />
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 1 }}>
        {session.messages.length === 0 && (
          <Stack spacing={2} alignItems="flex-start">
            <Typography variant="body2" color="text.secondary">
              Prueba con una de estas preguntas:
            </Typography>
            {TEST_PROMPTS.map((p) => (
              <Chip
                key={p.prompt}
                label={p.prompt}
                clickable
                variant="outlined"
                onClick={() => send(p.prompt)}
              />
            ))}
          </Stack>
        )}
        <Stack spacing={2}>
          {session.messages.map((m, i) => (
            <Box
              key={i}
              sx={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "75%",
                px: 3,
                py: 2,
                borderRadius: 2,
                bgcolor: m.role === "user" ? "primary.main" : "action.hover",
                color:
                  m.role === "user" ? "primary.contrastText" : "text.primary",
              }}
            >
              <Typography variant="body2">{m.text}</Typography>
            </Box>
          ))}
          {thinking && (
            <Typography variant="body2" color="text.secondary">
              Generando…
            </Typography>
          )}
          <div ref={endRef} />
        </Stack>
      </Box>

      <Stack
        direction="row"
        spacing={2}
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="Escribe un mensaje…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit" variant="contained" endIcon={<SendIcon />}>
          Enviar
        </Button>
      </Stack>
    </Stack>
  );
}

ChatSession.propTypes = { session: PropTypes.object.isRequired };

/**
 * Prototype D, inference side: a simulated copy of the Generative
 * "Crear nueva sesión" flow (pick model → configure → chat) where the
 * adapters trained in fine-tuning appear as "Mis modelos adaptados".
 * The real session flow is untouched.
 */
export default function SessionsD() {
  const layout = useThreePanelLayout({ storageKey: "sessionsD" });
  const navigate = useNavigate();
  const location = useLocation();
  const { "*": rest = "" } = useParams();
  const { adapters, sessions } = useStoreD();
  const sessionId = rest && rest !== "new" ? rest : null;
  const session = sessions.find((s) => s.id === sessionId);

  useEffect(() => {
    if (!rest) navigate(`${SESSIONS_D_PATH}/new`, { replace: true });
  }, [rest, navigate]);

  const current = session?.model;

  return (
    <ThreePanelLayoutContext.Provider value={layout}>
      <ModuleContainer>
        <LeftPanel>
          <Stack sx={{ height: "100%", p: 3, overflowY: "auto" }} spacing={3}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate(`${SESSIONS_D_PATH}/new`)}
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
              {sessions.length === 0 && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ px: 2 }}
                >
                  Aún no hay sesiones.
                </Typography>
              )}
              {sessions.map((s) => (
                <ListItemButton
                  key={s.id}
                  selected={s.id === sessionId}
                  onClick={() => navigate(`${SESSIONS_D_PATH}/${s.id}`)}
                  sx={{ borderRadius: 1 }}
                >
                  <ListItemText
                    primary={s.name}
                    secondary={
                      s.model.kind === "adapter"
                        ? "Modelo adaptado"
                        : s.model.name
                    }
                    primaryTypographyProps={{ noWrap: true }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Stack>
        </LeftPanel>
        <CenterPanel>
          {session ? (
            <ChatSession key={session.id} session={session} />
          ) : (
            <NewSession key={location.search} adapters={adapters} />
          )}
        </CenterPanel>
        <RightPanel>
          <Stack sx={{ p: 4 }} spacing={3}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {session ? "Sesión" : "Información"}
            </Typography>
            {session ? (
              <>
                <Typography variant="body2">
                  Modelo: {modelLabel(current)}
                </Typography>
                {current.kind === "adapter" && (
                  <>
                    <Typography variant="body2">
                      Método: {current.method}
                    </Typography>
                    <Typography variant="body2">
                      Dataset: {current.dataset || "—"}
                    </Typography>
                  </>
                )}
                <Typography variant="body2">
                  Temperatura: {session.config.temperature}
                </Typography>
                <Typography variant="body2">
                  Máx. tokens: {session.config.maxTokens}
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Los modelos adaptados se usan igual que cualquier otro modelo:
                se eligen al crear la sesión. Las respuestas son simuladas.
              </Typography>
            )}
            <Chip
              size="small"
              variant="outlined"
              label="Prototipo D"
              sx={{ alignSelf: "flex-start" }}
            />
          </Stack>
        </RightPanel>
      </ModuleContainer>
    </ThreePanelLayoutContext.Provider>
  );
}
