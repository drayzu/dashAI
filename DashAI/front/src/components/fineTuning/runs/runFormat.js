// Small, pure formatting helpers shared by the run views (durations, relative
// times, metric numbers). Locale-aware through Intl; never hard-code units in
// components.

/** "1 h 02 min", "4 min 05 s", "12 s"; "—" for null. */
export function formatDuration(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (h > 0) return `${h} h ${pad(m)} min`;
  if (m > 0) return `${m} min ${pad(s)} s`;
  return `${s} s`;
}

/** Relative time ("hace 3 días" / "3 days ago") with Intl.RelativeTimeFormat. */
export function formatRelative(timestamp, now, language) {
  if (!timestamp) return "—";
  const diffSec = Math.round((timestamp - now) / 1000);
  const abs = Math.abs(diffSec);
  let value;
  let unit;
  if (abs < 45) {
    value = diffSec;
    unit = "second";
  } else if (abs < 45 * 60) {
    value = Math.round(diffSec / 60);
    unit = "minute";
  } else if (abs < 22 * 3600) {
    value = Math.round(diffSec / 3600);
    unit = "hour";
  } else if (abs < 26 * 86400) {
    value = Math.round(diffSec / 86400);
    unit = "day";
  } else {
    value = Math.round(diffSec / (30 * 86400));
    unit = "month";
  }
  try {
    return new Intl.RelativeTimeFormat(language || undefined, {
      numeric: "auto",
    }).format(value, unit);
  } catch (e) {
    return new Date(timestamp).toLocaleString();
  }
}

/** Short absolute date-time in the UI language. */
export function formatDateTime(timestamp, language) {
  if (!timestamp) return "—";
  try {
    return new Intl.DateTimeFormat(language || undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(timestamp));
  } catch (e) {
    return new Date(timestamp).toLocaleString();
  }
}

/** hh:mm:ss clock for log lines. */
export function formatClock(timestamp, language) {
  if (!timestamp) return "--:--:--";
  try {
    return new Intl.DateTimeFormat(language || undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(timestamp));
  } catch (e) {
    return new Date(timestamp).toTimeString().slice(0, 8);
  }
}

/** Loss-like metric with 4 decimals, or "—". */
export function formatMetric(value, digits = 4) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "—";
}

/** Learning rate in compact scientific notation (2e-4). */
export function formatLr(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return n === 0 ? "0" : "—";
  const [mantissa, exp] = n.toExponential(2).split("e");
  const m = String(Number(mantissa));
  return `${m}e${Number(exp)}`;
}

/** GB with one decimal ("6.4 GB"), or "—". */
export function formatGb(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(1)} GB`
    : "—";
}

/** First 7 chars of a revision / hash. */
export function shortHash(value, length = 7) {
  return value ? String(value).slice(0, length) : "—";
}
