// SFT data preparation helpers (SPEC §3.5). Pure functions: no React, no
// storage, no network. Token counts are approximations (chars / 3.6) and the
// template is ChatML-like; the UI labels both as illustrative.

export const SFT_FORMATS = Object.freeze([
  "alpaca",
  "prompt_completion",
  "messages",
]);
export const SUPPORTED_ROLES = Object.freeze(["system", "user", "assistant"]);
export const CHARS_PER_TOKEN = 3.6;

// Validation issue codes. Every code except `too_long` blocks the start (R26).
export const ISSUE_CODES = Object.freeze([
  "missing_column",
  "empty_value",
  "invalid_json",
  "unsupported_role",
  "no_assistant",
  "truncation_kills_response",
  "too_long",
]);
export const BLOCKING_ISSUES = Object.freeze(
  ISSUE_CODES.filter((code) => code !== "too_long"),
);

const MESSAGES_COLUMNS = [
  "messages",
  "conversations",
  "conversation",
  "dialogo",
  "diálogo",
];

const PAIR_SYNONYMS = [
  ["question", "answer"],
  ["pregunta", "respuesta"],
  ["input", "output"],
  ["entrada", "salida"],
  ["prompt", "response"],
  ["instruction", "response"],
];

const MAPPING_CANDIDATES = {
  alpaca: {
    instruction: ["instruction", "instruccion", "instrucción"],
    input: ["input", "entrada", "context", "contexto"],
    output: ["output", "respuesta", "salida", "response"],
  },
  prompt_completion: {
    prompt: [
      "prompt",
      "question",
      "pregunta",
      "instruction",
      "instruccion",
      "input",
      "entrada",
    ],
    completion: [
      "completion",
      "answer",
      "respuesta",
      "output",
      "salida",
      "response",
    ],
  },
  messages: {
    messages: MESSAGES_COLUMNS,
  },
};

export const REQUIRED_FIELDS = Object.freeze({
  alpaca: ["instruction", "output"],
  prompt_completion: ["prompt", "completion"],
  messages: ["messages"],
});

export const OPTIONAL_FIELDS = Object.freeze({
  alpaca: ["input"],
  prompt_completion: [],
  messages: [],
});

function lowerIndex(columns) {
  const index = {};
  (columns || []).forEach((c) => {
    if (typeof c === "string") index[c.trim().toLowerCase()] = c;
  });
  return index;
}

function findColumn(index, candidates) {
  for (const candidate of candidates) {
    if (index[candidate]) return index[candidate];
  }
  return undefined;
}

export function isEmptyValue(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (typeof value === "number") return Number.isNaN(value);
  return false;
}

function toText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }
  return String(value);
}

// Parses a messages cell (array or JSON string). Returns { ok, list, error }.
function parseMessagesCell(value) {
  let list = value;
  if (typeof value === "string") {
    try {
      list = JSON.parse(value);
    } catch (e) {
      return { ok: false, error: "invalid_json" };
    }
  }
  if (!Array.isArray(list)) return { ok: false, error: "invalid_json" };
  return { ok: true, list };
}

function looksLikeMessages(value) {
  const parsed = parseMessagesCell(value);
  if (!parsed.ok || parsed.list.length === 0) return null;
  const first = parsed.list.find((m) => m && typeof m === "object");
  if (!first) return null;
  if ("role" in first && "content" in first) return "openai";
  if ("from" in first && "value" in first) return "sharegpt";
  return null;
}

/**
 * Suggests an SFT format from column names (and, for message columns, from
 * the cell content). The result is only a suggestion: the user confirms it
 * unless confidence is "high" (R21).
 * @returns {{format: string|null, confidence: "high"|"medium"|"none",
 *   reason: string, mapping: object}}
 * reason ∈ alpaca_columns | prompt_completion_columns | synonym_columns |
 *   messages_column | sharegpt_column | text_only | no_match | empty
 */
