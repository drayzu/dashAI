import {
  detectFormat,
  estimateVram,
  fingerprint,
  fnv1a64,
  normalizeRow,
  partition,
  prepareDataset,
  renderSftExample,
  suggestMapping,
  validateRows,
} from "./sft";
import {
  SAMPLE_DATASETS,
  getSampleDataset,
  HELD_OUT_CASES,
} from "./sampleDatasets";
import { createDefaultDraft } from "./catalog";

describe("detectFormat", () => {
  it("detects Alpaca with high confidence", () => {
    const ds = getSampleDataset("fichas-soporte");
    const result = detectFormat(ds.columns, ds.rows);
    expect(result).toMatchObject({
      format: "alpaca",
      confidence: "high",
      reason: "alpaca_columns",
    });
    expect(result.mapping).toEqual({
      instruction: "instruction",
      input: "input",
      output: "output",
    });
  });

  it("detects prompt/completion and Spanish synonyms (medium)", () => {
    expect(detectFormat(["prompt", "completion"], [])).toMatchObject({
      format: "prompt_completion",
      confidence: "high",
    });
    const qa = getSampleDataset("qa-pares");
    expect(detectFormat(qa.columns, qa.rows)).toMatchObject({
      format: "prompt_completion",
      confidence: "medium",
      reason: "synonym_columns",
      mapping: { prompt: "pregunta", completion: "respuesta" },
    });
    expect(detectFormat(["entrada", "salida"], []).confidence).toBe("medium");
    // input/output without instruction is a prompt/completion synonym
    expect(detectFormat(["input", "output"], []).format).toBe(
      "prompt_completion",
    );
  });

  it("detects messages (JSON string) and ShareGPT (medium)", () => {
    const conv = getSampleDataset("conversaciones-soporte");
    expect(detectFormat(conv.columns, conv.rows)).toMatchObject({
      format: "messages",
      confidence: "high",
    });
    const sharegpt = [
      {
        conversations: [
          { from: "human", value: "hola" },
          { from: "gpt", value: "hola" },
        ],
      },
    ];
    expect(detectFormat(["conversations"], sharegpt)).toMatchObject({
      format: "messages",
      confidence: "medium",
      reason: "sharegpt_column",
    });
  });

  it("returns text_only for a plain text corpus", () => {
    const txt = getSampleDataset("solo-texto");
    expect(detectFormat(txt.columns, txt.rows)).toMatchObject({
      format: null,
      confidence: "none",
      reason: "text_only",
    });
    expect(detectFormat(["a", "b"], []).reason).toBe("no_match");
  });

  it("suggests mappings per format", () => {
    expect(suggestMapping("alpaca", ["instruccion", "salida"])).toEqual({
      instruction: "instruccion",
      output: "salida",
    });
    expect(suggestMapping("messages", ["dialogo"])).toEqual({
      messages: "dialogo",
    });
  });
});

describe("normalizeRow", () => {
  it("joins instruction and input for Alpaca and prepends the system prompt", () => {
    const res = normalizeRow(
      { instruction: "Resume", input: "Texto", output: "Resumen" },
      "alpaca",
      { instruction: "instruction", input: "input", output: "output" },
      "Eres útil.",
    );
    expect(res.ok).toBe(true);
    expect(res.messages).toEqual([
      { role: "system", content: "Eres útil." },
      { role: "user", content: "Resume\n\nTexto" },
      { role: "assistant", content: "Resumen" },
    ]);
  });

  it("reports empty values, invalid JSON, unsupported roles and missing assistant", () => {
    const map = { instruction: "instruction", output: "output" };
    expect(
      normalizeRow({ instruction: "x", output: "  " }, "alpaca", map).error,
    ).toEqual({
      code: "empty_value",
      column: "output",
    });
    expect(normalizeRow({ instruction: "x" }, "alpaca", map).error.code).toBe(
      "missing_column",
    );
    const mm = { messages: "messages" };
    expect(
      normalizeRow({ messages: "{not json" }, "messages", mm).error.code,
    ).toBe("invalid_json");
    expect(
      normalizeRow(
        { messages: JSON.stringify([{ role: "tool", content: "x" }]) },
        "messages",
        mm,
      ).error.code,
    ).toBe("unsupported_role");
    expect(
      normalizeRow(
        { messages: [{ role: "user", content: "hola" }] },
        "messages",
        mm,
      ).error.code,
    ).toBe("no_assistant");
  });
});

