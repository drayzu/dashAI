import { useMemo } from "react";
import PropTypes from "prop-types";
import { Box, Button } from "@mui/material";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ModuleContainer from "../../../components/layout/ModuleContainer";
import LeftPanel from "../../../components/threeSectionLayout/panels/LeftPanel";
import CenterPanel from "../../../components/threeSectionLayout/panels/CenterPanel";
import RightPanel from "../../../components/threeSectionLayout/panels/RightPanel";
import { ThreePanelLayoutContext } from "../../../components/threeSectionLayout/panels/ThreePanelLayoutContext";
import { useThreePanelLayout } from "../../../hooks/useThreePanelsLayout";
import {
  FineTuningProvider,
  buildRoutesA,
  useFineTuningRoutes,
  useFineTuningStore,
} from "../../../components/fineTuning/FineTuningContext";
import { getPrototypeStore } from "../../../components/fineTuning/data/instances";
import { sessionById } from "../../../components/fineTuning/data/selectors";
import EmptyState from "../../../components/fineTuning/common/EmptyState";
import ViewEditingLayer from "../../../components/fineTuning/viewEditing/ViewEditingLayer";
import FineTuningLeftBar from "./FineTuningLeftBar";
import FineTuningBreadcrumbs from "./FineTuningBreadcrumbs";
import FineTuningHome from "./FineTuningHome";
import SessionWorkspace from "./SessionWorkspace";
import FineTuningRightPanel from "./FineTuningRightPanel";
import { AdaptersView, ChatView, CompareView } from "./FineTuningModuleViews";
import useFineTuningRouteA, { FINE_TUNING_BASE_A } from "./useFineTuningRouteA";
import useDatasetReturn from "./useDatasetReturn";

const SESSION_VIEWS = new Set(["session", "configure", "run", "history"]);

function NotFoundView() {
  const { t } = useTranslation(["fineTuning", "common"]);
  const navigate = useNavigate();
  const routes = useFineTuningRoutes();
  return (
    <EmptyState
      icon={SearchOffIcon}
      size="page"
      title={t("fineTuning:shellA.notFound.title")}
      description={t("fineTuning:shellA.notFound.description")}
      action={
        <Button
          variant="outlined"
          size="small"
          onClick={() => navigate(routes.home(), { replace: true })}
        >
          {t("fineTuning:shellA.session.backHome")}
        </Button>
      }
      minHeight="50vh"
    />
  );
}

function CenterContent({ route }) {
  switch (route.view) {
    case "home":
      return (
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 1, pb: 4 }}>
          <FineTuningHome />
        </Box>
      );
    case "session":
    case "configure":
    case "run":
    case "history":
      return <SessionWorkspace route={route} />;
    case "adapters":
      return <AdaptersView adapterId={route.adapterId} />;
    case "chat":
      return <ChatView chatId={route.chatId} />;
    case "compare":
      return (
        <CompareView
          adapterId={route.adapterId}
          comparisonId={route.comparisonId}
        />
      );
    default:
      return <NotFoundView />;
  }
}

CenterContent.propTypes = { route: PropTypes.object.isRequired };

/** Layout of prototype A (inside the provider). */
function FineTuningShellA() {
  const threePanelLayout = useThreePanelLayout({ storageKey: "fineTuningA" });
  const route = useFineTuningRouteA();
  useDatasetReturn(route);
  const sessionExists = useFineTuningStore((s) =>
    route.sessionId ? Boolean(sessionById(s, route.sessionId)) : false,
  );

  const selectedSessionId =
    SESSION_VIEWS.has(route.view) && sessionExists ? route.sessionId : null;
  const activeSection = ["adapters", "chat", "compare"].includes(route.view)
    ? route.view
    : null;

  return (
    <ThreePanelLayoutContext.Provider value={threePanelLayout}>
      <ModuleContainer>
        <LeftPanel>
          <FineTuningLeftBar
            selectedSessionId={selectedSessionId}
            activeSection={activeSection}
          />
        </LeftPanel>
        <CenterPanel>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              width: "100%",
              minHeight: 0,
              p: 4,
              boxSizing: "border-box",
            }}
          >
            <FineTuningBreadcrumbs route={route} />
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
              }}
            >
              <CenterContent route={route} />
            </Box>
          </Box>
        </CenterPanel>
        <RightPanel toggleButtonTop="50%">
          <FineTuningRightPanel route={route} sessionExists={sessionExists} />
        </RightPanel>
      </ModuleContainer>
      <ViewEditingLayer />
    </ThreePanelLayoutContext.Provider>
  );
}

/**
 * Prototype A of the fine-tuning module ("en Generative", SPEC §5), mounted
 * at `/app/generative/fine-tuning/*`. Fully simulated: data lives in the
 * prototype-A store (localStorage `dashai:ft-proto:A:v1`), never in the
 * backend.
 *
 * @param {object} props
 * @param {object} [props.store] store override (tests); defaults to the
 *   prototype-A singleton
 * @param {boolean} [props.hardwareMonitoring] forwarded to the provider
 */
export default function FineTuningPrototypeA({ store, hardwareMonitoring }) {
  const resolvedStore = useMemo(() => store || getPrototypeStore("A"), [store]);
  const routes = useMemo(() => buildRoutesA(FINE_TUNING_BASE_A), []);
  return (
    <FineTuningProvider
      store={resolvedStore}
      routes={routes}
      prototype="A"
      hardwareMonitoring={hardwareMonitoring}
    >
      <FineTuningShellA />
    </FineTuningProvider>
  );
}

FineTuningPrototypeA.propTypes = {
  store: PropTypes.object,
  hardwareMonitoring: PropTypes.bool,
};
