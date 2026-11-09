// Candidate extensions of the instruction fine-tuning design, shown as
// previews by prototype F (prototype B plus these previews). None of them is
// implemented: each one only explains what it would add and how it would fit
// in DashAI. The texts are in Spanish, like the presenter-only switcher.

import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import ThumbsUpDownOutlinedIcon from "@mui/icons-material/ThumbsUpDownOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import ModelTrainingIcon from "@mui/icons-material/ModelTraining";

const SUPERVISED = "Supervisado";
const UNSUPERVISED = "No supervisado";

export const EXTENSION_CHIP = "Extensión · vista previa";

/** Prefix of the option names that open an extension preview. */
export const EXTENSION_OPTION_PREFIX = "extension:";

export const EXTENSIONS = {
  conversations: {
    title: "Ajuste fino con conversaciones",
    badge: SUPERVISED,
    Icon: ForumOutlinedIcon,
    summary:
      "Ajusta el modelo con conversaciones completas de varios turnos, para que aprenda a conversar como un asistente.",
    example: {
      columns: ["conversación"],
      rows: [
        [
          "Usuario: Mi impresora no imprime.\nAsistente: ¿Aparece algún error en la pantalla?\nUsuario: Dice «atasco de papel».\nAsistente: Abre la tapa trasera y retira el papel atascado.",
        ],
      ],
    },
    inDashAI: [
      "Otra tarjeta supervisada, hermana del ajuste fino por instrucciones.",
      "Un solo rol: la columna con la conversación (formatos ShareGPT o ChatML).",
      "La pérdida se calcula sobre todas las respuestas del asistente.",
      "Reutiliza los mismos modelos LoRA/QLoRA y el chat de Generativo.",
    ],
    note: "El prototipo B ya acepta el formato «Mensajes (conversación)» y trae el dataset de ejemplo «Conversaciones de soporte».",
  },
  dpo: {
    title: "Ajuste fino por preferencias (DPO)",
    badge: SUPERVISED,
    Icon: ThumbsUpDownOutlinedIcon,
    summary:
      "Pule un modelo ya ajustado: para cada pregunta hay una respuesta preferida y una rechazada, y el modelo aprende a preferir la buena.",
    example: {
      columns: ["pregunta", "respuesta preferida", "respuesta rechazada"],
      rows: [
        [
          "¿Cómo reinicio el router?",
          "Desenchúfalo 30 segundos y vuelve a enchufarlo. Si sigue fallando, contacta a soporte.",
          "No sé, busca en internet.",
        ],
      ],
    },
    inDashAI: [
      "Tarjeta supervisada con tres roles: pregunta, respuesta preferida y respuesta rechazada.",
      "Suele partir de un adaptador ya entrenado por instrucciones (continuar desde un run).",
      "Se evalúa con el porcentaje de pares en que el modelo prefiere la respuesta buena.",
      "Usa más memoria que el ajuste por instrucciones: procesa dos respuestas por ejemplo.",
    ],
  },
  continuedPretraining: {
    title: "Preentrenamiento continuado",
    badge: UNSUPERVISED,
    Icon: MenuBookOutlinedIcon,
    summary:
      "El modelo lee textos de un dominio (manuales, documentos) para aprender su lenguaje. No hay respuesta: es no supervisado, como Agrupamiento.",
    example: {
      columns: ["texto"],
      rows: [
        [
          "La impresora X-200 usa cartuchos de tinta tipo B. Para cambiarlos, abra la tapa frontal…",
        ],
        ["El router se configura desde la dirección 192.168.0.1…"],
      ],
    },
    inDashAI: [
      "Tarjeta no supervisada, como Agrupamiento: un solo rol de texto y sin columna objetivo.",
      "Los textos largos se cortan en bloques; podrían reutilizarse los lectores de documentos de RAG.",
      "Se evalúa con la perplejidad en una partición de validación.",
      "Para agregar datos puntuales (por ejemplo, un producto nuevo) conviene RAG, que DashAI ya tiene.",
    ],
  },
  exportGguf: {
    title: "Exportar a GGUF",
    Icon: FileDownloadOutlinedIcon,
    summary:
      "Une el adaptador con su modelo base y lo convierte a GGUF, el formato con que DashAI ejecuta hoy sus LLM mediante llama.cpp.",
    steps: [
      "Unir el adaptador LoRA con el modelo base.",
      "Convertir el resultado a GGUF, con cuantización opcional (por ejemplo, Q4_K_M).",
      "Registrarlo como modelo de Generativo, o descargarlo para usarlo en otras herramientas (LM Studio, Ollama).",
    ],
    inDashAI: [
      "Inferencia más liviana que cargar el modelo base más el adaptador.",
      "Permite llevar el modelo ajustado fuera de DashAI.",
    ],
  },
  importModel: {
    title: "Importar modelo local",
    Icon: UploadFileOutlinedIcon,
    summary:
      "Carga un LLM propio (un archivo GGUF o un modelo de Hugging Face descargado) para usarlo en el chat, como en LM Studio.",
    steps: [
      "Elegir un archivo GGUF o la carpeta de un modelo.",
      "DashAI detecta la arquitectura y el tamaño, y estima si cabe en la memoria.",
      "El modelo aparece en el selector de Generativo junto a los del catálogo.",
    ],
    inDashAI: [
      "Hoy Generativo solo ofrece los modelos del catálogo registrado.",
      "Corresponde a la parte de inferencia local del tema original.",
    ],
  },
};

