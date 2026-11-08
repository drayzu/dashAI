// Static fixtures and constants for the simulated fine-tuning prototype
// (SPEC §3.1, §3.6). Everything here is plain data: no React, no i18n calls.
// User-visible labels are resolved by the UI through the i18n keys referenced
// here (`fineTuning:catalog.*`, `fineTuning:presets.*`).

export const RUN_STATUS = Object.freeze({
  NOT_STARTED: 0,
  QUEUED: 1,
  RUNNING: 2,
  FINISHED: 3,
  ERROR: 4,
});

// Ordered run phases (independent from status and termination reason, R55).
export const PHASES = Object.freeze([
  "preparing",
  "downloading",
  "validating",
  "loading",
  "training",
  "evaluating",
  "saving",
]);

export const TERMINATION_REASONS = Object.freeze([
  "failed",
  "cancelled",
  "interrupted",
]);

export const FAILURE_CODES = Object.freeze([
  "oom",
  "incomplete_download",
  "interrupted",
  "invalid_data_full",
  "mask_invalid",
  "nan_loss",
  "grad_norm_warning",
  "missing_adapter",
  "gpu_busy",
]);

export const CHECKPOINT_AVAILABILITY = Object.freeze([
  "missing",
  "downloading",
  "ready",
  "invalid",
]);

export const ADAPTER_AVAILABILITY = Object.freeze([
  "ready",
  "missing",
  "invalid",
]);

export const METHODS = Object.freeze(["qlora", "lora"]);

export const SPEEDS = Object.freeze([1, 4, 20]);

export const ALL_TARGET_MODULES = Object.freeze([
  "q_proj",
  "k_proj",
  "v_proj",
  "o_proj",
  "gate_proj",
  "up_proj",
  "down_proj",
]);

export const MAX_LENGTH_OPTIONS = Object.freeze([128, 256, 512, 1024, 2048]);

// Simulated library versions recorded in every frozen configuration (R60).
export const LIBRARY_VERSIONS = Object.freeze({
  transformers: "4.46.3",
  peft: "0.13.2",
  trl: "0.12.1",
  bitsandbytes: "0.44.1",
  torch: "2.5.1+cu121",
  dashai: "0.10.0 (prototipo frontend)",
});

// Hardware used when the real hardware monitor is unavailable (SPEC §3.3).
export const SIMULATED_HARDWARE = Object.freeze({
  gpuName: "NVIDIA GeForce GTX 1080",
  vramGb: 8,
  ramGb: 16,
  accelerator: "cuda",
  source: "simulated",
});

// LoRA trainable parameters per unit of rank, per target module, summed over
// all decoder layers: layers × (in_features + out_features). Used to give the
// adapters a believable size (r16 on Qwen2.5-0.5B ≈ 35 MB in fp32).
const QWEN05_PER_RANK = {
  q_proj: 24 * (896 + 896),
  k_proj: 24 * (896 + 128),
  v_proj: 24 * (896 + 128),
  o_proj: 24 * (896 + 896),
  gate_proj: 24 * (896 + 4864),
  up_proj: 24 * (896 + 4864),
  down_proj: 24 * (4864 + 896),
};
const QWEN15_PER_RANK = {
  q_proj: 28 * (1536 + 1536),
  k_proj: 28 * (1536 + 256),
  v_proj: 28 * (1536 + 256),
  o_proj: 28 * (1536 + 1536),
  gate_proj: 28 * (1536 + 8960),
  up_proj: 28 * (1536 + 8960),
  down_proj: 28 * (8960 + 1536),
};
const LLAMA1B_PER_RANK = {
  q_proj: 16 * (2048 + 2048),
  k_proj: 16 * (2048 + 512),
  v_proj: 16 * (2048 + 512),
  o_proj: 16 * (2048 + 2048),
  gate_proj: 16 * (2048 + 8192),
  up_proj: 16 * (2048 + 8192),
  down_proj: 16 * (8192 + 2048),
};
const SMOL360_PER_RANK = {
  q_proj: 32 * (960 + 960),
  k_proj: 32 * (960 + 320),
  v_proj: 32 * (960 + 320),
  o_proj: 32 * (960 + 960),
  gate_proj: 32 * (960 + 2560),
  up_proj: 32 * (960 + 2560),
  down_proj: 32 * (2560 + 960),
};
const PHI35_PER_RANK = {
  q_proj: 32 * (3072 + 3072),
  k_proj: 32 * (3072 + 3072),
  v_proj: 32 * (3072 + 3072),
  o_proj: 32 * (3072 + 3072),
  gate_proj: 32 * (3072 + 8192),
  up_proj: 32 * (3072 + 8192),
  down_proj: 32 * (8192 + 3072),
};

