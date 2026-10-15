// Dataset options for the fine-tuning data step (SPEC §3.3): real DashAI
// datasets (read-only, status 3 = finished) merged with the prototype's
// sample datasets. Works without the backend (samples only).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSharedDatasets } from "../../../contexts/DatasetsContext";
import { getDatasetSample } from "../../../api/datasets";
import { SAMPLE_DATASETS, sampleDatasetRef } from "../data/sampleDatasets";

const PROBE_TTL_MS = 30000;
const rowsCache = new Map();
let probe = { status: "idle", at: 0, promise: null };

/** Converts DashAI's column-oriented sample ({col: values[]}) to row objects. */
export function sampleToRows(sample) {
  if (!sample || typeof sample !== "object" || Array.isArray(sample)) {
    return { columns: [], rows: [] };
  }
  const columns = Object.keys(sample);
  const length = columns.reduce(
    (max, c) => Math.max(max, Array.isArray(sample[c]) ? sample[c].length : 0),
    0,
  );
  const rows = Array.from({ length }, (_, i) => {
    const row = {};
    columns.forEach((c) => {
      row[c] = Array.isArray(sample[c]) ? sample[c][i] : undefined;
    });
    return row;
  });
  return { columns, rows };
}

export function clearDatasetRowsCache() {
  rowsCache.clear();
}

function runProbe(fetchDatasets) {
  if (probe.promise) return probe.promise;
  const promise = Promise.resolve()
    .then(() => fetchDatasets())
    .then(
      () => {
        probe = { status: "ok", at: Date.now(), promise: null };
      },
      () => {
        probe = { status: "error", at: Date.now(), promise: null };
      },
    );
  probe = { ...probe, status: "loading", promise };
  return promise;
}

/**
 * @returns {{datasets: DatasetOption[], loading: boolean,
 *   backendAvailable: boolean,
 *   loadRows: (ref) => Promise<{columns, rows, totalRows, sampled}>}}
 * DatasetOption = { key, source: "dashai"|"sample", id, name, totalRows,
 *   totalColumns, columns: string[]|null, description?, i18nKey?, created?,
 *   ref: DatasetRef }
 */
export function useDatasetSource({ includeDashai = true } = {}) {
  const shared = useSharedDatasets();
  const fetchDatasets =
    shared && typeof shared.fetchDatasets === "function"
      ? shared.fetchDatasets
      : null;
  const [probeStatus, setProbeStatus] = useState(probe.status);

  useEffect(() => {
    if (!includeDashai || !fetchDatasets) return undefined;
    let cancelled = false;
    const fresh =
      (probe.status === "ok" || probe.status === "error") &&
      Date.now() - probe.at < PROBE_TTL_MS;
    if (fresh) {
      setProbeStatus(probe.status);
      return undefined;
    }
    setProbeStatus("loading");
    runProbe(fetchDatasets).then(() => {
      if (!cancelled) setProbeStatus(probe.status);
    });
    return () => {
      cancelled = true;
    };
  }, [includeDashai, fetchDatasets]);

  const realDatasets =
    shared && Array.isArray(shared.datasets) ? shared.datasets : null;

  const datasets = useMemo(() => {
    const dashai =
      includeDashai && realDatasets
        ? realDatasets
            .filter((d) => d && d.status === 3)
            .map((d) => ({
              key: `dashai:${d.id}`,
              source: "dashai",
              id: d.id,
              name: d.name,
              totalRows: d.total_rows ?? null,
              totalColumns: d.total_columns ?? null,
              columns: null,
              created: d.created,
              ref: {
                source: "dashai",
                id: d.id,
                name: d.name,
                totalRows: d.total_rows ?? 0,
                columns: [],
              },
            }))
        : [];
    const samples = SAMPLE_DATASETS.map((ds) => ({
      key: `sample:${ds.id}`,
      source: "sample",
      id: ds.id,
      name: ds.name,
      i18nKey: ds.i18nKey,
      description: ds.description,
      totalRows: ds.rows.length,
      totalColumns: ds.columns.length,
      columns: [...ds.columns],
      ref: sampleDatasetRef(ds),
    }));
    return [...dashai, ...samples];
  }, [includeDashai, realDatasets]);

  const loadRows = useCallback(
    async (ref) => {
      if (!ref) throw new Error("dataset_required");
      if (ref.source === "sample") {
        const ds = SAMPLE_DATASETS.find((d) => d.id === ref.id);
        if (!ds) throw new Error("dataset_not_found");
        return {
          columns: [...ds.columns],
          rows: ds.rows,
          totalRows: ds.rows.length,
          sampled: false,
        };
      }
      const cacheKey = `dashai:${ref.id}`;
      if (!rowsCache.has(cacheKey)) {
        const pending = getDatasetSample(Number(ref.id)).then((sample) =>
          sampleToRows(sample),
        );
        rowsCache.set(cacheKey, pending);
        pending.catch(() => rowsCache.delete(cacheKey));
      }
      const { columns, rows } = await rowsCache.get(cacheKey);
      const fromList = realDatasets
        ? realDatasets.find((d) => d.id === ref.id)
        : null;
      const totalRows =
        Number(ref.totalRows) ||
        (fromList && fromList.total_rows) ||
        rows.length;
      // DashAI only exposes a ≤10-row sample: validation in the UI is partial.
      return { columns, rows, totalRows, sampled: true };
    },
    [realDatasets],
  );

  const backendAvailable =
    probeStatus === "ok" || Boolean(realDatasets && realDatasets.length > 0);
  const loading =
    includeDashai &&
    Boolean(fetchDatasets) &&
    probeStatus === "loading" &&
    !(realDatasets && realDatasets.length > 0);

  return { datasets, loading, backendAvailable, loadRows };
}

export default useDatasetSource;
