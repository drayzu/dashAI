import { useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Button,
  Chip,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import ModuleContainer from "../../../components/layout/ModuleContainer";
import LeftPanel from "../../../components/threeSectionLayout/panels/LeftPanel";
import CenterPanel from "../../../components/threeSectionLayout/panels/CenterPanel";
import RightPanel from "../../../components/threeSectionLayout/panels/RightPanel";
import { ThreePanelLayoutContext } from "../../../components/threeSectionLayout/panels/ThreePanelLayoutContext";
import { useThreePanelLayout } from "../../../hooks/useThreePanelsLayout";
import {
  BASE_MODELS,
  DATASETS,
  DEFAULT_CONFIG,
  EXISTING_ADAPTERS,
  STEPS,
} from "./simpleData";
import {
  ConfigStep,
  DataStep,
  ModelStep,
  ResultStep,
  TrainStep,
  useFakeTraining,
} from "./SimpleSteps";

const EMPTY_DRAFT = {
  modelId: null,
  method: "qlora",
  datasetId: null,
  mapping: {},
  config: DEFAULT_CONFIG,
};

/** Whether the user may leave step `index` with Siguiente. */
function canContinue(index, draft, training) {
  switch (STEPS[index].key) {
    case "model":
      return Boolean(draft.modelId);
    case "data":
      return Boolean(
        draft.datasetId && draft.mapping.instruction && draft.mapping.response,
      );
    case "train":
      return training.status === "done";
    default:
      return true;
  }
}

function PanelTitle({ children }) {
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{
        display: "block",
        px: 2,
        mb: 1,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        fontWeight: 600,
      }}
    >
      {children}
    </Typography>
  );
}

PanelTitle.propTypes = { children: PropTypes.node };

function LeftBar({
  active,
  reached,
  onSelect,
  onNew,
  adapters,
  onAdapterClick,
}) {
  return (
    <Stack sx={{ height: "100%", p: 3, overflowY: "auto" }} spacing={4}>
      <Button variant="contained" startIcon={<AddIcon />} onClick={onNew}>
        Nuevo ajuste
      </Button>

      <Box>
        <PanelTitle>Pasos del flujo</PanelTitle>
        <List dense disablePadding>
          {STEPS.map((step, index) => {
            const done = index < reached;
            return (
              <ListItemButton
                key={step.key}
                selected={index === active}
                disabled={index > reached}
                onClick={() => onSelect(index)}
                sx={{ borderRadius: 1 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {done ? (
                    <CheckCircleIcon color="success" fontSize="small" />
                  ) : (
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        border: 1,
                        borderColor:
                          index === active ? "primary.main" : "divider",
                        color:
                          index === active ? "primary.main" : "text.secondary",
                        fontSize: 12,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {index + 1}
                    </Box>
                  )}
                </ListItemIcon>
                <ListItemText primary={step.label} />
              </ListItemButton>
            );
          })}
        </List>
      </Box>

      <Divider />

      <Box>
        <PanelTitle>Adaptadores</PanelTitle>
        <List dense disablePadding>
          {adapters.map((adapter) => (
            <ListItemButton
              key={adapter.id}
              sx={{ borderRadius: 1 }}
              onClick={() => onAdapterClick?.(adapter)}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                <ExtensionOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={adapter.name}
                secondary={`${adapter.base} · ${adapter.method}`}
                secondaryTypographyProps={{ noWrap: true }}
              />
            </ListItemButton>
          ))}
        </List>
      </Box>
    </Stack>
  );
}

LeftBar.propTypes = {
  active: PropTypes.number.isRequired,
  reached: PropTypes.number.isRequired,
  onSelect: PropTypes.func.isRequired,
  onNew: PropTypes.func.isRequired,
  adapters: PropTypes.array.isRequired,
  onAdapterClick: PropTypes.func,
};

function SummaryRow({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: value ? 500 : 400 }}>
        {value || "—"}
      </Typography>
    </Box>
  );
}

SummaryRow.propTypes = { label: PropTypes.string, value: PropTypes.node };

function Summary({ draft, training }) {
  const model = BASE_MODELS.find((m) => m.id === draft.modelId);
  const dataset = DATASETS.find((d) => d.id === draft.datasetId);
  const statusLabel = {
    idle: "Sin iniciar",
    running: "En curso",
    done: "Completado",
  }[training.status];

  return (
    <Stack sx={{ height: "100%", p: 4, overflowY: "auto" }} spacing={3}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        Resumen
      </Typography>
      <SummaryRow label="Modelo base" value={model?.name} />
      <SummaryRow
        label="Método"
        value={draft.method === "qlora" ? "QLoRA" : "LoRA"}
      />
      <SummaryRow label="Dataset" value={dataset?.name} />
      <SummaryRow
        label="Columnas"
        value={
          dataset &&
          `${draft.mapping.instruction || "?"} → ${
            draft.mapping.response || "?"
          }`
        }
      />
      <SummaryRow
        label="Parámetros"
        value={`${draft.config.epochs} épocas · lr ${draft.config.learningRate} · rango ${draft.config.rank}`}
      />
      <SummaryRow label="Entrenamiento" value={statusLabel} />
      <Divider />
      <Typography variant="caption" color="text.secondary">
        Prototipo de interfaz: los modelos, datos, entrenamiento y respuestas
        son simulados.
      </Typography>
    </Stack>
  );
}

