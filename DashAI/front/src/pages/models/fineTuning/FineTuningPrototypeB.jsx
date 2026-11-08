import { useEffect, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import { Navigate, useLocation } from "react-router-dom";
import ModuleContainer from "../../../components/layout/ModuleContainer";
import LeftPanel from "../../../components/threeSectionLayout/panels/LeftPanel";
import { ThreePanelLayoutContext } from "../../../components/threeSectionLayout/panels/ThreePanelLayoutContext";
import { useThreePanelLayout } from "../../../hooks/useThreePanelsLayout";
import { useModels } from "../../../components/models/ModelsContext";
import {
  FineTuningProvider,
  buildRoutesB,
  useFineTuningStore,
} from "../../../components/fineTuning/FineTuningContext";
import {
  FINE_TUNING_B_BASE,
  FINE_TUNING_B_NEW,
} from "../../../components/fineTuning/integration/entryPoints";
import ViewEditingLayer from "../../../components/fineTuning/viewEditing/ViewEditingLayer";
import FineTuningLeftBarB from "./FineTuningLeftBarB";
import CreateSftSessionView from "./CreateSftSessionView";
import SessionViewB from "./SessionViewB";
import RunDetailViewB from "./RunDetailViewB";

const ROUTE = new RegExp(
  `^${FINE_TUNING_B_BASE}(?:/([^/]+)(?:/run/([^/]+))?)?/?$`,
);

function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch (e) {
    return value;
  }
}

/**
 * Parses a prototype B (Models side) pathname.
 * @returns {{view: "index"|"new"|"session"|"run"|"unknown", sessionId: string|null, runId: string|null}}
 */
export function parseRouteB(pathname) {
  const match = ROUTE.exec(pathname || "");
  if (!match) return { view: "unknown", sessionId: null, runId: null };
  const [, first, runId] = match;
  if (!first) return { view: "index", sessionId: null, runId: null };
  if (first === "new" && !runId)
    return { view: "new", sessionId: null, runId: null };
  const sessionId = decode(first);
  if (runId) return { view: "run", sessionId, runId: decode(runId) };
  return { view: "session", sessionId, runId: null };
}

const selectLastSessionId = (s) => {
  const sorted = [...s.sessions].sort(
    (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
  );
  return sorted.length ? sorted[0].id : null;
};

/** Index route: opens the most recently updated session, else the create form. */
function IndexRedirect() {
  const lastId = useFineTuningStore(selectLastSessionId);
  return (
    <Navigate
      replace
      to={lastId ? `${FINE_TUNING_B_BASE}/${lastId}` : FINE_TUNING_B_NEW}
    />
  );
}

function PrototypeBViews() {
  const location = useLocation();
  const route = parseRouteB(location.pathname);
  switch (route.view) {
    case "new":
      return <CreateSftSessionView />;
    case "session":
      return <SessionViewB key={route.sessionId} sessionId={route.sessionId} />;
    case "run":
      return (
        <RunDetailViewB
          key={`${route.sessionId}/${route.runId}`}
          sessionId={route.sessionId}
          runId={route.runId}
        />
      );
    default:
      return <IndexRedirect />;
  }
}

/**
 * Prototype B, Models side (`/app/models/fine-tuning/*`): LLM fine-tuning as
 * one more kind of training session in Models. Same three-panel layout and
 * panel widths as Models (`storageKey: "models"`); the left panel is the real
 * Models left bar with an extra "Ajuste fino de LLM (prototipo)" group.
 *
 * @param {object} props
 * @param {object} [props.store] store override (tests); defaults to
 *   getPrototypeStore("B")
 * @param {boolean} [props.hardwareMonitoring] passed to FineTuningProvider
 */
export default function FineTuningPrototypeB({ store, hardwareMonitoring }) {
  const threePanelLayout = useThreePanelLayout({ storageKey: "models" });
  const routes = useMemo(
    () => ({
      ...buildRoutesB(),
      // Adapters are used from Generative > "Crear nueva sesión".
      chat: (chatId) =>
        chatId
          ? `/app/generative/sessions-b/${chatId}`
          : "/app/generative/sessions-b/new",
    }),
    [],
  );
  const models = useModels();
  const modelsRef = useRef(models);
  modelsRef.current = models;

  // The real Models pages reset their selection on every route change; this
  // page does the same so the real left bar does not highlight a backend
  // session or dataset that is not being shown.
  // Only on mount (the context value changes on every Models update).
  useEffect(() => {
    const ctx = modelsRef.current;
    if (!ctx) return;
    if (typeof ctx.setSelectedSessionId === "function")
      ctx.setSelectedSessionId(null);
    if (typeof ctx.setActiveRunId === "function") ctx.setActiveRunId(null);
    if (typeof ctx.selectDataset === "function") ctx.selectDataset(null);
  }, []);

  return (
    <FineTuningProvider
      store={store}
      routes={routes}
      prototype="B"
      hardwareMonitoring={hardwareMonitoring}
    >
      <ThreePanelLayoutContext.Provider value={threePanelLayout}>
        <ModuleContainer>
          <LeftPanel>
            <FineTuningLeftBarB onToggle={threePanelLayout.handleToggleLeft} />
          </LeftPanel>
          <PrototypeBViews />
        </ModuleContainer>
        <ViewEditingLayer />
      </ThreePanelLayoutContext.Provider>
    </FineTuningProvider>
  );
}

FineTuningPrototypeB.propTypes = {
  store: PropTypes.object,
  hardwareMonitoring: PropTypes.bool,
};
