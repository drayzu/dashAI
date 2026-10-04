export const checkpoints = [
  {
    id: "qwen-small",
    name: "Qwen2.5-0.5B-Instruct",
    repository: "Qwen/Qwen2.5-0.5B-Instruct",
    revision: "demo-snapshot-0.5b-v1",
    parameters: "0.5B",
    size: "1.0 GB",
    availability: "ready",
    methods: ["lora", "qlora"],
  },
  {
    id: "qwen-medium",
    name: "Qwen2.5-1.5B-Instruct",
    repository: "Qwen/Qwen2.5-1.5B-Instruct",
    revision: "demo-snapshot-1.5b-v1",
    parameters: "1.5B",
    size: "3.1 GB",
    availability: "missing",
    methods: ["lora", "qlora"],
  },
];

const pairs = [
  [
    "¿Cómo restablezco mi contraseña?",
    "Selecciona Recuperar contraseña e introduce tu correo. Recibirás un enlace para definir una nueva.",
  ],
  [
    "¿Puedo cambiar mi dirección de entrega?",
    "Sí, antes del despacho puedes editar la dirección desde el detalle del pedido.",
  ],
  [
    "Mi pedido no llegó. ¿Qué hago?",
    "Revisa el seguimiento y contacta con soporte indicando el número de pedido.",
  ],
  [
    "¿Cómo solicito una devolución?",
    "Abre el pedido, selecciona Solicitar devolución e indica el motivo.",
  ],
];

export const datasets = [
  {
    id: 101,
    name: "Soporte al cliente",
    format: "alpaca",
    source: "soporte-alpaca.json · ejemplo local",
    columns: ["instruction", "input", "output"],
    fingerprint: "demo:soporte:v1",
    rows: Array.from({ length: 32 }, (_, i) => ({
      instruction: pairs[i % 4][0],
      input: "Responde en español, de forma breve y cordial.",
      output: pairs[i % 4][1],
    })),
  },
  {
    id: 102,
    name: "Preguntas y respuestas",
    format: "pairs",
    source: "preguntas-respuestas.csv · ejemplo local",
    columns: ["pregunta", "respuesta"],
    fingerprint: "demo:preguntas:v1",
    rows: Array.from({ length: 24 }, (_, i) => ({
      pregunta: pairs[i % 4][0],
      respuesta: pairs[i % 4][1],
    })),
  },
  {
    id: 103,
    name: "Conversaciones de soporte",
    format: "messages",
    source: "conversaciones.jsonl · ejemplo local",
    columns: ["messages"],
    fingerprint: "demo:conversaciones:v1",
    rows: Array.from({ length: 16 }, (_, i) => ({
      messages: JSON.stringify([
        { role: "system", content: "Eres un asistente de soporte cordial." },
        { role: "user", content: pairs[i % 4][0] },
        { role: "assistant", content: pairs[i % 4][1] },
      ]),
    })),
  },
];

export function mappingFor(dataset) {
  if (dataset.format === "alpaca")
    return { instruction: "instruction", input: "input", response: "output" };
  if (dataset.format === "messages") return { messages: "messages" };
  return { instruction: "pregunta", response: "respuesta" };
}

export function defaultDraft() {
  return {
    checkpointId: "qwen-small",
    datasetId: 101,
    format: "alpaca",
    mapping: mappingFor(datasets[0]),
    method: "qlora",
    durationMode: "steps",
    parameters: {
      steps: 30,
      epochs: 1,
      learningRate: 0.0002,
      maxLength: 1024,
      batch: 2,
      accumulation: 4,
      rank: 16,
      alpha: 32,
      dropout: 0.05,
      targetModules: "all-linear",
      optimizer: "adamw_torch",
      scheduler: "linear",
    },
    validation: 0.2,
    seed: 42,
    scenario: "success",
  };
}
