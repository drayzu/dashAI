import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Box, Link, Typography } from "@mui/material";
import {
  Link as RouterLink,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import ModuleContainer from "../../../components/layout/ModuleContainer";
import LeftPanel from "../../../components/threeSectionLayout/panels/LeftPanel";
import CenterPanel from "../../../components/threeSectionLayout/panels/CenterPanel";
import RightPanel from "../../../components/threeSectionLayout/panels/RightPanel";
import { ThreePanelLayoutContext } from "../../../components/threeSectionLayout/panels/ThreePanelLayoutContext";
import { useThreePanelLayout } from "../../../hooks/useThreePanelsLayout";
import {
  FineTuningProvider,
  buildRoutesB,
  useFineTuningStore,
} from "../../../components/fineTuning/FineTuningContext";
import PrototypeBHeader from "../../../components/fineTuning/integration/PrototypeBHeader";
import {
  ADAPTERS_B_BASE,
  FINE_TUNING_B_BASE,
} from "../../../components/fineTuning/integration/entryPoints";
import AdaptersRegistry from "../../../components/fineTuning/adapters/AdaptersRegistry";
import AdapterProvenanceDialog from "../../../components/fineTuning/adapters/AdapterProvenanceDialog";
import AdapterChat from "../../../components/fineTuning/inference/AdapterChat";
import ComparePanel from "../../../components/fineTuning/inference/ComparePanel";
import GenerationParamsPanel from "../../../components/fineTuning/inference/GenerationParamsPanel";
import { chatById } from "../../../components/fineTuning/data/selectors";
import AdaptersLeftBarB from "./AdaptersLeftBarB";
import AdapterSummaryPanel from "./AdapterSummaryPanel";

const ROUTE = new RegExp(
  `^${ADAPTERS_B_BASE}(?:/(chat|compare)(?:/([^/]+))?)?/?$`,
);

function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch (e) {
    return value;
  }
}

/**
 * Parses a "Modelos adaptados" pathname.
 * @returns {{view: "registry"|"chat"|"compare", chatId: string|null, adapterId: string|null}}
 */
export function parseAdaptersRoute(pathname) {
  const match = ROUTE.exec(pathname || "");
  if (!match || !match[1])
    return { view: "registry", chatId: null, adapterId: null };
  if (match[1] === "chat")
    return {
      view: "chat",
      chatId: match[2] ? decode(match[2]) : null,
      adapterId: null,
    };
  if (!match[2]) return { view: "registry", chatId: null, adapterId: null };
  return { view: "compare", chatId: null, adapterId: decode(match[2]) };
}

/** One line explaining where adapters come from (Models › Ajuste fino de LLM). */
function TrainedInModelsNote() {
  const { t } = useTranslation(["fineTuning"]);
  return (
    <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
      {t("fineTuning:shellB.adapters.trainedIn")}{" "}
      <Link component={RouterLink} to={FINE_TUNING_B_BASE} underline="hover">
        {t("fineTuning:shellB.adapters.trainedInLink")}
      </Link>
    </Typography>
  );
}

function AdaptersViews() {
  const { t } = useTranslation(["fineTuning", "common"]);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const route = parseAdaptersRoute(location.pathname);
  const [selectedId, setSelectedId] = useState(null);
  const [provenanceId, setProvenanceId] = useState(null);
  const chat = useFineTuningStore((s) =>
    route.chatId ? chatById(s, route.chatId) : null,
  );

  // `?adapter=<id>` (routes.adapter, e.g. "Procedencia" from a run in
  // Models): select it and open its full provenance once.
  const adapterParam = searchParams.get("adapter");
  useEffect(() => {
    if (!adapterParam) return;
    setSelectedId(adapterParam);
    setProvenanceId(adapterParam);
    const next = new URLSearchParams(searchParams);
    next.delete("adapter");
    setSearchParams(next, { replace: true });
  }, [adapterParam, searchParams, setSearchParams]);

  const comparisonId = searchParams.get("comparison");
  const summaryAdapterId =
    route.view === "compare"
      ? route.adapterId
      : route.view === "chat" &&
          chat &&
          chat.modelRef &&
          chat.modelRef.kind === "adapter"
        ? chat.modelRef.id
        : selectedId;

  const generativeCrumb = {
    label: t("fineTuning:shellB.crumbs.generative"),
    path: "/app/generative",
  };
  const registryCrumb = {
    label: t("fineTuning:shellB.crumbs.adapters"),
    path: ADAPTERS_B_BASE,
  };
  let crumbs = [generativeCrumb, { ...registryCrumb, path: null }];
  if (route.view === "chat") {
    crumbs = [
      generativeCrumb,
      registryCrumb,
      { label: t("fineTuning:shellB.crumbs.chat"), path: null },
    ];
  } else if (route.view === "compare") {
    crumbs = [
      generativeCrumb,
      registryCrumb,
      { label: t("fineTuning:shellB.crumbs.compare"), path: null },
    ];
  }

  return (
    <>
      <LeftPanel>
        <AdaptersLeftBarB
          view={route.view}
          selectedAdapterId={
            route.view === "registry" ? selectedId : summaryAdapterId
          }
          chatId={route.chatId}
        />
      </LeftPanel>
      <CenterPanel>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minHeight: 0,
          }}
        >
          <Box sx={{ px: 4, pt: 4, flexShrink: 0 }}>
            <PrototypeBHeader crumbs={crumbs} />
          </Box>
          {route.view === "registry" && (
            <Box
              sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 4, pb: 4 }}
            >
              <TrainedInModelsNote />
              <AdaptersRegistry
                onSelect={setSelectedId}
                selectedId={selectedId}
              />
            </Box>
          )}
          {route.view === "chat" && (
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <AdapterChat chatId={route.chatId || undefined} />
            </Box>
          )}
          {route.view === "compare" && (
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <ComparePanel
                adapterId={route.adapterId}
                comparisonId={comparisonId || undefined}
              />
            </Box>
          )}
        </Box>
      </CenterPanel>
      <RightPanel toggleButtonTop="50%">
        {route.view === "chat" && chat ? (
          <GenerationParamsPanel chatId={chat.id} />
        ) : (
          <AdapterSummaryPanel adapterId={summaryAdapterId} />
        )}
      </RightPanel>
      <AdapterProvenanceDialog
        adapterId={provenanceId}
        open={Boolean(provenanceId)}
        onClose={() => setProvenanceId(null)}
      />
    </>
  );
}

/**
 * Prototype B, Generative side (`/app/generative/adapters/*`): "Modelos
 * adaptados" trained in Models › Ajuste fino de LLM, with the registry, chat
 * with base/adapted models and the base-vs-adapted comparison. Shares
 * prototype B's store with the Models side.
 *
 * @param {object} props
 * @param {object} [props.store] store override (tests)
 * @param {boolean} [props.hardwareMonitoring]
 */
export default function AdaptersHubB({ store, hardwareMonitoring }) {
  const threePanelLayout = useThreePanelLayout({
    storageKey: "generativeAdaptersB",
  });
  const routes = useMemo(() => buildRoutesB(), []);
  return (
    <FineTuningProvider
      store={store}
      routes={routes}
      prototype="B"
      hardwareMonitoring={hardwareMonitoring}
    >
      <ThreePanelLayoutContext.Provider value={threePanelLayout}>
        <ModuleContainer>
          <AdaptersViews />
        </ModuleContainer>
      </ThreePanelLayoutContext.Provider>
    </FineTuningProvider>
  );
}

AdaptersHubB.propTypes = {
  store: PropTypes.object,
  hardwareMonitoring: PropTypes.bool,
};