// Trainable catalog (Transformers checkpoints), separate from DashAI's GGUF
// inference catalog (R10). Revisions are fixed 40-hex commit ids; the UI
// labels them as illustrative.
export const CHECKPOINT_CATALOG = Object.freeze([
  {
    id: "qwen2.5-0.5b-instruct",
    i18nKey: "qwen25_05b",
    name: "Qwen2.5 0.5B Instruct",
    family: "Qwen2.5",
    repository: "Qwen/Qwen2.5-0.5B-Instruct",
    revision: "7ae557604adf67be50417f59c2c2f167def9a775",
    parametersB: 0.49,
    diskBytes: 988097824,
    contextLength: 32768,
    license: "Apache-2.0",
    methods: ["lora", "qlora"],
    gated: false,
    chatTemplate: "chatml",
    loraParamsPerRank: QWEN05_PER_RANK,
    defaultAvailability: "ready",
  },
  {
    id: "qwen2.5-1.5b-instruct",
    i18nKey: "qwen25_15b",
    name: "Qwen2.5 1.5B Instruct",
    family: "Qwen2.5",
    repository: "Qwen/Qwen2.5-1.5B-Instruct",
    revision: "989aa7980e4cf806f80c7fef2b1adb7bc71aa306",
    parametersB: 1.54,
    diskBytes: 3087467144,
    contextLength: 32768,
    license: "Apache-2.0",
    methods: ["lora", "qlora"],
    gated: false,
    chatTemplate: "chatml",
    loraParamsPerRank: QWEN15_PER_RANK,
    defaultAvailability: "missing",
  },
  {
    id: "llama-3.2-1b-instruct",
    i18nKey: "llama32_1b",
    name: "Llama 3.2 1B Instruct",
    family: "Llama 3.2",
    repository: "meta-llama/Llama-3.2-1B-Instruct",
    revision: "9213176726f574b556790deb65791e0c5aa438b6",
    parametersB: 1.24,
    diskBytes: 2471645608,
    contextLength: 131072,
    license: "Llama 3.2 Community License",
    methods: ["lora", "qlora"],
    gated: true,
    chatTemplate: "llama3",
    loraParamsPerRank: LLAMA1B_PER_RANK,
    defaultAvailability: "missing",
  },
  {
    id: "smollm2-360m-instruct",
    i18nKey: "smollm2_360m",
    name: "SmolLM2 360M Instruct",
    family: "SmolLM2",
    repository: "HuggingFaceTB/SmolLM2-360M-Instruct",
    revision: "a10cc1512eabd3dde888204e902eca88bddb4951",
    parametersB: 0.36,
    diskBytes: 723674912,
    contextLength: 8192,
    license: "Apache-2.0",
    // QLoRA not validated for this checkpoint: explain, offer LoRA, never
    // switch automatically (R11).
    methods: ["lora"],
    gated: false,
    chatTemplate: "chatml",
    loraParamsPerRank: SMOL360_PER_RANK,
    defaultAvailability: "ready",
  },
  {
    id: "phi-3.5-mini-instruct",
    i18nKey: "phi35_mini",
    name: "Phi-3.5 mini Instruct",
    family: "Phi-3.5",
    repository: "microsoft/Phi-3.5-mini-instruct",
    revision: "af0dfb8029e8a74545d0736d30cb6b58d2f0f3f0",
    parametersB: 3.82,
    diskBytes: 7642181880,
    contextLength: 131072,
    license: "MIT",
    methods: ["lora", "qlora"],
    gated: false,
    chatTemplate: "phi3",
    loraParamsPerRank: PHI35_PER_RANK,
    defaultAvailability: "missing",
  },
]);

