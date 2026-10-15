// Pure helpers for the base-vs-adapted comparison (R81–R83): blind side
// assignment and CSV export.

/**
 * Sides shown as "Respuesta A" / "Respuesta B" for the item at `index`
 * (original order). `comparison.order[index]` is a 0/1 swap decided when the
 * comparison was created, so the mapping is stable across reloads.
 * @returns {["base","adapted"]|["adapted","base"]}
 */
export function blindSides(comparison, index) {
  const swap =
    comparison && Array.isArray(comparison.order)
      ? comparison.order[index] === 1
      : false;
  return swap ? ["adapted", "base"] : ["base", "adapted"];
}

/** Item indices in display order: shuffled (`rowOrder`) in blind mode. */
export function displayOrder(comparison, blind) {
  const n =
    comparison && Array.isArray(comparison.items) ? comparison.items.length : 0;
  const natural = Array.from({ length: n }, (_, i) => i);
  if (
    !blind ||
    !Array.isArray(comparison.rowOrder) ||
    comparison.rowOrder.length !== n
  )
    return natural;
  return comparison.rowOrder;
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function boolCell(value, t) {
  if (value === null || value === undefined) return "";
  return value
    ? t("fineTuning:compare.csv.yes")
    : t("fineTuning:compare.csv.no");
}

/**
 * CSV of a comparison (one row per held-out case, both sides unblinded plus
 * the blind letter each side had). Headers are translated.
 */
export function buildComparisonCsv(comparison, t) {
  if (!comparison) return "";
  const headers = [
    "case",
    "category",
    "input",
    "reference",
    "baseOutput",
    "baseJsonValid",
    "baseCategoryOk",
    "baseScore",
    "baseLatencyMs",
    "baseError",
    "adaptedOutput",
    "adaptedJsonValid",
    "adaptedCategoryOk",
    "adaptedScore",
    "adaptedLatencyMs",
    "adaptedError",
    "baseBlindLabel",
  ].map((key) => t(`fineTuning:compare.csv.${key}`));
  const lines = [headers.map(csvCell).join(",")];
  comparison.items.forEach((it, index) => {
    const sides = blindSides(comparison, index);
    const baseLetter = sides[0] === "base" ? "A" : "B";
    const auto = it.auto || {};
    const scores = it.scores || {};
    const latency = it.latency || {};
    lines.push(
      [
        it.id,
        it.reference ? it.reference.categoria : "",
        it.input,
        it.reference ? JSON.stringify(it.reference) : "",
        it.base,
        boolCell(auto.baseJsonValid, t),
        boolCell(auto.baseCategoryOk, t),
        typeof scores.base === "number" ? scores.base : "",
        typeof latency.base === "number" ? latency.base : "",
        it.baseError || "",
        it.adapted,
        boolCell(auto.adaptedJsonValid, t),
        boolCell(auto.adaptedCategoryOk, t),
        typeof scores.adapted === "number" ? scores.adapted : "",
        typeof latency.adapted === "number" ? latency.adapted : "",
        it.adaptedError || "",
        baseLetter,
      ]
        .map(csvCell)
        .join(","),
    );
  });
  return lines.join("\r\n");
}

/** Triggers a client-side download of `text` (UTF-8 with BOM for spreadsheets). */
export function downloadTextFile(
  text,
  filename,
  mime = "text/csv;charset=utf-8",
) {
  if (
    typeof window === "undefined" ||
    !window.URL ||
    typeof window.URL.createObjectURL !== "function"
  )
    return false;
  const blob = new Blob(["﻿", text], { type: mime });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => window.URL.revokeObjectURL(url), 0);
  return true;
}
