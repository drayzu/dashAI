import { useState } from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { Add, ArrowBack, ListAlt, MoreHoriz, Tune } from "@mui/icons-material";
import ModuleContainer from "../../components/layout/ModuleContainer";
import ModuleThemeWrapper from "../../components/ModuleThemeWrapper";
import LeftPanel from "../../components/threeSectionLayout/panels/LeftPanel";
import CenterPanel from "../../components/threeSectionLayout/panels/CenterPanel";
import RightPanel from "../../components/threeSectionLayout/panels/RightPanel";
import { ThreePanelLayoutContext } from "../../components/threeSectionLayout/panels/ThreePanelLayoutContext";
import { useThreePanelLayout } from "../../hooks/useThreePanelsLayout";
import useFineTuningDemo from "../../hooks/generative/useFineTuningDemo";
import {
  fineTuningDemoStore as store,
  scenarios,
} from "../../api/fineTuningDemo/store";
import { DEMO_ROUTE } from "../../api/fineTuningDemo/config";
import {
  RunSummary,
  Section,
  SessionSidebar,
} from "../../components/generative/fineTuning/DemoCommon";
import FineTuningWizard from "../../components/generative/fineTuning/FineTuningWizard";
import {
  AdaptedModels,
  RunDetail,
  RunsList,
} from "../../components/generative/fineTuning/FineTuningRuns";
import FineTuningChat, {
  ChatParameters,
} from "../../components/generative/fineTuning/FineTuningChat";