export function detectFormat(columns, rows) {
  const cols =
    Array.isArray(columns) && columns.length > 0
      ? columns
      : Object.keys((rows && rows[0]) || {});
  if (!cols || cols.length === 0) {
    return { format: null, confidence: "none", reason: "empty", mapping: {} };
  }
  const index = lowerIndex(cols);

  // messages-style column holding a JSON list of turns.
  const messagesCol = findColumn(index, MESSAGES_COLUMNS);
  if (messagesCol) {
    const sample = (rows || [])
      .map((r) => r && r[messagesCol])
      .find((v) => !isEmptyValue(v));
    const kind = sample !== undefined ? looksLikeMessages(sample) : null;
    if (kind === "openai") {
      return {
        format: "messages",
        confidence: "high",
        reason: "messages_column",
        mapping: { messages: messagesCol },
      };
    }
    if (kind === "sharegpt") {
      return {
        format: "messages",
        confidence: "medium",
        reason: "sharegpt_column",
        mapping: { messages: messagesCol },
      };
    }
  }

  if (index.instruction && index.output) {
    return {
      format: "alpaca",
      confidence: "high",
      reason: "alpaca_columns",
      mapping: suggestMapping("alpaca", cols),
    };
  }

  if (index.prompt && index.completion) {
    return {
      format: "prompt_completion",
      confidence: "high",
      reason: "prompt_completion_columns",
      mapping: { prompt: index.prompt, completion: index.completion },
    };
  }

  for (const [p, c] of PAIR_SYNONYMS) {
    if (index[p] && index[c] && !(p === "input" && index.instruction)) {
      return {
        format: "prompt_completion",
        confidence: "medium",
        reason: "synonym_columns",
        mapping: { prompt: index[p], completion: index[c] },
      };
    }
  }

  const nonEmptyCols = cols.filter((c) => typeof c === "string");
  if (index.text && nonEmptyCols.length <= 2) {
    return {
      format: null,
      confidence: "none",
      reason: "text_only",
      mapping: {},
    };
  }
  return { format: null, confidence: "none", reason: "no_match", mapping: {} };
}

/** Column mapping suggestion for a format: { field: columnName }. */
export function suggestMapping(format, columns) {
  const candidates = MAPPING_CANDIDATES[format];
  if (!candidates) return {};
  const index = lowerIndex(columns);
  const mapping = {};
  Object.entries(candidates).forEach(([field, names]) => {
    const col = findColumn(index, names);
    if (col) mapping[field] = col;
  });
  // prompt and completion must not point to the same column.
  if (format === "prompt_completion" && mapping.prompt === mapping.completion) {
    delete mapping.completion;
  }
  return mapping;
}

/** Mapping fields that are required but not assigned. */
export function missingMappingFields(format, mapping) {
  return (REQUIRED_FIELDS[format] || []).filter((f) => !(mapping || {})[f]);
}

function withSystem(messages, systemPrompt) {
  const sp = typeof systemPrompt === "string" ? systemPrompt.trim() : "";
  if (!sp || messages.some((m) => m.role === "system")) return messages;
  return [{ role: "system", content: sp }, ...messages];
}

const SHAREGPT_ROLES = {
  human: "user",
  user: "user",
  gpt: "assistant",
  assistant: "assistant",
  system: "system",
};

/**
 * Converts one source row to canonical messages.
 * Alpaca: user = instruction (+ "\n\n" + input when non-empty), assistant = output.
 * @returns {{ok: boolean, messages: {role, content}[], error?: {code, column}}}
 */