export function getCatalogEntry(checkpointId) {
  return CHECKPOINT_CATALOG.find((c) => c.id === checkpointId) || null;
}

// Mutable checkpoint records stored in the prototype state (availability,
// download progress). Catalog-only fields (loraParamsPerRank) stay here.
export function createInitialCheckpoints() {
  return CHECKPOINT_CATALOG.map((entry) => ({
    id: entry.id,
    i18nKey: entry.i18nKey,
    name: entry.name,
    family: entry.family,
    repository: entry.repository,
    revision: entry.revision,
    parametersB: entry.parametersB,
    diskBytes: entry.diskBytes,
    contextLength: entry.contextLength,
    license: entry.license,
    methods: [...entry.methods],
    gated: entry.gated,
    chatTemplate: entry.chatTemplate,
    availability: entry.defaultAvailability,
    downloadedBytes:
      entry.defaultAvailability === "ready" ? entry.diskBytes : 0,
    downloadStartedAt: null,
    download: null,
  }));
}

export function trainableParameters(checkpointId, loraR, targetModules) {
  const entry = getCatalogEntry(checkpointId);
  if (!entry) return 0;
  const modules =
    Array.isArray(targetModules) && targetModules.length > 0
      ? targetModules
      : ALL_TARGET_MODULES;
  const perRank = modules.reduce(
    (sum, m) => sum + (entry.loraParamsPerRank[m] || 0),
    0,
  );
  return perRank * (Number(loraR) || 0);
}

// adapter_model.safetensors stored in fp32 (4 bytes per trainable param).
export function estimateAdapterBytes(checkpointId, loraR, targetModules) {
  return trainableParameters(checkpointId, loraR, targetModules) * 4 + 4096;
}

export const DEFAULT_PARAMETERS = Object.freeze({
  maxSteps: 60,
  epochs: 1,
  learningRate: 2e-4,
  maxLength: 512,
  batchSize: 2,
  gradAccum: 4,
  loraR: 16,
  loraAlpha: 32,
  loraDropout: 0.05,
  targetModules: [...ALL_TARGET_MODULES],
  optimizer: "adamw_torch",
  scheduler: "linear",
  warmupSteps: 5,
  evalEvery: 10,
  logEvery: 1,
  seed: 42,
});

// Presets (SPEC §3.6). Labels: fineTuning:presets.<key>.name/description.
export const PRESETS = Object.freeze({
  quick_test: {
    key: "quick_test",
    durationMode: "steps",
    parameters: {
      maxSteps: 10,
      maxLength: 256,
      batchSize: 1,
      gradAccum: 1,
      loraR: 8,
      loraAlpha: 16,
      optimizer: "adamw_torch",
      warmupSteps: 2,
      evalEvery: 5,
      learningRate: 2e-4,
    },
  },
  balanced: {
    key: "balanced",
    durationMode: "steps",
    parameters: {
      maxSteps: 60,
      maxLength: 512,
      batchSize: 2,
      gradAccum: 4,
      loraR: 16,
      loraAlpha: 32,
      optimizer: "adamw_torch",
      warmupSteps: 5,
      evalEvery: 10,
      learningRate: 2e-4,
    },
  },
  qlora_8gb: {
    key: "qlora_8gb",
    durationMode: "steps",
    recommendedMethod: "qlora",
    parameters: {
      maxSteps: 120,
      maxLength: 1024,
      batchSize: 1,
      gradAccum: 8,
      loraR: 16,
      loraAlpha: 32,
      optimizer: "adamw_8bit",
      warmupSteps: 10,
      evalEvery: 20,
      learningRate: 2e-4,
    },
  },
});

export const PRESET_KEYS = Object.freeze([
  "quick_test",
  "balanced",
  "qlora_8gb",
  "custom",
]);

export function getPresetParameters(presetKey) {
  const preset = PRESETS[presetKey];
  return preset ? { ...preset.parameters } : null;
}

// Returns the preset key whose values all match `parameters`, else "custom".
export function detectPreset(parameters, durationMode = "steps") {
  if (durationMode !== "steps" || !parameters) return "custom";
  const match = Object.values(PRESETS).find((preset) =>
    Object.entries(preset.parameters).every(([k, v]) => parameters[k] === v),
  );
  return match ? match.key : "custom";
}