describe("validateRows", () => {
  it("passes the reference dataset", () => {
    const ds = getSampleDataset("fichas-soporte");
    const res = validateRows(
      ds.rows,
      "alpaca",
      { instruction: "instruction", input: "input", output: "output" },
      {
        maxLength: 512,
      },
    );
    expect(res).toMatchObject({
      valid: true,
      total: 48,
      validCount: 48,
      blocking: false,
    });
    expect(res.issues).toEqual([]);
  });

  it("counts blocking empty outputs and the too_long warning with example rows", () => {
    const ds = getSampleDataset("instrucciones-con-errores");
    const res = validateRows(
      ds.rows,
      "alpaca",
      { instruction: "instruction", input: "input", output: "output" },
      {
        maxLength: 512,
      },
    );
    expect(res.blocking).toBe(true);
    const empty = res.issues.find((i) => i.code === "empty_value");
    expect(empty).toMatchObject({ count: 3, column: "output", blocking: true });
    expect(empty.rows).toEqual([4, 11, 18]);
    expect(empty.rowNumbers).toEqual([5, 12, 19]);
    const tooLong = res.issues.find((i) => i.code === "too_long");
    expect(tooLong).toMatchObject({ count: 1, blocking: false });
    expect(res.validCount).toBe(21);
  });

  it("flags truncation that removes every supervised token", () => {
    const rows = [{ prompt: "x".repeat(2000), completion: "respuesta" }];
    const res = validateRows(
      rows,
      "prompt_completion",
      { prompt: "prompt", completion: "completion" },
      {
        maxLength: 128,
      },
    );
    expect(res.issues[0]).toMatchObject({
      code: "truncation_kills_response",
      count: 1,
      blocking: true,
    });
  });

  it("reports unmapped required fields as missing_column", () => {
    const res = validateRows([{ a: 1 }], "alpaca", { instruction: "a" }, {});
    expect(res.issues[0]).toMatchObject({
      code: "missing_column",
      column: "output",
    });
    expect(res.blocking).toBe(true);
  });
});

describe("renderSftExample", () => {
  const messages = [
    { role: "system", content: "Sistema" },
    { role: "user", content: "Pregunta" },
    { role: "assistant", content: "Respuesta supervisada" },
  ];

  it("marks only assistant content as supervised", () => {
    const res = renderSftExample(messages, { maxLength: 512 });
    const supervised = res.segments.filter((s) => s.supervised);
    expect(supervised).toHaveLength(1);
    expect(supervised[0]).toMatchObject({
      role: "assistant",
      kind: "content",
      text: "Respuesta supervisada",
    });
    expect(res.segments.filter((s) => s.kind === "special")).toHaveLength(6);
    expect(res.segments[0].text).toBe("<|im_start|>system\n");
    expect(res.truncated).toBe(false);
    expect(res.supervisedTokens).toBe(
      Math.ceil("Respuesta supervisada".length / 3.6),
    );
  });

  it("splits and marks segments beyond maxLength", () => {
    const long = [
      { role: "user", content: "a".repeat(36) },
      { role: "assistant", content: "b".repeat(360) },
    ];
    const res = renderSftExample(long, { maxLength: 30 });
    expect(res.truncated).toBe(true);
    expect(res.keptTokens).toBe(30);
    expect(res.segments.some((s) => s.truncated && s.supervised)).toBe(true);
    expect(res.supervisedTokens).toBeGreaterThan(0);
    expect(res.supervisedTokens).toBeLessThan(100);
  });
});

