// Simulated generations for the chat and the base-vs-adapted comparison
// (SPEC §3.6). Deterministic: the same inputs always produce the same text.
// These strings are fixtures, not outputs of a real model; the UI labels them
// as simulated.

import {
  FICHA_CATEGORIES,
  HELD_OUT_CASES,
  SAMPLE_DATASETS,
  fichaJson,
} from "./sampleDatasets";
import { fnv1a64 } from "./sft";

function hash32(text) {
  return parseInt(fnv1a64(text).slice(8), 16) >>> 0;
}

function pick(list, key) {
  return list[hash32(key) % list.length];
}

function normalizeInput(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ");
}

const FICHAS_DATASET = SAMPLE_DATASETS.find((d) => d.id === "fichas-soporte");
const TRAINING_FICHAS = new Map(
  (FICHAS_DATASET ? FICHAS_DATASET.rows : []).map((r) => [
    normalizeInput(r.input),
    r.output,
  ]),
);
const HELD_OUT_BY_INPUT = new Map(
  HELD_OUT_CASES.map((c) => [normalizeInput(c.input), c]),
);

const KEYWORDS = {
  datos: [
    "dataset",
    "datos",
    "columna",
    "fila",
    "csv",
    "jsonl",
    "json",
    "excel",
    "importar",
    "importé",
    "mapeo",
    "huella",
    "partición",
    "particion",
    "formato",
    "messages",
    "archivo",
    "vista previa",
    "previsualizar",
    "duplicad",
    "codificación",
    "rol",
  ],
  entrenamiento: [
    "entrenamiento",
    "entrenar",
    "entrené",
    "pérdida",
    "perdida",
    "loss",
    "paso",
    "época",
    "epoca",
    "cuda",
    "out of memory",
    "memoria de la gpu",
    "memoria de gpu",
    "oom",
    "vram",
    "lora",
    "qlora",
    "ejecución",
    "ejecucion",
    "gradiente",
    "nan",
    "tasa de aprendizaje",
    "checkpoint",
    "descarga del modelo",
    "cola",
    "cancel",
  ],
  inferencia: [
    "chat",
    "adaptador",
    "generar",
    "generación",
    "generacion",
    "responde",
    "respuesta del",
    "respuestas del",
    "temperatura",
    "tokens",
    "selector",
    "inferencia",
    "modelo adaptado",
    "top_p",
    "latencia",
  ],
};

/**
 * Keyword-based category guess for a free-text support request.
 * @returns {{category: string|null, score: number}}
 */
export function classifyTicket(input) {
  const text = normalizeInput(input).toLowerCase();
  let best = null;
  let bestScore = 0;
  FICHA_CATEGORIES.forEach((cat) => {
    const score = KEYWORDS[cat].reduce(
      (s, kw) => (text.includes(kw) ? s + 1 : s),
      0,
    );
    if (score > bestScore) {
      best = cat;
      bestScore = score;
    }
  });
  return { category: best, score: bestScore };
}