// Allowed ranges for client-side validation (shared by store and UI).
export const PARAMETER_LIMITS = Object.freeze({
  maxSteps: { min: 1, max: 10000, integer: true },
  epochs: { min: 1, max: 20, integer: true },
  learningRate: { min: 1e-6, max: 1e-2 },
  maxLength: { min: 64, max: 4096, integer: true },
  batchSize: { min: 1, max: 64, integer: true },
  gradAccum: { min: 1, max: 128, integer: true },
  loraR: { min: 1, max: 256, integer: true },
  loraAlpha: { min: 1, max: 512 },
  loraDropout: { min: 0, max: 0.5 },
  warmupSteps: { min: 0, max: 1000, integer: true },
  evalEvery: { min: 1, max: 10000, integer: true },
  logEvery: { min: 1, max: 1000, integer: true },
  seed: { min: 0, max: 2147483647, integer: true },
});

// Validates a parameters object. Returns { field: code } with codes
// "required" | "not_integer" | "out_of_range" | "empty_modules" |
// "invalid_choice" (i18n: fineTuning:validation.params.<code>).
export function validateParameters(parameters, durationMode = "steps") {
  const errors = {};
  const p = parameters || {};
  Object.entries(PARAMETER_LIMITS).forEach(([field, limit]) => {
    if (field === "maxSteps" && durationMode !== "steps") return;
    if (field === "epochs" && durationMode !== "epochs") return;
    const value = p[field];
    if (value === null || value === undefined || value === "") {
      if (field === "logEvery") return;
      errors[field] = "required";
      return;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      errors[field] = "required";
    } else if (limit.integer && !Number.isInteger(n)) {
      errors[field] = "not_integer";
    } else if (n < limit.min || n > limit.max) {
      errors[field] = "out_of_range";
    }
  });
  if (!Array.isArray(p.targetModules) || p.targetModules.length === 0) {
    errors.targetModules = "empty_modules";
  }
  if (p.optimizer && !["adamw_8bit", "adamw_torch"].includes(p.optimizer)) {
    errors.optimizer = "invalid_choice";
  }
  if (p.scheduler && !["linear", "cosine", "constant"].includes(p.scheduler)) {
    errors.scheduler = "invalid_choice";
  }
  return errors;
}

export function createDefaultDraft(overrides = {}) {
  const base = {
    checkpointId: null,
    method: "qlora",
    dataset: null,
    format: null,
    formatConfirmed: false,
    formatDetection: null,
    mapping: {},
    systemPrompt: "",
    splits: { evalFraction: 0.1, seed: 42, useEval: true },
    maxSamples: null,
    preset: "balanced",
    durationMode: "steps",
    parameters: {
      ...DEFAULT_PARAMETERS,
      targetModules: [...DEFAULT_PARAMETERS.targetModules],
    },
    runName: "",
    downloadConfirmed: false,
  };
  return {
    ...base,
    ...overrides,
    splits: { ...base.splits, ...(overrides.splits || {}) },
    mapping: { ...(overrides.mapping || base.mapping) },
    parameters: { ...base.parameters, ...(overrides.parameters || {}) },
  };
}

// Draft fields owned by the session's data preparation (prototype B keeps
// them in the session) vs. fields owned by each run configuration.
export const DATA_PREP_KEYS = Object.freeze([
  "dataset",
  "format",
  "formatConfirmed",
  "formatDetection",
  "mapping",
  "systemPrompt",
  "splits",
  "maxSamples",
]);

export const RUN_CONFIG_KEYS = Object.freeze([
  "checkpointId",
  "method",
  "preset",
  "durationMode",
  "parameters",
  "runName",
  "downloadConfirmed",
]);

// Decimal units (1 GB = 1e9 bytes), matching how model hubs label sizes.
export function formatBytes(bytes, decimals = 1) {
  const n = Number(bytes) || 0;
  if (n >= 1e9) return `${(n / 1e9).toFixed(Math.max(decimals, 2))} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(decimals)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(decimals)} KB`;
  return `${Math.round(n)} B`;
}
