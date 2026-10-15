// Data-preparation state for SFT (SPEC §4 dataPrep). Route-free and
// store-free: works on a plain `dataPrep` value (prototype A passes the
// session draft; prototype B passes its "create SFT session" form state) and
// reports changes through `onChange(patch)`.
//
// dataPrep = { dataset: DatasetRef|null, format, formatConfirmed,
//   formatDetection?, mapping, systemPrompt, splits, maxSamples,
//   parameters?: { maxLength } }
// patch    = shallow patch with complete nested objects (mapping/splits are
//   always sent whole), so it can be applied with `{...prev, ...patch}` or
//   with the store's `updateDraft` (which deep-merges).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDatasetSource } from "../hooks/useDatasetSource";
import {
  detectFormat,
  missingMappingFields,
  normalizeRow,
  partitionCounts,
  prepareDataset,
  renderSftExample,
  suggestMapping,
  validateRows,
} from "../data/sft";

export const DEFAULT_SPLITS = Object.freeze({
  evalFraction: 0.1,
  seed: 42,
  useEval: true,
});
const DEFAULT_MAX_LENGTH = 512;
const IDLE = Object.freeze({
  key: null,
  status: "idle",
  rows: [],
  columns: [],
  totalRows: 0,
  sampled: false,
  offline: false,
  error: null,
});

/** Stable key of a DatasetRef ("sample:fichas-soporte", "dashai:12"). */
export function datasetKey(ref) {
  return ref ? `${ref.source}:${ref.id}` : null;
}

/** True when the detected format is the chosen one with high confidence. */
export function isAutoConfirmed(detection, format) {
  return Boolean(
    detection &&
    format &&
    detection.confidence === "high" &&
    detection.format === format,
  );
}

/** Patch produced when a dataset is selected (used when no store is given). */
export function buildDatasetPatch(ref, columns, rows) {
  if (!ref) {
    return {
      dataset: null,
      format: null,
      formatConfirmed: false,
      formatDetection: null,
      mapping: {},
      maxSamples: null,
    };
  }
  const list = Array.isArray(rows) ? rows : [];
  const cols =
    (Array.isArray(columns) && columns.length ? columns : null) ||
    (Array.isArray(ref.columns) && ref.columns.length ? ref.columns : null) ||
    Object.keys(list[0] || {});
  const detection = detectFormat(cols, list);
  const dataset = {
    source: ref.source,
    id: ref.id,
    name: ref.name,
    totalRows: Number(ref.totalRows) || list.length,
    columns: [...cols],
  };
  if (ref.i18nKey) dataset.i18nKey = ref.i18nKey;
  return {
    dataset,
    format: detection.format,
    formatConfirmed: false,
    formatDetection: {
      format: detection.format,
      confidence: detection.confidence,
      reason: detection.reason,
    },
    mapping: detection.format ? suggestMapping(detection.format, cols) : {},
    maxSamples: null,
  };
}

/**
 * @param {object} args
 * @param {object} args.dataPrep current value (see header)
 * @param {(patch: object) => void} args.onChange
 * @param {(ref, columns, rows) => void} [args.onSelectDataset] optional
 *   override for dataset selection (prototype A: store.selectDataset, which
 *   also keeps the DashAI sample rows for reloads). Called with ref=null to
 *   clear. Defaults to onChange(buildDatasetPatch(...)).
 * @param {object[]} [args.fallbackRows] rows to use when a DashAI dataset
 *   can no longer be read (backend down), e.g. session.datasetRows
 * @param {number} [args.maxLength] overrides dataPrep.parameters.maxLength
 * @param {number} [args.previewCount=2] rendered SFT examples to return
 * @param {object} [args.source] result of useDatasetSource() (to share one)
 */