export function normalizeRow(row, format, mapping, systemPrompt = "") {
  const r = row || {};
  const m = mapping || {};
  const fail = (code, column) => ({
    ok: false,
    messages: [],
    error: { code, column },
  });
  const has = (col) => col && Object.prototype.hasOwnProperty.call(r, col);

  if (format === "alpaca") {
    if (!has(m.instruction))
      return fail("missing_column", m.instruction || "instruction");
    if (!has(m.output)) return fail("missing_column", m.output || "output");
    if (isEmptyValue(r[m.instruction]))
      return fail("empty_value", m.instruction);
    if (isEmptyValue(r[m.output])) return fail("empty_value", m.output);
    const input =
      m.input && !isEmptyValue(r[m.input]) ? toText(r[m.input]).trim() : "";
    const user = input
      ? `${toText(r[m.instruction]).trim()}\n\n${input}`
      : toText(r[m.instruction]).trim();
    return {
      ok: true,
      messages: withSystem(
        [
          { role: "user", content: user },
          { role: "assistant", content: toText(r[m.output]).trim() },
        ],
        systemPrompt,
      ),
    };
  }

  if (format === "prompt_completion") {
    if (!has(m.prompt)) return fail("missing_column", m.prompt || "prompt");
    if (!has(m.completion))
      return fail("missing_column", m.completion || "completion");
    if (isEmptyValue(r[m.prompt])) return fail("empty_value", m.prompt);
    if (isEmptyValue(r[m.completion])) return fail("empty_value", m.completion);
    return {
      ok: true,
      messages: withSystem(
        [
          { role: "user", content: toText(r[m.prompt]).trim() },
          { role: "assistant", content: toText(r[m.completion]).trim() },
        ],
        systemPrompt,
      ),
    };
  }

  if (format === "messages") {
    if (!has(m.messages))
      return fail("missing_column", m.messages || "messages");
    if (isEmptyValue(r[m.messages])) return fail("empty_value", m.messages);
    const parsed = parseMessagesCell(r[m.messages]);
    if (!parsed.ok) return fail("invalid_json", m.messages);
    const messages = [];
    for (const item of parsed.list) {
      if (!item || typeof item !== "object")
        return fail("invalid_json", m.messages);
      const rawRole = item.role !== undefined ? item.role : item.from;
      const role =
        item.role !== undefined ? rawRole : SHAREGPT_ROLES[rawRole] || rawRole;
      const content = item.content !== undefined ? item.content : item.value;
      if (!SUPPORTED_ROLES.includes(role))
        return fail("unsupported_role", m.messages);
      if (isEmptyValue(content)) return fail("empty_value", m.messages);
      messages.push({ role, content: toText(content).trim() });
    }
    if (!messages.some((msg) => msg.role === "assistant")) {
      return fail("no_assistant", m.messages);
    }
    return { ok: true, messages: withSystem(messages, systemPrompt) };
  }

  return fail("missing_column", null);
}

export function approxTokens(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / CHARS_PER_TOKEN);
}

/**
 * Renders canonical messages with a ChatML-like template and marks which
 * segments count toward the loss (assistant content only, R24/R25).
 * Segments beyond `maxLength` tokens are marked `truncated: true` (a segment
 * crossing the limit is split in two).
 * @returns {{segments: {role, text, supervised, kind: "special"|"content",
 *   tokens, truncated}[], approxTokens, keptTokens, truncated, supervisedTokens}}
 */