describe("partition", () => {
  it("is reproducible and disjoint", () => {
    const a = partition(48, { evalFraction: 0.1, seed: 42, useEval: true });
    const b = partition(48, { evalFraction: 0.1, seed: 42, useEval: true });
    expect(a).toEqual(b);
    expect(a.eval).toHaveLength(5);
    expect(a.train).toHaveLength(43);
    expect(new Set([...a.train, ...a.eval]).size).toBe(48);
    expect(
      partition(48, { evalFraction: 0.1, seed: 7, useEval: true }).eval,
    ).not.toEqual(a.eval);
  });

  it("supports no evaluation and keeps at least 2 train examples", () => {
    expect(
      partition(10, { evalFraction: 0.2, seed: 1, useEval: false }).eval,
    ).toEqual([]);
    expect(
      partition(3, { evalFraction: 0.5, seed: 1, useEval: true }),
    ).toMatchObject({ ok: true });
    expect(
      partition(3, { evalFraction: 0.5, seed: 1, useEval: true }).train,
    ).toHaveLength(2);
    expect(partition(1, { evalFraction: 0.1, seed: 1, useEval: true }).ok).toBe(
      false,
    );
    expect(
      partition(20, { evalFraction: 0.01, seed: 1, useEval: true }).eval,
    ).toHaveLength(1);
  });
});

describe("fingerprint", () => {
  it("implements FNV-1a 64", () => {
    expect(fnv1a64("")).toBe("cbf29ce484222325");
    expect(fnv1a64("a")).toBe("af63dc4c8601ec8c");
    expect(fnv1a64("foobar")).toBe("85944171f73967e8");
  });

  it("is a stable 16-hex digest sensitive to content", () => {
    const rows = [
      [
        { role: "user", content: "hola" },
        { role: "assistant", content: "chao" },
      ],
    ];
    const fp = fingerprint(rows);
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
    expect(fingerprint(rows)).toBe(fp);
    expect(
      fingerprint([
        [
          { role: "user", content: "hola" },
          { role: "assistant", content: "chau" },
        ],
      ]),
    ).not.toBe(fp);
  });
});

describe("estimateVram", () => {
  it("follows the orientative formula", () => {
    // 0.49 × 0.62 + 0.49 × 0.02 + 2 × 1 × (0.35 + 0.1225) + 0.6 = 1.86
    expect(
      estimateVram({
        parametersB: 0.49,
        method: "qlora",
        batchSize: 2,
        maxLength: 512,
        loraR: 16,
      }),
    ).toBe(1.9);
  });

  it("makes Phi-3.5 exceed 8 GB with LoRA but fit with QLoRA batch 1", () => {
    const lora = estimateVram({
      parametersB: 3.82,
      method: "lora",
      batchSize: 2,
      maxLength: 512,
      loraR: 16,
    });
    const qlora = estimateVram({
      parametersB: 3.82,
      method: "qlora",
      batchSize: 1,
      maxLength: 1024,
      loraR: 16,
    });
    expect(lora).toBeGreaterThan(8);
    expect(qlora).toBeLessThan(8);
  });

  it("grows without gradient checkpointing", () => {
    const args = {
      parametersB: 1.54,
      method: "qlora",
      batchSize: 2,
      maxLength: 512,
      loraR: 16,
    };
    expect(
      estimateVram({ ...args, gradientCheckpointing: false }),
    ).toBeGreaterThan(estimateVram(args));
  });
});

describe("sample data", () => {
  it("ships 5 datasets and 12 held-out cases not in the training set", () => {
    expect(SAMPLE_DATASETS).toHaveLength(5);
    const fichas = getSampleDataset("fichas-soporte");
    expect(fichas.rows).toHaveLength(48);
    const inputs = new Set(fichas.rows.map((r) => r.input));
    expect(HELD_OUT_CASES).toHaveLength(12);
    HELD_OUT_CASES.forEach((c) => expect(inputs.has(c.input)).toBe(false));
    const categories = fichas.rows.map((r) => JSON.parse(r.output).categoria);
    ["datos", "entrenamiento", "inferencia"].forEach((c) =>
      expect(categories.filter((x) => x === c)).toHaveLength(16),
    );
  });

  it("prepares a dataset without keeping full rows", () => {
    const ds = getSampleDataset("fichas-soporte");
    const draft = createDefaultDraft({
      format: "alpaca",
      mapping: { instruction: "instruction", input: "input", output: "output" },
    });
    const prepared = prepareDataset(ds.rows, draft, {
      totalRows: ds.rows.length,
    });
    expect(prepared.trainCount + prepared.evalCount).toBe(48);
    expect(prepared.preparedPreview).toHaveLength(3);
    expect(prepared.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(prepared.sampled).toBe(false);
    expect(prepared.evalIndices).toHaveLength(prepared.evalCount);
  });
});
