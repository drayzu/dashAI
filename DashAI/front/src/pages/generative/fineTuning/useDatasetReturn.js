import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";
import { useSharedDatasets } from "../../../contexts/DatasetsContext";
import useDatasetSource from "../../../components/fineTuning/hooks/useDatasetSource";
import { useFineTuningActions } from "../../../components/fineTuning/FineTuningContext";
import { sessionById } from "../../../components/fineTuning/data/selectors";

const NS = "fineTuning:shellA.datasetReturn";
// How long to wait for the uploaded dataset to show up in DashAI's list.
export const DATASET_RETURN_TIMEOUT_MS = 8000;

function stripDatasetParam(location) {
  const params = new URLSearchParams(location.search);
  params.delete("datasetId");
  const query = params.toString();
  return `${location.pathname}${query ? `?${query}` : ""}${location.hash || ""}`;
}

/**
 * Handles the return from DashAI's dataset upload flow
 * (`…/sessions/:id/configure/data?datasetId=<id>`): selects that real
 * dataset (read-only sample) in the session whose id is in the path, then
 * removes the param from the URL. Never writes to the backend.
 *
 * @param {object} route result of useFineTuningRouteA()
 */
export default function useDatasetReturn(route) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const location = useLocation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const store = useFineTuningActions();
  const shared = useSharedDatasets();
  const { datasets, loading, loadRows } = useDatasetSource();
  const handledRef = useRef(null);
  const refreshedRef = useRef(null);
  const startedAtRef = useRef(null);
  const mountedRef = useRef(true);
  const datasetId = route.datasetId;
  const sessionId = route.sessionId;

  const fetchDatasets =
    shared && typeof shared.fetchDatasets === "function"
      ? shared.fetchDatasets
      : null;
  const rawList =
    shared && Array.isArray(shared.datasets) ? shared.datasets : null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Ask DashAI for a fresh list once: the new dataset may not be in it yet.
  useEffect(() => {
    if (!datasetId || refreshedRef.current === datasetId) return;
    refreshedRef.current = datasetId;
    startedAtRef.current = Date.now();
    if (fetchDatasets) {
      Promise.resolve()
        .then(() => fetchDatasets())
        .catch(() => {});
    }
  }, [datasetId, fetchDatasets]);

  useEffect(() => {
    if (!datasetId) return undefined;
    const key = `${sessionId || ""}|${datasetId}|${location.pathname}`;
    if (handledRef.current === key) return undefined;

    const finish = (message, variant) => {
      handledRef.current = key;
      if (message) enqueueSnackbar(message, { variant });
      navigate(stripDatasetParam(location), { replace: true });
    };

    const session = sessionId ? sessionById(store.getState(), sessionId) : null;
    if (!session) {
      finish(t(`${NS}.noSession`), "warning");
      return undefined;
    }

    const option = datasets.find(
      (d) => d.source === "dashai" && String(d.id) === String(datasetId),
    );
    if (option) {
      handledRef.current = key;
      loadRows(option.ref)
        .then(({ columns, rows, totalRows }) => {
          if (!mountedRef.current) return;
          store.selectDataset(
            sessionId,
            {
              ...option.ref,
              totalRows: totalRows || option.ref.totalRows,
              columns,
            },
            columns,
            rows,
          );
          enqueueSnackbar(t(`${NS}.selected`, { name: option.name }), {
            variant: "success",
          });
        })
        .catch(() => {
          if (!mountedRef.current) return;
          enqueueSnackbar(t(`${NS}.loadFailed`, { name: option.name }), {
            variant: "error",
          });
        })
        .finally(() => {
          if (mountedRef.current)
            navigate(stripDatasetParam(location), { replace: true });
        });
      return undefined;
    }

    const raw = rawList
      ? rawList.find((d) => d && String(d.id) === String(datasetId))
      : null;
    if (raw && raw.status !== 3) {
      finish(
        raw.status === 4
          ? t(`${NS}.failed`, { name: raw.name })
          : t(`${NS}.processing`, { name: raw.name }),
        raw.status === 4 ? "error" : "info",
      );
      return undefined;
    }

    // Not listed yet: wait a bit for the refreshed list, then give up.
    const elapsed = Date.now() - (startedAtRef.current || Date.now());
    const remaining = Math.max(0, DATASET_RETURN_TIMEOUT_MS - elapsed);
    if (!loading && !fetchDatasets) {
      finish(t(`${NS}.notFound`), "warning");
      return undefined;
    }
    const timer = setTimeout(
      () => finish(t(`${NS}.notFound`), "warning"),
      remaining,
    );
    return () => clearTimeout(timer);
  }, [
    datasetId,
    sessionId,
    datasets,
    rawList,
    loading,
    fetchDatasets,
    loadRows,
    store,
    location,
    navigate,
    enqueueSnackbar,
    t,
  ]);
}