export default function FineTuningPrototype() {
  const { t } = useTranslation("fineTuningDemo");
  const state = useFineTuningDemo();
  const navigate = useNavigate();
  const location = useLocation();
  const sessionMatch = useMatch(`${DEMO_ROUTE}/sessions/:sessionId/*`);
  const runMatch = useMatch(`${DEMO_ROUTE}/runs/:runId`);
  const chatMatch = useMatch(`${DEMO_ROUTE}/chats/:chatId`);
  const configurationMatch = useMatch(
    `${DEMO_ROUTE}/sessions/:sessionId/configure/:step`,
  );
  const run = state.runs.find((r) => r.id === runMatch?.params.runId);
  const chat = state.chats.find((c) => c.id === chatMatch?.params.chatId);
  const chatRun = state.runs.find(
    (r) =>
      r.id === state.adaptedModels.find((a) => a.id === chat?.adapterId)?.runId,
  );
  const session = state.sessions.find(
    (s) =>
      s.id ===
      (sessionMatch?.params.sessionId || run?.sessionId || chatRun?.sessionId),
  );
  const isResults = location.pathname.endsWith("/results");
  const isHistory = location.pathname.endsWith("/history");
  const isHome = location.pathname.replace(/\/$/, "") === DEMO_ROUTE;
  const mobile = useMediaQuery((theme) => theme.breakpoints.down("md"));
  const layout = useThreePanelLayout({ storageKey: "fine-tuning-demo" });
  const [drawer, setDrawer] = useState(null);
  const [menu, setMenu] = useState(null);
  const [reset, setReset] = useState(false);
  const summary = (
    <Box sx={{ height: "100%", overflowY: "auto", bgcolor: "background.box" }}>
      {chat && (
        <Box sx={{ px: 5 }}>
          <ChatParameters chat={chat} />
        </Box>
      )}
      <RunSummary state={state} session={session} run={run} chat={chat} />
    </Box>
  );
  const sidebar = <SessionSidebar state={state} selectedId={session?.id} />;
  const content = (
    <Box
      sx={{
        p: { xs: 3, sm: 6 },
        maxWidth: 1050,
        mx: "auto",
        minWidth: 0,
        "& .MuiTypography-root, & .MuiButton-root": { letterSpacing: 0 },
      }}
    >
      <Stack direction="row" spacing={3} alignItems="center" sx={{ mb: 4 }}>
        {mobile && (
          <Tooltip title={t("sessions")}>
            <IconButton
              aria-label={t("sessions")}
              onClick={() => setDrawer("sessions")}
            >
              <ListAlt />
            </IconButton>
          </Tooltip>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h1" variant="h4">
            {t("title")}
          </Typography>
          {session && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 1, overflowWrap: "anywhere" }}
            >
              {session.name}
            </Typography>
          )}
          {mobile && (
            <Chip
              label={t("demo")}
              size="small"
              variant="outlined"
              color="primary"
              sx={{ mt: 2 }}
            />
          )}
        </Box>
        {!mobile && (
          <Chip
            label={t("demo")}
            size="small"
            variant="outlined"
            color="primary"
          />
        )}
        {mobile && (
          <Tooltip title={t("summary")}>
            <IconButton
              aria-label={t("summary")}
              onClick={() => setDrawer("summary")}
            >
              <Tune />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={t("scenario")}>
          <IconButton
            aria-label={t("scenario")}
            onClick={(e) => setMenu(e.currentTarget)}
          >
            <MoreHoriz />
          </IconButton>
        </Tooltip>
      </Stack>
      {state.storageError && (
        <Alert severity="warning">{t("storageError")}</Alert>
      )}
      {session && !run && !chat && (
        <Tabs
          value={isHistory ? 1 : 0}
          onChange={(_, value) =>
            navigate(
              `${DEMO_ROUTE}/sessions/${session.id}/${
                value ? "history" : "configure/model"
              }`,
            )
          }
        >
          <Tab label={t("configuration")} />
          <Tab label={t("history")} />
        </Tabs>
      )}
      {(run || chat) && (
        <Button
          startIcon={<ArrowBack />}
          size="small"
          onClick={() =>
            navigate(`${DEMO_ROUTE}/sessions/${session.id}/history`)
          }
        >
          {t("returnSession")}
        </Button>
      )}
      {isHome ? (
        <Section
          title={t("sessions")}
          action={
            <Button
              startIcon={<Add />}
              onClick={() => {
                const id = store.createSession(
                  `${t("newSession")} ${state.sessions.length + 1}`,
                );
                navigate(`${DEMO_ROUTE}/sessions/${id}/configure/model`);
              }}
            >
              {t("newSession")}
            </Button>
          }
        >
          {state.sessions.length ? (
            state.sessions.map((s) => (
              <Box
                key={s.id}
                sx={{ borderBottom: 1, borderColor: "divider", py: 4 }}
              >
                <Button
                  sx={{ textTransform: "none" }}
                  onClick={() =>
                    navigate(`${DEMO_ROUTE}/sessions/${s.id}/configure/model`)
                  }
                >
                  {s.name}
                </Button>
                <Typography
                  variant="caption"
                  component="div"
                  color="text.secondary"
                >
                  {state.datasets.find((d) => d.id === s.draft.datasetId)?.name}{" "}
                  · {state.runs.filter((r) => r.sessionId === s.id).length}{" "}
                  {t("history").toLowerCase()}
                </Typography>
              </Box>
            ))
          ) : (
            <Typography variant="body2">{t("noSessions")}</Typography>
          )}
        </Section>
      ) : isResults ? (
        <>
          <Typography variant="h6" sx={{ mt: 5 }}>
            {t("results")}
          </Typography>
          <AdaptedModels state={state} />
        </>
      ) : run ? (
        <RunDetail state={state} run={run} />
      ) : chat ? (
        <FineTuningChat state={state} chat={chat} />
      ) : session && isHistory ? (
        <RunsList state={state} sessionId={session.id} />
      ) : session && configurationMatch ? (
        <FineTuningWizard
          key={session.id}
          state={state}
          session={session}
          stepName={configurationMatch.params.step}
        />
      ) : (
        <Alert severity="warning" sx={{ mt: 5 }}>
          {t("unknown")}
        </Alert>
      )}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 6, pb: 5 }}
      >
        {t("disclosure")}
      </Typography>
    </Box>
  );
  return (
    <ModuleThemeWrapper>
      {mobile ? (
        <Box sx={{ minHeight: "calc(100dvh - 53px)" }}>
          {content}
          <Drawer
            anchor={drawer === "sessions" ? "left" : "right"}
            open={Boolean(drawer)}
            onClose={() => setDrawer(null)}
            slotProps={{ paper: { sx: { width: "min(88vw, 340px)" } } }}
          >
            <Button sx={{ m: 3 }} onClick={() => setDrawer(null)}>
              {t("close")}
            </Button>
            {drawer === "sessions" ? (
              <Box
                onClick={(e) => {
                  if (e.target.closest(".MuiListItemButton-root"))
                    setDrawer(null);
                }}
              >
                {sidebar}
              </Box>
            ) : (
              summary
            )}
          </Drawer>
        </Box>
      ) : (
        <ThreePanelLayoutContext.Provider value={layout}>
          <ModuleContainer
            sx={{
              height: "calc(100dvh - 53px)",
              position: "relative",
              minWidth: 0,
              "& > div": { minWidth: 0 },
            }}
          >
            <LeftPanel>{sidebar}</LeftPanel>
            <CenterPanel>{content}</CenterPanel>
            <RightPanel>{summary}</RightPanel>
          </ModuleContainer>
        </ThreePanelLayoutContext.Provider>
      )}
      <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
        {session &&
          !run &&
          !chat &&
          scenarios.map((scenario) => (
            <MenuItem
              key={scenario}
              selected={session.draft.scenario === scenario}
              onClick={() => {
                store.updateDraft(session.id, { scenario });
                setMenu(null);
              }}
            >
              {t(scenario)}
            </MenuItem>
          ))}
        <Divider />
        <MenuItem
          onClick={() => {
            setReset(true);
            setMenu(null);
          }}
        >
          {t("reset")}
        </MenuItem>
      </Menu>
      <Dialog open={reset} onClose={() => setReset(false)}>
        <DialogTitle>{t("resetConfirm")}</DialogTitle>
        <DialogActions>
          <Button onClick={() => setReset(false)}>{t("cancel")}</Button>
          <Button
            color="warning"
            onClick={() => {
              store.reset();
              setReset(false);
              navigate(DEMO_ROUTE);
            }}
          >
            {t("reset")}
          </Button>
        </DialogActions>
      </Dialog>
    </ModuleThemeWrapper>
  );
}