export function renderSftExample(messages, { maxLength } = {}) {
  const limit = Number(maxLength) > 0 ? Number(maxLength) : Infinity;
  const raw = [];
  (messages || []).forEach((msg) => {
    const role = msg && msg.role;
    raw.push({
      role,
      text: `<|im_start|>${role}\n`,
      supervised: false,
      kind: "special",
    });
    raw.push({
      role,
      text: msg && msg.content ? String(msg.content) : "",
      supervised: role === "assistant",
      kind: "content",
    });
    raw.push({
      role,
      text: "<|im_end|>\n",
      supervised: false,
      kind: "special",
    });
  });

  const segments = [];
  let used = 0;
  let total = 0;
  let supervisedTokens = 0;
  let truncated = false;
  raw.forEach((seg) => {
    // Special markers count as single tokens; content uses the char estimate.
    const tokens = seg.kind === "special" ? 3 : approxTokens(seg.text);
    total += tokens;
    if (used >= limit) {
      truncated = true;
      segments.push({ ...seg, tokens, truncated: true });
      return;
    }
    if (used + tokens <= limit) {
      used += tokens;
      if (seg.supervised) supervisedTokens += tokens;
      segments.push({ ...seg, tokens, truncated: false });
      return;
    }
    // Crossing segment: split at the remaining budget.
    truncated = true;
    const keepTokens = limit - used;
    if (seg.kind === "special") {
      segments.push({ ...seg, tokens, truncated: true });
      used = limit;
      return;
    }
    const keepChars = Math.max(0, Math.floor(keepTokens * CHARS_PER_TOKEN));
    const kept = seg.text.slice(0, keepChars);
    const cut = seg.text.slice(keepChars);
    if (kept) {
      const keptTok = approxTokens(kept);
      segments.push({ ...seg, text: kept, tokens: keptTok, truncated: false });
      if (seg.supervised) supervisedTokens += keptTok;
    }
    if (cut) {
      segments.push({
        ...seg,
        text: cut,
        tokens: approxTokens(cut),
        truncated: true,
      });
    }
    used = limit;
  });

  return {
    segments,
    approxTokens: total,
    keptTokens: Math.min(total, limit),
    truncated,
    supervisedTokens,
  };
}

/**
 * Validates every row (not just the preview sample). Never repairs or drops
 * rows silently (R26). Row indices are 0-based in `rows`; `rowNumbers` are
 * the same rows 1-based for display.
 * @returns {{valid, total, validCount, issues: {code, count, rows, rowNumbers,
 *   column?, blocking}[], blocking, supervisedTokens, tooLongCount}}
 */
export function validateRows(rows, format, mapping, opts = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const total = list.length;
  if (!format) {
    return {
      valid: false,
      total,
      validCount: 0,
      issues: [],
      blocking: true,
      formatMissing: true,
      supervisedTokens: 0,
    };
  }
  const { maxLength = 512, systemPrompt = "" } = opts;
  const issueMap = new Map();
  const addIssue = (code, column, rowIndex) => {
    const key = `${code}|${column || ""}`;
    if (!issueMap.has(key)) {
      issueMap.set(key, {
        code,
        column: column || undefined,
        count: 0,
        rows: [],
      });
    }
    const issue = issueMap.get(key);
    issue.count += 1;
    if (issue.rows.length < 5) issue.rows.push(rowIndex);
  };

  // Missing mapping assignments are reported once for the whole dataset.
  const missingFields = missingMappingFields(format, mapping);
  if (missingFields.length > 0) {
    missingFields.forEach((field) => {
      issueMap.set(`missing_column|${field}`, {
        code: "missing_column",
        column: field,
        count: total,
        rows: list.slice(0, 5).map((_, i) => i),
      });
    });
  }

  let validCount = 0;
  let supervisedTokens = 0;
  if (missingFields.length === 0) {
    list.forEach((row, i) => {
      const normalized = normalizeRow(row, format, mapping, systemPrompt);
      if (!normalized.ok) {
        addIssue(normalized.error.code, normalized.error.column, i);
        return;
      }
      const rendered = renderSftExample(normalized.messages, { maxLength });
      if (rendered.truncated && rendered.supervisedTokens === 0) {
        addIssue("truncation_kills_response", undefined, i);
        return;
      }
      if (rendered.truncated) addIssue("too_long", undefined, i);
      supervisedTokens += rendered.supervisedTokens;
      validCount += 1;
    });
  }

  const order = (code) => ISSUE_CODES.indexOf(code);
  const issues = [...issueMap.values()]
    .map((issue) => ({
      ...issue,
      rowNumbers: issue.rows.map((r) => r + 1),
      blocking: BLOCKING_ISSUES.includes(issue.code),
    }))
    .sort((a, b) => order(a.code) - order(b.code));
  const blocking = issues.some((issue) => issue.blocking) || total === 0;
  const tooLong = issues.find((issue) => issue.code === "too_long");
  return {
    valid: !blocking,
    total,
    validCount,
    issues,
    blocking,
    supervisedTokens,
    tooLongCount: tooLong ? tooLong.count : 0,
  };
}