export function useDataPreparation({
  dataPrep,
  onChange,
  onSelectDataset,
  fallbackRows,
  maxLength,
  previewCount = 2,
  source: sourceProp,
} = {}) {
  const ownSource = useDatasetSource();
  const source = sourceProp || ownSource;
  const { loadRows } = source;
  const prep = dataPrep || {};
  const dataset = prep.dataset || null;
  const key = datasetKey(dataset);
  const effectiveMaxLength =
    Number(maxLength) ||
    Number(prep.parameters && prep.parameters.maxLength) ||
    DEFAULT_MAX_LENGTH;
  const splits = useMemo(
    () => ({ ...DEFAULT_SPLITS, ...(prep.splits || {}) }),
    [prep.splits],
  );

  const [loaded, setLoaded] = useState(IDLE);
  const [selecting, setSelecting] = useState(null); // { key, error? }
  const [reloadToken, setReloadToken] = useState(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSelectRef = useRef(onSelectDataset);
  onSelectRef.current = onSelectDataset;
  const fallbackRef = useRef(fallbackRows);
  fallbackRef.current = fallbackRows;
  const datasetRef = useRef(dataset);
  datasetRef.current = dataset;
  const redetectedRef = useRef(null);
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;
  const handledReloadRef = useRef(reloadToken);

  const commitDataset = useCallback((ref, columns, rows) => {
    if (onSelectRef.current) onSelectRef.current(ref, columns, rows);
    else if (onChangeRef.current)
      onChangeRef.current(buildDatasetPatch(ref, columns, rows));
  }, []);

  // Load rows of the current dataset (after a reload, or when another view
  // selected it).
  useEffect(() => {
    if (!key) {
      setLoaded(IDLE);
      return undefined;
    }
    const forced = handledReloadRef.current !== reloadToken;
    handledReloadRef.current = reloadToken;
    if (
      !forced &&
      loadedRef.current.key === key &&
      loadedRef.current.status === "ready"
    ) {
      return undefined;
    }
    let cancelled = false;
    setLoaded({ ...IDLE, key, status: "loading" });
    const ref = datasetRef.current;
    Promise.resolve()
      .then(() => loadRows(ref))
      .then((res) => {
        if (cancelled) return;
        setLoaded({
          key,
          status: "ready",
          rows: res.rows || [],
          columns:
            res.columns && res.columns.length ? res.columns : ref.columns || [],
          totalRows:
            Number(res.totalRows) ||
            Number(ref.totalRows) ||
            (res.rows || []).length,
          sampled: Boolean(res.sampled),
          offline: false,
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        const fb = fallbackRef.current;
        if (Array.isArray(fb) && fb.length > 0) {
          setLoaded({
            key,
            status: "ready",
            rows: fb,
            columns:
              ref.columns && ref.columns.length
                ? ref.columns
                : Object.keys(fb[0] || {}),
            totalRows: Number(ref.totalRows) || fb.length,
            sampled: true,
            offline: true,
            error: null,
          });
        } else {
          setLoaded({
            ...IDLE,
            key,
            status: "error",
            columns: ref.columns || [],
            totalRows: Number(ref.totalRows) || 0,
            sampled: ref.source !== "sample",
            error: (error && error.message) || "load_failed",
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // `dataset` identity changes on every draft edit; reload by key only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, loadRows, reloadToken]);

  // A dataset selected without rows (e.g. upload return with only the id):
  // re-run detection once its rows are available.
  useEffect(() => {
    if (
      !key ||
      loaded.key !== key ||
      loaded.status !== "ready" ||
      loaded.columns.length === 0
    )
      return;
    const det = prep.formatDetection;
    const needs =
      !det ||
      det.reason === "empty" ||
      !(dataset.columns && dataset.columns.length);
    if (!needs || redetectedRef.current === key) return;
    redetectedRef.current = key;
    commitDataset(
      { ...dataset, totalRows: dataset.totalRows || loaded.totalRows },
      loaded.columns,
      loaded.rows,
    );
  }, [key, loaded, prep.formatDetection, dataset, commitDataset]);

  /** Selects a dataset option (from useDatasetSource) or a DatasetRef. */
  const selectDataset = useCallback(
    async (optionOrRef) => {
      if (!optionOrRef) {
        setSelecting(null);
        commitDataset(null);
        return;
      }
      const ref = optionOrRef.ref || optionOrRef;
      const refKey = datasetKey(ref);
      setSelecting({ key: refKey, ref, error: null });
      try {
        const res = await loadRows(ref);
        const totalRows =
          Number(res.totalRows) ||
          Number(ref.totalRows) ||
          (res.rows || []).length;
        redetectedRef.current = refKey;
        setLoaded({
          key: refKey,
          status: "ready",
          rows: res.rows || [],
          columns: res.columns || [],
          totalRows,
          sampled: Boolean(res.sampled),
          offline: false,
          error: null,
        });
        commitDataset({ ...ref, totalRows }, res.columns, res.rows);
        setSelecting(null);
      } catch (error) {
        setSelecting({
          key: refKey,
          ref,
          error: (error && error.message) || "load_failed",
        });
      }
    },
    [loadRows, commitDataset],
  );

  const clearDataset = useCallback(() => {
    setSelecting(null);
    commitDataset(null);
  }, [commitDataset]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  const rows = loaded.key === key ? loaded.rows : [];
  const columns =
    (loaded.key === key && loaded.columns.length ? loaded.columns : null) ||
    (dataset && dataset.columns) ||
    [];
  const totalRows =
    (loaded.key === key && loaded.totalRows) ||
    (dataset && dataset.totalRows) ||
    0;

  const detection = useMemo(() => {
    if (!dataset) return null;
    if (prep.formatDetection && prep.formatDetection.reason !== "empty")
      return prep.formatDetection;
    if (rows.length === 0 && columns.length === 0)
      return prep.formatDetection || null;
    const det = detectFormat(columns, rows);
    return {
      format: det.format,
      confidence: det.confidence,
      reason: det.reason,
    };
  }, [dataset, prep.formatDetection, rows, columns]);

  const format = prep.format || null;
  const mapping = useMemo(() => prep.mapping || {}, [prep.mapping]);
  const systemPrompt = prep.systemPrompt || "";
  const missingFields = useMemo(
    () => (format ? missingMappingFields(format, mapping) : []),
    [format, mapping],
  );
  const autoConfirmed = isAutoConfirmed(detection, format);
  const formatConfirmed =
    Boolean(format) && (Boolean(prep.formatConfirmed) || autoConfirmed);
  const needsConfirmation = Boolean(format) && !autoConfirmed;
  const textOnly = Boolean(
    detection && detection.reason === "text_only" && !format,
  );
  const rowsReady =
    Boolean(key) && loaded.key === key && loaded.status === "ready";

  const validation = useMemo(() => {
    if (!rowsReady || !format) return null;
    return validateRows(rows, format, mapping, {
      maxLength: effectiveMaxLength,
      systemPrompt,
    });
  }, [rowsReady, rows, format, mapping, effectiveMaxLength, systemPrompt]);

  const examples = useMemo(() => {
    if (!rowsReady || !format || missingFields.length > 0) return [];
    const out = [];
    rows.forEach((row, i) => {
      const res = normalizeRow(row, format, mapping, systemPrompt);
      if (res.ok) out.push({ sourceIndex: i, messages: res.messages });
    });
    return out;
  }, [rowsReady, rows, format, mapping, systemPrompt, missingFields]);

  const renderedExamples = useMemo(
    () =>
      examples.slice(0, Math.max(0, previewCount)).map((ex) => ({
        sourceIndex: ex.sourceIndex,
        rowNumber: ex.sourceIndex + 1,
        messages: ex.messages,
        rendered: renderSftExample(ex.messages, {
          maxLength: effectiveMaxLength,
        }),
      })),
    [examples, previewCount, effectiveMaxLength],
  );

  const maxSamples =
    Number(prep.maxSamples) > 0 ? Number(prep.maxSamples) : null;
  const usedRows = maxSamples ? Math.min(totalRows, maxSamples) : totalRows;
  const splitCounts = useMemo(
    () => partitionCounts(usedRows, splits),
    [usedRows, splits],
  );

  const prepared = useMemo(() => {
    if (!rowsReady || !format || missingFields.length > 0) return null;
    return prepareDataset(
      rows,
      {
        format,
        mapping,
        systemPrompt,
        splits,
        maxSamples,
        parameters: { maxLength: effectiveMaxLength },
      },
      { totalRows, sampled: loaded.sampled },
    );
  }, [
    rowsReady,
    rows,
    format,
    mapping,
    systemPrompt,
    splits,
    maxSamples,
    effectiveMaxLength,
    totalRows,
    loaded.sampled,
    missingFields,
  ]);

  const blockingIssues = useMemo(() => {
    const codes = [];
    if (!dataset) return ["no_dataset"];
    if (rowsReady && rows.length === 0) codes.push("data_unavailable");
    if (loaded.key === key && loaded.status === "error")
      codes.push("data_unavailable");
    if (!format) codes.push(textOnly ? "format_text_only" : "format_missing");
    else {
      if (missingFields.length > 0) codes.push("mapping_incomplete");
      if (!formatConfirmed) codes.push("format_not_confirmed");
      if (validation && validation.blocking && rows.length > 0)
        codes.push("data_invalid");
    }
    if (!splitCounts.ok && totalRows > 0) codes.push("insufficient_rows");
    return [...new Set(codes)];
  }, [
    dataset,
    rowsReady,
    rows.length,
    loaded.key,
    loaded.status,
    key,
    format,
    textOnly,
    missingFields,
    formatConfirmed,
    validation,
    splitCounts.ok,
    totalRows,
  ]);

  const isSelecting = Boolean(selecting && !selecting.error);
  const datasetState = {
    status: isSelecting
      ? "loading"
      : key
        ? loaded.key === key
          ? loaded.status
          : "loading"
        : "idle",
    loading:
      isSelecting ||
      (Boolean(key) && (loaded.key !== key || loaded.status === "loading")),
    rows,
    columns,
    totalRows,
    sampled:
      loaded.key === key
        ? loaded.sampled
        : Boolean(dataset && dataset.source !== "sample"),
    offline: loaded.key === key && loaded.offline,
    error:
      (selecting && selecting.error) ||
      (loaded.key === key ? loaded.error : null),
    selectingKey: selecting ? selecting.key : null,
  };

  const ready =
    blockingIssues.length === 0 && rowsReady && !datasetState.loading;

  return {
    source,
    dataset,
    datasetState,
    detection,
    format,
    mapping,
    systemPrompt,
    splits,
    maxSamples,
    maxLength: effectiveMaxLength,
    missingFields,
    autoConfirmed,
    formatConfirmed,
    rawFormatConfirmed: Boolean(prep.formatConfirmed),
    needsConfirmation,
    textOnly,
    validation,
    examples,
    renderedExamples,
    splitCounts,
    usedRows,
    prepared,
    fingerprint: prepared ? prepared.fingerprint : null,
    // For store.startRun / createRunConfig / preflight.
    preparedData: rowsReady
      ? { rows, totalRows, sampled: loaded.sampled }
      : null,
    ready,
    blockingIssues,
    selectDataset,
    clearDataset,
    reload,
  };
}

export default useDataPreparation;
