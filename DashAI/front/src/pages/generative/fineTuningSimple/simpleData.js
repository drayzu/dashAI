/**
 * Mock data for prototype C (simple). Everything here is invented: the
 * prototype only shows layout and flow, it never calls the backend.
 */

export const STEPS = [
  {
    key: "model",
    label: "Modelo base",
    description: "Elige el modelo y el método de ajuste.",
  },
  {
    key: "data",
    label: "Datos",
    description: "Elige el dataset e indica qué columnas usar.",
  },
  {
    key: "config",
    label: "Configuración",
    description: "Ajusta los parámetros principales.",
  },
  {
    key: "train",
    label: "Entrenamiento",
    description: "Ejecuta el ajuste y sigue su avance.",
  },
  {
    key: "result",
    label: "Resultado",
    description: "Revisa el adaptador y pruébalo.",
  },
];

export const BASE_MODELS = [
  {
    id: "qwen-0.5b",
    name: "Qwen2.5-0.5B-Instruct",
    params: "0,5 B",
    vram: { lora: 3.1, qlora: 1.9 },
  },
  {
    id: "llama-1b",
    name: "Llama-3.2-1B-Instruct",
    params: "1,2 B",
    vram: { lora: 5.4, qlora: 3.2 },
  },
  {
    id: "phi-3-mini",
    name: "Phi-3-mini-4k-Instruct",
    params: "3,8 B",
    vram: { lora: 11.8, qlora: 6.3 },
  },
];

export const METHODS = [
  {
    id: "lora",
    name: "LoRA",
    description: "Entrena matrices pequeñas sobre el modelo en 16 bits.",
  },
  {
    id: "qlora",
    name: "QLoRA",
    description:
      "Igual que LoRA, pero carga el modelo en 4 bits: usa menos memoria.",
  },
];

export const DATASETS = [
  {
    id: "soporte",
    name: "fichas_soporte.csv",
    rows: 120,
    columns: ["pregunta", "respuesta", "categoria"],
    defaults: { instruction: "pregunta", response: "respuesta" },
    preview: [
      {
        pregunta: "No puedo iniciar sesión en el portal.",
        respuesta:
          "Restablece tu contraseña desde «¿Olvidaste tu contraseña?».",
        categoria: "cuenta",
      },
      {
        pregunta: "¿Cómo descargo mi boleta?",
        respuesta: "Ve a Mis pagos → Historial y presiona Descargar PDF.",
        categoria: "pagos",
      },
      {
        pregunta: "La aplicación se cierra al abrirla.",
        respuesta: "Actualiza la aplicación y reinicia el equipo.",
        categoria: "técnico",
      },
    ],
  },
  {
    id: "faq",
    name: "preguntas_frecuentes.json",
    rows: 64,
    columns: ["instruction", "output"],
    defaults: { instruction: "instruction", response: "output" },
    preview: [
      {
        instruction: "¿Cuál es el horario de atención?",
        output: "De lunes a viernes, de 9:00 a 18:00.",
      },
      {
        instruction: "¿Dónde cambio mi dirección?",
        output: "En Perfil → Datos personales.",
      },
    ],
  },
];

export const LEARNING_RATES = ["5e-5", "1e-4", "2e-4", "3e-4"];
export const LORA_RANKS = [4, 8, 16, 32];

export const DEFAULT_CONFIG = {
  epochs: 3,
  learningRate: "2e-4",
  rank: 16,
};

export const TRAIN_PHASES = [
  "Preparando datos",
  "Cargando modelo",
  "Entrenando",
  "Guardando adaptador",
];

export const EXISTING_ADAPTERS = [
  {
    id: "adp-1",
    name: "soporte-v1",
    base: "Qwen2.5-0.5B-Instruct",
    method: "QLoRA",
  },
  {
    id: "adp-2",
    name: "faq-prueba",
    base: "Llama-3.2-1B-Instruct",
    method: "LoRA",
  },
];

export const TEST_PROMPTS = [
  {
    prompt: "No me llega el correo para recuperar la contraseña.",
    base: "Hay muchas razones por las que un correo podría no llegar. Podrías revisar tu conexión a internet o contactar a tu proveedor de correo electrónico.",
    adapted:
      "Revisa la carpeta de spam. Si no está ahí, solicita un nuevo enlace desde «¿Olvidaste tu contraseña?»; el enlace dura 30 minutos.",
  },
  {
    prompt: "¿Cómo descargo la boleta de marzo?",
    base: "Para descargar una boleta normalmente debes ingresar al sitio de la empresa y buscar la sección correspondiente.",
    adapted:
      "Ve a Mis pagos → Historial, filtra por marzo y presiona Descargar PDF.",
  },
];

/** Fake loss curve: decays with a bit of noise. */
export function lossAt(step) {
  return 2.4 * Math.exp(-step / 18) + 0.55 + 0.06 * Math.sin(step * 1.7);
}