// Deterministic PRNG (mulberry32).
export function mulberry32(seed) {
  let a = Number(seed) >>> 0 || 0x9e3779b9;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Reproducible train/eval split (seeded Fisher-Yates). eval count =
 * useEval ? max(1, round(n·f)) : 0, reduced if needed so that train keeps at
 * least 2 examples. Indices are returned sorted.
 * @returns {{train: number[], eval: number[], ok: boolean}}
 */
export function partition(
  n,
  { evalFraction = 0.1, seed = 42, useEval = true } = {},
) {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  const indices = Array.from({ length: count }, (_, i) => i);
  const rand = mulberry32(seed);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }
  let evalCount = useEval
    ? Math.max(1, Math.round(count * (Number(evalFraction) || 0)))
    : 0;
  if (count - evalCount < 2) evalCount = Math.max(0, count - 2);
  const evalIdx = indices.slice(0, evalCount).sort((a, b) => a - b);
  const train = indices.slice(evalCount).sort((a, b) => a - b);
  return { train, eval: evalIdx, ok: train.length >= 2 };
}

/** Train/eval counts without materializing indices (large datasets). */
export function partitionCounts(
  n,
  { evalFraction = 0.1, useEval = true } = {},
) {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  let evalCount = useEval
    ? Math.max(1, Math.round(count * (Number(evalFraction) || 0)))
    : 0;
  if (count - evalCount < 2) evalCount = Math.max(0, count - 2);
  return {
    train: count - evalCount,
    eval: evalCount,
    ok: count - evalCount >= 2,
  };
}

function* utf8Bytes(str) {
  for (let i = 0; i < str.length; i += 1) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const low = str.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        i += 1;
      }
    }
    if (code < 0x80) {
      yield code;
    } else if (code < 0x800) {
      yield 0xc0 | (code >> 6);
      yield 0x80 | (code & 0x3f);
    } else if (code < 0x10000) {
      yield 0xe0 | (code >> 12);
      yield 0x80 | ((code >> 6) & 0x3f);
      yield 0x80 | (code & 0x3f);
    } else {
      yield 0xf0 | (code >> 18);
      yield 0x80 | ((code >> 12) & 0x3f);
      yield 0x80 | ((code >> 6) & 0x3f);
      yield 0x80 | (code & 0x3f);
    }
  }
}

/** 64-bit FNV-1a over a UTF-8 string, as 16 hex chars. */
export function fnv1a64(text) {
  // 64-bit arithmetic with four 16-bit limbs (no BigInt needed).
  let h0 = 0x2325;
  let h1 = 0x8422;
  let h2 = 0x9ce4;
  let h3 = 0xcbf2;
  for (const byte of utf8Bytes(String(text))) {
    h0 ^= byte;
    // Multiply by the FNV prime 0x00000100000001b3.
    const t0 = h0 * 0x1b3;
    const t1 = h1 * 0x1b3;
    const t2 = h2 * 0x1b3;
    const t3 = h3 * 0x1b3;
    // (h << 40): limb shift by 2 plus 8 bits.
    const s2 = (h0 << 8) & 0xffff;
    const s3 = ((h1 << 8) | (h0 >>> 8)) & 0xffff;
    let carry = 0;
    let r0 = t0 + carry;
    carry = r0 >>> 16;
    r0 &= 0xffff;
    let r1 = t1 + carry;
    carry = r1 >>> 16;
    r1 &= 0xffff;
    let r2 = t2 + s2 + carry;
    carry = r2 >>> 16;
    r2 &= 0xffff;
    const r3 = (t3 + s3 + carry) & 0xffff;
    h0 = r0;
    h1 = r1;
    h2 = r2;
    h3 = r3;
  }
  const hex = (v) => v.toString(16).padStart(4, "0");
  return `${hex(h3)}${hex(h2)}${hex(h1)}${hex(h0)}`;
}