Summary.propTypes = {
  draft: PropTypes.object.isRequired,
  training: PropTypes.object.isRequired,
};

/**
 * Prototype C of the fine-tuning module: a deliberately simple, linear,
 * frontend-only flow (model → data → config → training → result) meant to
 * show layout and steps. State lives in memory; nothing is persisted and the
 * backend is never called. Mounted at `/app/generative/fine-tuning-simple`.
 */
export default function FineTuningSimple({
  chipLabel = "Prototipo C · simple",
  adapters: externalAdapters,
  onAdapterCreated,
  onAdapterClick,
  renderResultExtra,
}) {
  const layout = useThreePanelLayout({ storageKey: "fineTuningSimple" });
  const [active, setActive] = useState(0);
  const [reached, setReached] = useState(0);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [localAdapters, setAdapters] = useState(EXISTING_ADAPTERS);
  const adapters = externalAdapters || localAdapters;
  const { training, start, cancel, reset } = useFakeTraining();

  const step = STEPS[active];
  const model = BASE_MODELS.find((m) => m.id === draft.modelId);
  const adapterName = `${draft.datasetId || "adaptador"}-${
    model?.name.split("-")[0].toLowerCase() || "modelo"
  }-${draft.method}`;

  const update = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const goTo = (index) => {
    setActive(index);
    setReached((current) => Math.max(current, index));
  };

  const next = () => {
    const nextIndex = active + 1;
    if (STEPS[nextIndex]?.key === "result" && onAdapterCreated) {
      onAdapterCreated({
        name: adapterName,
        base: model?.name,
        method: draft.method === "qlora" ? "QLoRA" : "LoRA",
        datasetId: draft.datasetId,
      });
    } else if (STEPS[nextIndex]?.key === "result") {
      setAdapters((current) =>
        current.some((a) => a.name === adapterName)
          ? current
          : [
              {
                id: `adp-${Date.now()}`,
                name: adapterName,
                base: model?.name,
                method: draft.method === "qlora" ? "QLoRA" : "LoRA",
              },
              ...current,
            ],
      );
    }
    goTo(nextIndex);
  };

  const startNew = () => {
    reset();
    setDraft(EMPTY_DRAFT);
    setActive(0);
    setReached(0);
  };

  const content = {
    model: <ModelStep draft={draft} onChange={update} />,
    data: <DataStep draft={draft} onChange={update} />,
    config: <ConfigStep draft={draft} onChange={update} />,
    train: <TrainStep training={training} onStart={start} onCancel={cancel} />,
    result: (
      <ResultStep
        draft={draft}
        adapterName={adapterName}
        extra={renderResultExtra?.(adapterName)}
      />
    ),
  }[step.key];

  return (
    <ThreePanelLayoutContext.Provider value={layout}>
      <ModuleContainer>
        <LeftPanel>
          <LeftBar
            active={active}
            reached={reached}
            onSelect={setActive}
            onNew={startNew}
            adapters={adapters}
            onAdapterClick={onAdapterClick}
          />
        </LeftPanel>
        <CenterPanel>
          <Stack
            sx={{
              height: "100%",
              width: "100%",
              p: 4,
              boxSizing: "border-box",
              minHeight: 0,
            }}
            spacing={4}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
                Fine-tuning
              </Typography>
              <Chip size="small" variant="outlined" label={chipLabel} />
            </Stack>

            <Stepper activeStep={active} alternativeLabel>
              {STEPS.map((s) => (
                <Step key={s.key}>
                  <StepLabel>{s.label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                Paso {active + 1} de {STEPS.length} · {step.description}
              </Typography>
              {content}
            </Box>

            <Divider />
            <Stack direction="row" justifyContent="space-between">
              <Button
                disabled={active === 0}
                onClick={() => setActive(active - 1)}
              >
                Atrás
              </Button>
              {step.key === "result" ? (
                <Button variant="outlined" onClick={startNew}>
                  Nuevo ajuste
                </Button>
              ) : (
                <Button
                  variant="contained"
                  disabled={!canContinue(active, draft, training)}
                  onClick={next}
                >
                  Siguiente
                </Button>
              )}
            </Stack>
          </Stack>
        </CenterPanel>
        <RightPanel>
          <Summary draft={draft} training={training} />
        </RightPanel>
      </ModuleContainer>
    </ThreePanelLayoutContext.Provider>
  );
}

FineTuningSimple.propTypes = {
  chipLabel: PropTypes.string,
  adapters: PropTypes.array,
  onAdapterCreated: PropTypes.func,
  onAdapterClick: PropTypes.func,
  renderResultExtra: PropTypes.func,
};