/** The extensions that would be new tasks, shown as cards in Models. */
const TASK_EXTENSIONS = ["conversations", "dpo", "continuedPretraining"];

/**
 * Extension previews show in prototypes F and G and in the development view.
 * F lists each kind of fine-tuning as its own card; G groups them in one.
 */
export function extensionsVisible(activePrototype) {
  return ["F", "G", "all"].includes(activePrototype);
}

/** Prototype G presents the kinds of fine-tuning behind one grouped card. */
export function groupedFineTuning(activePrototype) {
  return activePrototype === "G";
}

/** Search parameter of the second level of cards (prototype G). */
export const FINE_TUNING_KIND_PARAM = "tipo";

/** Prefix of the option names of the second level of cards. */
const KIND_OPTION_PREFIX = "kind:";

/** The kind of fine-tuning an option name chooses, or null. */
export function fineTuningKindFromOptionName(name) {
  return typeof name === "string" && name.startsWith(KIND_OPTION_PREFIX)
    ? name.slice(KIND_OPTION_PREFIX.length)
    : null;
}

/** Option name of the grouped card (prototype G). */
export const GROUPED_FINE_TUNING_OPTION = "grouped-fine-tuning";

/** The grouped card for the Models hub (prototype G). */
export function buildGroupedFineTuningOption() {
  return {
    name: GROUPED_FINE_TUNING_OPTION,
    display_name: "Ajuste fino de LLM",
    description:
      "Adapta un modelo de lenguaje con tus datos: instrucciones, conversaciones, preferencias o textos de un dominio. Primero eliges qué tipo de datos tienes.",
    Icon: ModelTrainingIcon,
    chips: ["Agrupa 4 tipos de ajuste fino"],
    dataTour: undefined,
  };
}

/** The kinds of fine-tuning the grouped card offers, in order. */
export const FINE_TUNING_KINDS = [
  {
    id: "instructions",
    title: "Ajuste fino por instrucciones",
    badge: SUPERVISED,
    Icon: ModelTrainingIcon,
    summary:
      "Pares de instrucción y respuesta: el modelo aprende a responder como en tus ejemplos.",
    columns: "instrucción · contexto (opcional) · respuesta",
    core: true,
  },
  ...TASK_EXTENSIONS.map((id) => ({
    id,
    title: EXTENSIONS[id].title,
    badge: EXTENSIONS[id].badge,
    Icon: EXTENSIONS[id].Icon,
    summary: EXTENSIONS[id].summary,
    columns: EXTENSIONS[id].example.columns.join(" · "),
    core: false,
  })),
];

/** Option name that opens the preview of `id`. */
export function extensionOptionName(id) {
  return `${EXTENSION_OPTION_PREFIX}${id}`;
}

/** The extension id an option name opens, or null for any other option. */
export function extensionFromOptionName(name) {
  return typeof name === "string" && name.startsWith(EXTENSION_OPTION_PREFIX)
    ? name.slice(EXTENSION_OPTION_PREFIX.length)
    : null;
}

/** Cards for the Models hub, after the instruction fine-tuning card. */
export function buildExtensionTaskOptions() {
  return TASK_EXTENSIONS.map((id) => ({
    name: extensionOptionName(id),
    display_name: EXTENSIONS[id].title,
    description: EXTENSIONS[id].summary,
    Icon: EXTENSIONS[id].Icon,
    badge: EXTENSIONS[id].badge,
    chips: [EXTENSION_CHIP],
    dataTour: undefined,
  }));
}

/** Card for the Generative hub: import a local model. */
export function buildImportModelOption() {
  return {
    name: extensionOptionName("importModel"),
    display_name: EXTENSIONS.importModel.title,
    description: EXTENSIONS.importModel.summary,
    Icon: EXTENSIONS.importModel.Icon,
    chips: [EXTENSION_CHIP],
  };
}

/** The second level of cards: one per kind of fine-tuning (prototype G). */
export function buildFineTuningKindOptions() {
  return FINE_TUNING_KINDS.map((kind) => ({
    name: `${KIND_OPTION_PREFIX}${kind.id}`,
    display_name: kind.title,
    description: `${kind.summary} Columnas: ${kind.columns}.`,
    Icon: kind.Icon,
    badge: kind.badge,
    chips: kind.core ? [] : [EXTENSION_CHIP],
  }));
}