/**
 * Data fingerprint ("huella", R28) over normalized rows (arrays of messages
 * or any JSON-serializable values). 16 hex chars, FNV-1a 64.
 */
export function fingerprint(normalizedRows) {
  const list = Array.isArray(normalizedRows) ? normalizedRows : [];
  const text = list.map((row) => JSON.stringify(row)).join("\n");
  return fnv1a64(text);
}

/**
 * Orientative VRAM estimate in GB (R15), rounded to 0.1:
 * weights = P × (qlora ? 0.62 : 2.05); lora+opt = P × 0.02 × (r/16);
 * activations = batch × (maxLength/512) × (0.35 + 0.25 × P); overhead 0.6.
 */
export function estimateVram({
  parametersB,
  method,
  batchSize,
  maxLength,
  loraR,
  gradientCheckpointing = true,
}) {
  const P = Number(parametersB) || 0;
  const weights = P * (method === "qlora" ? 0.62 : 2.05);
  const loraOpt = P * 0.02 * ((Number(loraR) || 16) / 16);
  let activations =
    (Number(batchSize) || 1) *
    ((Number(maxLength) || 512) / 512) *
    (0.35 + 0.25 * P);
  if (!gradientCheckpointing) activations *= 3;
  const total = weights + loraOpt + activations + 0.6;
  return Math.round(total * 10) / 10;
}

/**
 * Prepares the frozen data part of a run: normalizes rows, fingerprints the
 * normalized copy, computes the split and keeps ≤3 preview examples. Never
 * returns full rows.
 * @param {object[]} rows source rows available client-side (full sample
 *   datasets, or the ≤10-row sample of a DashAI dataset)
 * @param {object} draft session draft (format, mapping, splits, maxSamples…)
 * @param {{totalRows?: number, sampled?: boolean}} meta
 */
export function prepareDataset(rows, draft, meta = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const format = draft && draft.format;
  const mapping = (draft && draft.mapping) || {};
  const systemPrompt = (draft && draft.systemPrompt) || "";
  const maxLength =
    draft && draft.parameters ? draft.parameters.maxLength : 512;
  const validation = validateRows(list, format, mapping, {
    maxLength,
    systemPrompt,
  });
  const normalized = [];
  list.forEach((row, i) => {
    const res = normalizeRow(row, format, mapping, systemPrompt);
    if (res.ok) normalized.push({ sourceIndex: i, messages: res.messages });
  });
  const declaredTotal = Number(meta.totalRows) || list.length;
  const maxSamples =
    draft && Number(draft.maxSamples) > 0 ? Number(draft.maxSamples) : null;
  const usedRows = maxSamples
    ? Math.min(declaredTotal, maxSamples)
    : declaredTotal;
  const splits = (draft && draft.splits) || {};
  const counts = partitionCounts(usedRows, splits);
  let evalIndices = null;
  if (usedRows <= 500) {
    evalIndices = partition(usedRows, splits).eval;
  }
  const avgSupervised = validation.validCount
    ? Math.round(validation.supervisedTokens / validation.validCount)
    : 0;
  return {
    fingerprint: fingerprint(normalized.map((n) => n.messages)),
    format,
    mapping: { ...mapping },
    systemPrompt,
    totalRows: declaredTotal,
    usedRows,
    sampled: Boolean(meta.sampled) || list.length < declaredTotal,
    checkedRows: list.length,
    trainCount: counts.train,
    evalCount: counts.eval,
    splitOk: counts.ok,
    evalIndices,
    splitSeed: splits.seed,
    evalFraction: splits.useEval === false ? 0 : splits.evalFraction,
    useEval: splits.useEval !== false,
    supervisedTokens: Math.round(avgSupervised * counts.train),
    avgSupervisedTokens: avgSupervised,
    preparedPreview: normalized.slice(0, 3),
    validation: {
      valid: validation.valid,
      blocking: validation.blocking,
      validCount: validation.validCount,
      issues: validation.issues,
    },
  };
}
