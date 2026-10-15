import { useCallback } from "react";
import { Box, Typography } from "@mui/material";
import ModelTrainingIcon from "@mui/icons-material/ModelTraining";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";
import OptionBox from "../../../components/threeSectionLayout/OptionBox";
import RunHistory from "../../../components/fineTuning/runs/RunHistory";
import {
  useFineTuningActions,
  useFineTuningRoutes,
  useFineTuningStore,
} from "../../../components/fineTuning/FineTuningContext";

const NS = "fineTuning:shellA.home";

/**
 * Landing of prototype A (no session selected): entry cards in the
 * OptionBox style of the Generative hub, plus the three latest runs.
 */
export default function FineTuningHome() {
  const { t } = useTranslation(["fineTuning", "common"]);
  const navigate = useNavigate();
  const store = useFineTuningActions();
  const routes = useFineTuningRoutes();
  const { enqueueSnackbar } = useSnackbar();
  const counts = useFineTuningStore((s) => ({
    adapters: s.adapters.length,
    readyAdapters: s.adapters.filter((a) => a.availability === "ready").length,
    runs: s.runs.filter((r) => r.status !== 0).length,
  }));

  const createSession = useCallback(() => {
    const id = store.createSession();
    const session = store.getState().sessions.find((s) => s.id === id);
    enqueueSnackbar(
      t("fineTuning:shellA.leftBar.created", {
        name: session ? session.name : "",
      }),
      {
        variant: "success",
      },
    );
    navigate(routes.configure(id, "model"));
  }, [store, navigate, routes, enqueueSnackbar, t]);

  const options = [
    {
      key: "new",
      Icon: ModelTrainingIcon,
      title: t(`${NS}.options.newSession.title`),
      description: t(`${NS}.options.newSession.description`),
      onClick: createSession,
    },
    {
      key: "adapters",
      Icon: ExtensionOutlinedIcon,
      title: t(`${NS}.options.adapters.title`),
      description: t(`${NS}.options.adapters.description`, {
        count: counts.adapters,
      }),
      onClick: () => navigate(routes.adapters()),
    },
    {
      key: "chat",
      Icon: ForumOutlinedIcon,
      title: t(`${NS}.options.chat.title`),
      description: t(`${NS}.options.chat.description`),
      onClick: () => navigate(routes.chat()),
    },
    {
      key: "compare",
      Icon: CompareArrowsIcon,
      title: t(`${NS}.options.compare.title`),
      description: t(`${NS}.options.compare.description`, {
        count: counts.readyAdapters,
      }),
      onClick: () => navigate(`${routes.home()}/compare`),
    },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Box>
        <Typography variant="h5" component="h2">
          {t(`${NS}.title`)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(`${NS}.subtitle`)}
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 4,
        }}
      >
        {options.map((option) => (
          <OptionBox
            key={option.key}
            optionName={option.title}
            description={option.description}
            onClick={option.onClick}
            Icon={option.Icon}
          />
        ))}
      </Box>

      <Box component="section" aria-labelledby="ft-a-recent-runs">
        <Typography id="ft-a-recent-runs" variant="h6" sx={{ mb: 1 }}>
          {t(`${NS}.recentTitle`)}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          {t(`${NS}.recentSubtitle`, { count: counts.runs })}
        </Typography>
        <RunHistory
          limit={3}
          showTable={false}
          showHeader={false}
          includeConfigs={false}
        />
      </Box>
    </Box>
  );
}
