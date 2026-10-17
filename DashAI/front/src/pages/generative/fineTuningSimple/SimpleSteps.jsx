import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Slider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import {
  BASE_MODELS,
  DATASETS,
  LEARNING_RATES,
  LORA_RANKS,
  METHODS,
  TEST_PROMPTS,
  TRAIN_PHASES,
  lossAt,
} from "./simpleData";

const TOTAL_STEPS = 60;
// Loss is logged only while "Entrenando" (steps 8..55).
const LOSS_POINTS = TOTAL_STEPS - 12;

function SectionTitle({ children, hint }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {children}
      </Typography>
      {hint && (
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Box>
  );
}

SectionTitle.propTypes = { children: PropTypes.node, hint: PropTypes.node };

export function ModelStep({ draft, onChange }) {
  return (
    <Stack spacing={6}>
      <Box>
        <SectionTitle hint="Modelos pequeños que corren en un equipo local.">
          Modelos disponibles
        </SectionTitle>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 3,
          }}
        >
          {BASE_MODELS.map((model) => {
            const selected = draft.modelId === model.id;
            return (
              <Card
                key={model.id}
                variant="outlined"
                sx={{
                  borderColor: selected ? "primary.main" : "divider",
                  borderWidth: selected ? 2 : 1,
                }}
              >
                <CardActionArea
                  onClick={() => onChange({ modelId: model.id })}
                  sx={{ p: 4, height: "100%" }}
                >
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {model.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {model.params} parámetros
                  </Typography>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
      </Box>
      <Box>
        <SectionTitle>Método</SectionTitle>
        <ToggleButtonGroup
          exclusive
          value={draft.method}
          onChange={(_, method) => method && onChange({ method })}
          size="small"
        >
          {METHODS.map((method) => (
            <ToggleButton key={method.id} value={method.id} sx={{ px: 6 }}>
              {method.name}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {METHODS.find((m) => m.id === draft.method)?.description}
        </Typography>
      </Box>
    </Stack>
  );
}

ModelStep.propTypes = {
  draft: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};

export function DataStep({ draft, onChange }) {
  const dataset = DATASETS.find((d) => d.id === draft.datasetId);
  const test = dataset ? Math.round(dataset.rows * 0.1) : 0;

  return (
    <Stack spacing={6}>
      <Box>
        <SectionTitle hint="Datasets ya cargados en el módulo de Datos.">
          Dataset
        </SectionTitle>
        <FormControl size="small" sx={{ minWidth: 280 }}>
          <InputLabel>Dataset</InputLabel>
          <Select
            label="Dataset"
            value={draft.datasetId || ""}
            onChange={(event) => {
              const next = DATASETS.find((d) => d.id === event.target.value);
              onChange({ datasetId: next.id, mapping: { ...next.defaults } });
            }}
          >
            {DATASETS.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.name} · {d.rows} filas
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {dataset && (
        <>
          <Box>
            <SectionTitle hint="Qué columna es la entrada y cuál la respuesta esperada.">
              Columnas
            </SectionTitle>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
              {[
                ["instruction", "Instrucción"],
                ["response", "Respuesta"],
              ].map(([key, label]) => (
                <FormControl key={key} size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>{label}</InputLabel>
                  <Select
                    label={label}
                    value={draft.mapping?.[key] || ""}
                    onChange={(event) =>
                      onChange({
                        mapping: {
                          ...draft.mapping,
                          [key]: event.target.value,
                        },
                      })
                    }
                  >
                    {dataset.columns.map((column) => (
                      <MenuItem key={column} value={column}>
                        {column}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ))}
            </Stack>
          </Box>

          <Box>
            <SectionTitle>Vista previa</SectionTitle>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Instrucción</TableCell>
                  <TableCell>Respuesta</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dataset.preview.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {row[draft.mapping?.instruction] ?? "—"}
                    </TableCell>
                    <TableCell>{row[draft.mapping?.response] ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>

          <Alert severity="info" variant="outlined">
            {dataset.rows} ejemplos: {dataset.rows - test} para entrenar y{" "}
            {test} para comparar al final.
          </Alert>
        </>
      )}
    </Stack>
  );
}

DataStep.propTypes = {
  draft: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};

export function ConfigStep({ draft, onChange }) {
  const { config } = draft;
  const setConfig = (patch) => onChange({ config: { ...config, ...patch } });
  const model = BASE_MODELS.find((m) => m.id === draft.modelId);

  return (
    <Stack spacing={6}>
      <Box sx={{ maxWidth: 420 }}>
        <SectionTitle hint="Cuántas veces el modelo recorre el dataset.">
          Épocas: {config.epochs}
        </SectionTitle>
        <Slider
          min={1}
          max={10}
          step={1}
          marks
          value={config.epochs}
          onChange={(_, epochs) => setConfig({ epochs })}
          valueLabelDisplay="auto"
        />
      </Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Tasa de aprendizaje</InputLabel>
          <Select
            label="Tasa de aprendizaje"
            value={config.learningRate}
            onChange={(e) => setConfig({ learningRate: e.target.value })}
          >
            {LEARNING_RATES.map((lr) => (
              <MenuItem key={lr} value={lr}>
                {lr}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Rango LoRA</InputLabel>
          <Select
            label="Rango LoRA"
            value={config.rank}
            onChange={(e) => setConfig({ rank: e.target.value })}
          >
            {LORA_RANKS.map((r) => (
              <MenuItem key={r} value={r}>
                {r}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Accordion variant="outlined" disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2">Opciones avanzadas</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="text.secondary">
            Tamaño de lote, largo máximo de secuencia, alpha y dropout de LoRA,
            optimizador y semilla. Tienen valores por defecto y no es necesario
            tocarlos.
          </Typography>
        </AccordionDetails>
      </Accordion>

      {model && (
        <Alert severity="success" variant="outlined">
          Memoria estimada: {model.vram[draft.method]} GB de VRAM.
        </Alert>
      )}
    </Stack>
  );
}

ConfigStep.propTypes = {
  draft: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};

function LossChart({ points }) {
  const width = 480;
  const height = 140;
  const max = 3.1;
  const min = 0.4;
  const path = points
    .map((loss, i) => {
      const x = (i / (LOSS_POINTS - 1)) * width;
      const y = height - ((loss - min) / (max - min)) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <Box
      component="svg"
      viewBox={`0 0 ${width} ${height}`}
      sx={{
        width: "100%",
        maxWidth: width,
        height: "auto",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
      }}
      role="img"
      aria-label="Curva de pérdida"
    >
      <Box
        component="path"
        d={path}
        fill="none"
        sx={{ stroke: (t) => t.palette.primary.main, strokeWidth: 2 }}
      />
    </Box>
  );
}

LossChart.propTypes = { points: PropTypes.arrayOf(PropTypes.number) };

export function TrainStep({ training, onStart, onCancel }) {
  const { status, step } = training;
  const progress = Math.round((step / TOTAL_STEPS) * 100);
  const phase =
    status === "done"
      ? TRAIN_PHASES.length
      : Math.min(
          TRAIN_PHASES.length - 1,
          step < 4 ? 0 : step < 8 ? 1 : step < TOTAL_STEPS - 4 ? 2 : 3,
        );
  const points = Array.from(
    { length: Math.min(LOSS_POINTS, Math.max(0, step - 8)) },
    (_, i) => lossAt(i),
  );

  if (status === "idle") {
    return (
      <Stack spacing={3} alignItems="flex-start">
        <Typography variant="body2" color="text.secondary">
          Todo listo. El entrenamiento se ejecuta en segundo plano; puedes salir
          de esta pantalla y volver después.
        </Typography>
        <Button variant="contained" onClick={onStart}>
          Iniciar entrenamiento
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={5}>
      <Box>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="body2">
            {status === "done" ? "Completado" : TRAIN_PHASES[phase]}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {progress}%
          </Typography>
        </Stack>
        <LinearProgress variant="determinate" value={progress} />
      </Box>

      <Stack direction="row" spacing={4} flexWrap="wrap" useFlexGap>
        {TRAIN_PHASES.map((label, i) => (
          <Stack key={label} direction="row" spacing={1} alignItems="center">
            {i < phase ? (
              <CheckCircleIcon color="success" fontSize="small" />
            ) : (
              <RadioButtonUncheckedIcon
                fontSize="small"
                color={i === phase ? "primary" : "disabled"}
              />
            )}
            <Typography
              variant="body2"
              color={i <= phase ? "text.primary" : "text.secondary"}
            >
              {label}
            </Typography>
          </Stack>
        ))}
      </Stack>

      <Box>
        <SectionTitle hint="Debería bajar a medida que el modelo aprende.">
          Pérdida (loss)
        </SectionTitle>
        <LossChart points={points} />
      </Box>

      {status === "running" && (
        <Box>
          <Button color="error" variant="outlined" onClick={onCancel}>
            Cancelar
          </Button>
        </Box>
      )}
    </Stack>
  );
}

TrainStep.propTypes = {
  training: PropTypes.object.isRequired,
  onStart: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export function ResultStep({ draft, adapterName }) {
  const [promptIndex, setPromptIndex] = useState(0);
  const model = BASE_MODELS.find((m) => m.id === draft.modelId);
  const sample = TEST_PROMPTS[promptIndex];

  return (
    <Stack spacing={6}>
      <Card variant="outlined" sx={{ p: 4 }}>
        <Stack direction="row" spacing={3} alignItems="center">
          <ExtensionOutlinedIcon color="primary" />
          <Box sx={{ flex: 1 }}>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {adapterName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {model?.name} · {draft.method === "qlora" ? "QLoRA" : "LoRA"} ·
              pérdida final {lossAt(LOSS_POINTS - 1).toFixed(2)}
            </Typography>
          </Box>
          <Chip label="Disponible" color="success" size="small" />
        </Stack>
      </Card>

      <Box>
        <SectionTitle hint="La misma pregunta al modelo base y al adaptado.">
          Probar el adaptador
        </SectionTitle>
        <Stack
          direction="row"
          spacing={2}
          flexWrap="wrap"
          useFlexGap
          sx={{ mb: 3 }}
        >
          {TEST_PROMPTS.map((p, i) => (
            <Chip
              key={p.prompt}
              label={p.prompt}
              clickable
              color={i === promptIndex ? "primary" : "default"}
              variant={i === promptIndex ? "filled" : "outlined"}
              onClick={() => setPromptIndex(i)}
            />
          ))}
        </Stack>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 3,
          }}
        >
          {[
            ["Modelo base", sample.base],
            ["Con adaptador", sample.adapted],
          ].map(([title, text]) => (
            <Card key={title} variant="outlined" sx={{ p: 4 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}
              >
                {title}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {text}
              </Typography>
            </Card>
          ))}
        </Box>
      </Box>
    </Stack>
  );
}

ResultStep.propTypes = {
  draft: PropTypes.object.isRequired,
  adapterName: PropTypes.string.isRequired,
};

/** Drives the fake training: one tick every 150 ms (~9 s total). */
export function useFakeTraining() {
  const [training, setTraining] = useState({ status: "idle", step: 0 });
  const timer = useRef(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(() => stop, []);

  const start = () => {
    stop();
    setTraining({ status: "running", step: 0 });
    timer.current = setInterval(() => {
      setTraining((current) => {
        const step = current.step + 1;
        if (step >= TOTAL_STEPS) {
          stop();
          return { status: "done", step: TOTAL_STEPS };
        }
        return { status: "running", step };
      });
    }, 150);
  };

  const cancel = () => {
    stop();
    setTraining({ status: "idle", step: 0 });
  };

  const reset = cancel;

  return { training, start, cancel, reset };
}