function firstSentence(text) {
  const clean = normalizeInput(text).replace(
    /^(hola|buenas|buenos días|buenas tardes)[,!.]?\s*/i,
    "",
  );
  const match = clean.match(/^(.+?[.!?])(\s|$)/);
  let sentence = match ? match[1] : clean;
  if (sentence.length > 140) sentence = `${sentence.slice(0, 137).trim()}…`;
  if (!/[.!?…]$/.test(sentence)) sentence = `${sentence}.`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

const NEXT_STEPS = {
  datos: [
    "Revisar las filas indicadas en el reporte de validación y corregirlas antes de entrenar.",
    "Confirmar el formato y el mapeo de columnas y revisar la vista previa de ejemplos SFT.",
    "Volver a importar el dataset tras corregir el archivo y comprobar la huella de datos.",
    "Identificar las filas afectadas y decidir explícitamente si se completan o se retiran.",
  ],
  entrenamiento: [
    "Revisar el registro de la ejecución y la fase en que se detuvo antes de crear una nueva ejecución.",
    "Ajustar batch, longitud máxima o método según la estimación de VRAM y repetir una ejecución controlada.",
    "Comparar la configuración fijada con la de ejecuciones anteriores para aislar el cambio relevante.",
    "Revisar las curvas de pérdida y los valores registrados antes de confiar en el resultado.",
  ],
  inferencia: [
    "Comprobar la disponibilidad del adaptador y de su modelo base antes de volver a generar.",
    "Revisar el modelo y los parámetros registrados en la respuesta y repetir la prueba con valores fijos.",
    "Comparar la respuesta con el modelo base usando las mismas instrucciones y parámetros.",
    "Revisar la cola de trabajos para confirmar que la GPU está libre antes de generar.",
  ],
};

const CATEGORY_LABEL = {
  datos: "Datos",
  entrenamiento: "Entrenamiento",
  inferencia: "Inferencia",
};

// Held-out behaviour of the adapted model (trained on fichas-soporte):
// valid ficha with the right category in 11/12 cases; ho-07 is misclassified
// (the GPU mention pulls it towards "inferencia").
const ADAPTED_HELD_OUT = {
  "ho-07": {
    categoria: "inferencia",
    resumen: "La GPU sigue mostrando memoria ocupada después de cancelar.",
    siguiente_paso: "Revisar el monitor de hardware antes de volver a generar.",
  },
  "ho-03": {
    categoria: "datos",
    resumen:
      "DashAI no reconoce las columnas consulta y solucion como un formato válido.",
    siguiente_paso:
      "Asignar manualmente las columnas en el mapeo y confirmar el formato antes de entrenar.",
  },
  "ho-10": {
    categoria: "inferencia",
    resumen: "El adaptador responde con una lista en lugar de una ficha JSON.",
    siguiente_paso:
      "Revisar los parámetros de generación y comparar la salida con los casos reservados.",
  },
};

// Base model: only ho-02, ho-06 and ho-11 come back as plain JSON (ho-11 with
// an out-of-vocabulary category). The rest is verbose prose.
const BASE_JSON_HELD_OUT = {
  "ho-02": {
    categoria: "datos",
    resumen:
      "Al importar un archivo JSONL, todas las líneas quedan en una sola columna de texto.",
    siguiente_paso:
      "Verificar que el archivo tenga un objeto JSON por línea con claves consistentes.",
  },
  "ho-06": {
    categoria: "entrenamiento",
    resumen: "El gráfico de la ejecución no muestra la pérdida de evaluación.",
    siguiente_paso: "Revisar la configuración de evaluación de la ejecución.",
  },
  "ho-11": {
    categoria: "chat",
    resumen: "El usuario cree que el chat usa el modelo base.",
    siguiente_paso: "Reiniciar el chat.",
  },
};

// Category the base model mentions in its prose (null = none).
const BASE_PROSE_CATEGORY = {
  "ho-01": "datos",
  "ho-03": null,
  "ho-04": null,
  "ho-05": "entrenamiento",
  "ho-07": "inferencia",
  "ho-08": null,
  "ho-09": "inferencia",
  "ho-10": null,
  "ho-12": "entrenamiento",
};

const BASE_OPENINGS = [
  "¡Claro! Entiendo el problema que describes.",
  "Gracias por los detalles. Vamos a revisarlo paso a paso.",
  "Es una situación bastante común; aquí tienes algunas ideas.",
  "Buena pregunta. Te explico qué podría estar pasando.",
];

const BASE_CLOSINGS = [
  "Si el problema continúa, puedes compartir el registro completo para revisarlo con más detalle. ¿Te ayudo con algo más?",
  "Espero que esto te sirva. Si necesitas más ayuda, no dudes en preguntar.",
  "Avísame si alguno de estos pasos no funciona y buscamos otra alternativa.",
];

const TEMPERATURE_ASIDES = [
  "También podría valer la pena reiniciar la aplicación, aunque no siempre es necesario.",
  "En algunos casos el origen es una configuración heredada de una sesión anterior.",
  "Otra posibilidad, menos probable, es un problema de permisos en la carpeta de trabajo.",
];

function tempBucket(params) {
  const t = Number(params && params.temperature);
  if (!Number.isFinite(t)) return 1;
  if (t <= 0.3) return 0;
  if (t <= 1.0) return 1;
  if (t <= 1.4) return 2;
  return 3;
}

function baseTicketProse(input, category, key, params) {
  const bucket = tempBucket(params);
  const opening = pick(BASE_OPENINGS, `${key}|open|${bucket}`);
  // Advice follows the topic of the request even when no category is named.
  const topic = category || classifyTicket(input).category || "entrenamiento";
  const steps = NEXT_STEPS[topic];
  const s1 = pick(steps, `${key}|s1`);
  const s2 = pick(
    steps.filter((s) => s !== s1),
    `${key}|s2`,
  );
  const lines = [
    opening,
    "",
    `Por lo que comentas («${normalizeInput(input).slice(
      0,
      90,
    )}»), lo más probable es que se trate de un detalle de configuración. Te sugiero:`,
    "",
    `1. ${s1}`,
    `2. ${s2}`,
    "3. Verificar que estás usando una versión actualizada de DashAI.",
    "",
  ];
  if (bucket >= 2)
    lines.push(pick(TEMPERATURE_ASIDES, `${key}|aside|${bucket}`), "");
  if (category)
    lines.push(`Categoría sugerida: ${CATEGORY_LABEL[category]}.`, "");
  lines.push(pick(BASE_CLOSINGS, `${key}|close`));
  return lines.join("\n");
}

function genericBaseAnswer(input, key, params) {
  const text = normalizeInput(input).toLowerCase();
  const bucket = tempBucket(params);
  if (/^(hola|buenas|buenos|hey|saludos)/.test(text)) {
    return "¡Hola! ¿En qué puedo ayudarte hoy? Puedo responder preguntas, redactar textos breves o ayudarte a revisar un problema paso a paso.";
  }
  if (text.includes("qué puedes") || text.includes("que puedes")) {
    return "Puedo ayudarte a redactar, resumir, traducir y explicar conceptos, o a revisar un problema técnico si me das detalles. ¿Qué necesitas?";
  }
  if (text.startsWith("traduce")) {
    return "Aquí tienes una traducción aproximada. Si me indicas el contexto (formal o informal), puedo ajustarla.";
  }
  const opening = pick(BASE_OPENINGS, `${key}|gopen|${bucket}`);
  return [
    opening,
    "",
    `Sobre «${normalizeInput(input).slice(
      0,
      80,
    )}»: depende un poco del contexto, pero en general conviene empezar por definir el objetivo, revisar la información disponible y avanzar con pasos pequeños y verificables.`,
    "",
    pick(BASE_CLOSINGS, `${key}|gclose`),
  ].join("\n");
}

function adaptedFicha(input, key, params) {
  const { category } = classifyTicket(input);
  const bucket = tempBucket(params);
  const cat = category || "inferencia";
  const resumen = category
    ? `${firstSentence(input).replace(/[.!?…]$/, "")}.`
    : "El mensaje no describe una incidencia de soporte concreta.";
  const siguiente = category
    ? pick(NEXT_STEPS[cat], `${key}|next|${bucket >= 2 ? bucket : 0}`)
    : "Pedir al usuario que describa la incidencia y la etapa en que ocurre.";
  return { categoria: cat, resumen, siguiente_paso: siguiente };
}

function serializeFicha(ficha, key, params) {
  // High temperature sometimes adds an undefined field (format error).
  if (tempBucket(params) === 3 && hash32(`${key}|extra`) % 3 === 0) {
    return JSON.stringify({ ...ficha, prioridad: "media" });
  }
  return fichaJson(ficha.categoria, ficha.resumen, ficha.siguiente_paso);
}

function truncateToTokens(text, maxNewTokens) {
  const n = Number(maxNewTokens);
  if (!Number.isFinite(n) || n <= 0) return text;
  const maxChars = Math.floor(n * 3.6);
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

/**
 * Simulated generation.
 * @param {{modelRef: {kind: "adapter"|"base", id: string}, adapter?: object,
 *   checkpoint?: object, input: string, params?: {temperature, maxNewTokens,
 *   topP}, seed?: string|number}} args
 * @returns {string}
 */
export function simulateResponse({
  modelRef,
  adapter,
  checkpoint,
  input,
  params,
  seed,
}) {
  const clean = normalizeInput(input);
  const key = `${clean}|${seed === undefined ? "" : seed}`;
  const heldOut = HELD_OUT_BY_INPUT.get(clean);
  const isAdapter = modelRef && modelRef.kind === "adapter";
  const trainedOnFichas =
    isAdapter && adapter && adapter.datasetId === "fichas-soporte";
  let text;

  if (trainedOnFichas) {
    if (heldOut) {
      const ficha = ADAPTED_HELD_OUT[heldOut.id] || heldOut.reference;
      text = serializeFicha(ficha, key, params);
    } else if (TRAINING_FICHAS.has(clean)) {
      // Memorized training example.
      text = TRAINING_FICHAS.get(clean);
    } else {
      text = serializeFicha(adaptedFicha(clean, key, params), key, params);
    }
  } else if (isAdapter) {
    // Adapter trained on another dataset: concise support-assistant style.
    const { category } = classifyTicket(clean);
    text = category
      ? `${pick(
          NEXT_STEPS[category],
          `${key}|other`,
        )} Si el problema persiste, revisa el registro correspondiente en DashAI.`
      : "Puedo ayudarte con dudas sobre datos, entrenamiento o uso de modelos en DashAI. ¿Qué necesitas revisar?";
  } else if (heldOut) {
    if (BASE_JSON_HELD_OUT[heldOut.id]) {
      const f = BASE_JSON_HELD_OUT[heldOut.id];
      text = fichaJson(f.categoria, f.resumen, f.siguiente_paso);
    } else {
      text = baseTicketProse(
        clean,
        BASE_PROSE_CATEGORY[heldOut.id] || null,
        key,
        params,
      );
    }
  } else {
    const { category } = classifyTicket(clean);
    if (category) {
      const mentioned = hash32(`${key}|cat`) % 2 === 0 ? category : null;
      text = baseTicketProse(clean, mentioned, key, params);
    } else {
      text = genericBaseAnswer(clean, key, params);
    }
  }

  // Smaller base checkpoints ramble a little less.
  if (
    !isAdapter &&
    checkpoint &&
    checkpoint.parametersB &&
    checkpoint.parametersB < 0.4
  ) {
    text = text.split("\n").slice(0, 6).join("\n");
  }
  return truncateToTokens(text, params && params.maxNewTokens);
}

/**
 * Format/category checks used by the comparison (R83). A valid ficha is a JSON
 * object with exactly categoria, resumen and siguiente_paso as non-empty
 * strings (the category value is checked separately against the reference).
 * For prose, the category is read from a "Categoría: X" mention when present.
 * @returns {{jsonValid: boolean, parsed: boolean, category: string|null}}
 */
export function checkFicha(text) {
  const raw = String(text || "").trim();
  let obj = null;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    obj = null;
  }
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const keys = Object.keys(obj).sort();
    const exact =
      keys.length === 3 &&
      keys[0] === "categoria" &&
      keys[1] === "resumen" &&
      keys[2] === "siguiente_paso" &&
      keys.every((k) => typeof obj[k] === "string" && obj[k].trim().length > 0);
    const category =
      typeof obj.categoria === "string" ? obj.categoria.toLowerCase() : null;
    return { jsonValid: exact, parsed: true, category };
  }
  const match = raw.match(/categor[ií]a[^:\n]*:\s*([a-záéíóú]+)/i);
  return {
    jsonValid: false,
    parsed: false,
    category: match ? match[1].toLowerCase() : null,
  };
}

/** Simulated generation latency in ms (deterministic; longer for longer text). */
export function simulateLatencyMs(text, modelRef, seed) {
  const base = modelRef && modelRef.kind === "adapter" ? 650 : 520;
  const perChar = 9;
  const jitter = hash32(`${seed}|lat`) % 400;
  return base + Math.min(String(text || "").length, 1400) * perChar + jitter;
}
