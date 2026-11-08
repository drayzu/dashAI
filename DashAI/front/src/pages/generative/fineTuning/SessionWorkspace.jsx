import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Button,
  IconButton,
  Tab,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";
import PillTabs from "../../../components/shared/PillTabs";
import StepperNavigationFooter from "../../../components/shared/StepperNavigationFooter";
import EmptyState from "../../../components/fineTuning/common/EmptyState";
import StepNav from "../../../components/fineTuning/steps/StepNav";
import ModelStep from "../../../components/fineTuning/steps/ModelStep";
import DataStep from "../../../components/fineTuning/steps/DataStep";
import ParametersStep from "../../../components/fineTuning/steps/ParametersStep";
import ReviewStep, {
  useStartRun,
} from "../../../components/fineTuning/steps/ReviewStep";
import useStepValidation from "../../../components/fineTuning/steps/useStepValidation";
import RunDetail from "../../../components/fineTuning/runs/RunDetail";
import RunHistory from "../../../components/fineTuning/runs/RunHistory";
import {
  useFineTuningActions,
  useFineTuningRoutes,
  useFineTuningStore,
} from "../../../components/fineTuning/FineTuningContext";
import {
  isActiveStatus,
  latestRun,
  runById,
  sessionById,
} from "../../../components/fineTuning/data/selectors";
import { blockerLabel } from "../../../components/fineTuning/data/labels";
import Hideable from "../../../components/fineTuning/viewEditing/Hideable";
import { CONFIG_STEPS } from "./useFineTuningRouteA";

const NS = "fineTuning:shellA.session";

/** Session-level facts for the header/tabs (flat values). */
function useSessionFacts(sessionId) {
  return useFineTuningStore((s) => {
    const session = sessionById(s, sessionId);
    if (!session) return { exists: false };
    const latest = latestRun(s, sessionId);
    const started = s.runs.filter(
      (r) => r.sessionId === sessionId && r.status !== 0,
    );
    const active = started.find((r) => isActiveStatus(r.status));
    return {
      exists: true,
      name: session.name,
      lastStep: CONFIG_STEPS.includes(session.lastStep)
        ? session.lastStep
        : "model",
      runCount: started.length,
      latestRunId: latest && latest.status !== 0 ? latest.id : null,
      activeRunId: active ? active.id : null,
    };
  });
}

function SessionTitle({ sessionId, name, runCount }) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const store = useFineTuningActions();
  const { enqueueSnackbar } = useSnackbar();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  useEffect(() => {
    if (!editing) setValue(name);
  }, [name, editing]);

  const save = () => {
    const code = store.renameSession(sessionId, value);
    if (code) {
      enqueueSnackbar(t("fineTuning:shellA.leftBar.renameEmpty"), {
        variant: "error",
      });
      return;
    }
    setEditing(false);
  };

  return (
    <Box sx={{ mb: 4 }}>
      {editing ? (
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          sx={{ display: "flex", alignItems: "center", gap: 2 }}
        >
          <TextField
            size="small"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
            }}
            slotProps={{
              htmlInput: {
                "aria-label": t(`${NS}.renameLabel`),
                maxLength: 80,
              },
            }}
            sx={{ minWidth: 280 }}
          />
          <Tooltip title={t("common:save")}>
            <IconButton
              type="submit"
              size="small"
              color="primary"
              aria-label={t("common:save")}
            >
              <CheckIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("common:cancel")}>
            <IconButton
              size="small"
              onClick={() => setEditing(false)}
              aria-label={t("common:cancel")}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ) : (
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}
        >
          <Typography
            variant="h5"
            component="h1"
            sx={{ fontWeight: 700 }}
            noWrap
          >
            {name}
          </Typography>
          <Tooltip title={t(`${NS}.rename`)}>
            <IconButton
              size="small"
              onClick={() => setEditing(true)}
              aria-label={t(`${NS}.rename`)}
            >
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      <Hideable
        id="a.session.runCountCaption"
        label={t("fineTuning:viewEditing.sections.aSessionRunCountCaption")}
        level="full"
      >
        <Typography variant="caption" color="text.secondary">
          {t(`${NS}.caption`, { count: runCount })}
        </Typography>
      </Hideable>
    </Box>
  );
}

SessionTitle.propTypes = {
  sessionId: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  runCount: PropTypes.number.isRequired,
};

const STEP_COMPONENTS = {
  model: ModelStep,
  data: DataStep,
  parameters: ParametersStep,
  review: ReviewStep,
};

/** "Configurar" tab: URL-driven steps + StepNav + footer. */
function ConfigureView({ sessionId, step }) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const navigate = useNavigate();
  const store = useFineTuningActions();
  const routes = useFineTuningRoutes();
  const session = useFineTuningStore((s) => sessionById(s, sessionId));
  const validation = useStepValidation(session);

  const onStart = useCallback(
    (runId) => {
      if (runId) navigate(routes.run(sessionId, runId));
    },
    [navigate, routes, sessionId],
  );
  const startRun = useStartRun(validation.session, validation, { onStart });

  useEffect(() => {
    if (step) store.setLastStep(sessionId, step);
  }, [store, sessionId, step]);

  const index = CONFIG_STEPS.indexOf(step);
  const goTo = useCallback(
    (key) => navigate(routes.configure(sessionId, key)),
    [navigate, routes, sessionId],
  );

  const StepComponent = STEP_COMPONENTS[step];
  const current = validation[step] || {};
  const isReview = step === "review";
  const stepValid = current.status === "valid";
  const nextBlocker =
    !isReview && !stepValid && current.blockers && current.blockers[0];
  const footerHint = isReview
    ? !startRun.canStart
      ? startRun.disabledReason
      : ""
    : nextBlocker
      ? blockerLabel(nextBlocker, t)
      : "";

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
    >
      <StepNav
        steps={validation.steps}
        active={step}
        onSelect={goTo}
        maxReachable={validation.maxReachable}
        sx={{ mb: 4, flexShrink: 0 }}
      />
      <Box
        sx={{ flex: 1, minHeight: 0, overflowY: "auto", pt: 2, pb: 4, pr: 1 }}
      >
        {StepComponent ? (
          <StepComponent
            session={session}
            {...(isReview ? { onStart, showStartButton: false } : {})}
          />
        ) : null}
      </Box>
      {footerHint ? (
        <Typography
          variant="caption"
          color={isReview ? "warning.main" : "text.secondary"}
          sx={{ textAlign: "right", pb: 1, flexShrink: 0 }}
          aria-live="polite"
        >
          {footerHint}
        </Typography>
      ) : null}
      <StepperNavigationFooter
        onBack={index > 0 ? () => goTo(CONFIG_STEPS[index - 1]) : undefined}
        onNext={isReview ? startRun.start : () => goTo(CONFIG_STEPS[index + 1])}
        nextDisabled={isReview ? !startRun.canStart : !stepValid}
        nextLabel={isReview ? t(`${NS}.startRun`) : t("common:next")}
      />
    </Box>
  );
}

ConfigureView.propTypes = {
  sessionId: PropTypes.string.isRequired,
  step: PropTypes.oneOf(CONFIG_STEPS).isRequired,
};

/** "Ejecución actual" tab (or any run of the session by id). */
function RunView({ sessionId, runId = null, latestRunId = null }) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const navigate = useNavigate();
  const routes = useFineTuningRoutes();
  const runSessionId = useFineTuningStore((s) => {
    const run = runId ? runById(s, runId) : null;
    return run ? run.sessionId : null;
  });

  if (!runId) {
    if (latestRunId)
      return <Navigate replace to={routes.run(sessionId, latestRunId)} />;
    return (
      <EmptyState
        title={t(`${NS}.noRunsTitle`)}
        description={t(`${NS}.noRunsDescription`)}
        action={
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate(routes.configure(sessionId, "review"))}
          >
            {t(`${NS}.goToReview`)}
          </Button>
        }
        minHeight="40vh"
      />
    );
  }
  if (runSessionId && runSessionId !== sessionId) {
    return <Navigate replace to={routes.run(runSessionId, runId)} />;
  }
  if (!runSessionId) {
    return (
      <EmptyState
        icon={SearchOffIcon}
        size="page"
        title={t(`${NS}.runNotFoundTitle`)}
        description={t(`${NS}.runNotFoundDescription`)}
        action={
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate(routes.history(sessionId))}
          >
            {t(`${NS}.goToHistory`)}
          </Button>
        }
        minHeight="40vh"
      />
    );
  }
  return (
    <Box
      sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 1, pb: 4 }}
      aria-live="polite"
    >
      <RunDetail
        runId={runId}
        variant="A"
        onDeleted={() => navigate(routes.history(sessionId))}
      />
    </Box>
  );
}

RunView.propTypes = {
  sessionId: PropTypes.string.isRequired,
  runId: PropTypes.string,
  latestRunId: PropTypes.string,
};

/**
 * Session workspace of prototype A: title (inline rename) + caption +
 * PillTabs [Configurar | Ejecución actual | Historial] and the content of
 * the current view. Unknown session ids render a not-found state.
 *
 * @param {object} props
 * @param {object} props.route result of useFineTuningRouteA()
 */
export default function SessionWorkspace({ route }) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const navigate = useNavigate();
  const routes = useFineTuningRoutes();
  const { sessionId, view } = route;
  const facts = useSessionFacts(sessionId);

  if (!facts.exists) {
    return (
      <EmptyState
        icon={SearchOffIcon}
        size="page"
        title={t(`${NS}.notFoundTitle`)}
        description={t(`${NS}.notFoundDescription`)}
        action={
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate(routes.home())}
          >
            {t(`${NS}.backHome`)}
          </Button>
        }
        minHeight="50vh"
      />
    );
  }

  if (view === "session") {
    const target = facts.activeRunId
      ? routes.run(sessionId, facts.activeRunId)
      : routes.configure(sessionId, facts.lastStep);
    return <Navigate replace to={target} />;
  }
  if (view === "configure" && !route.step) {
    return (
      <Navigate replace to={routes.configure(sessionId, facts.lastStep)} />
    );
  }

  const tab =
    view === "run" ? "current" : view === "history" ? "history" : "configure";
  const onTab = (_, value) => {
    if (value === "configure")
      navigate(routes.configure(sessionId, facts.lastStep));
    else if (value === "current" && facts.latestRunId)
      navigate(routes.run(sessionId, facts.activeRunId || facts.latestRunId));
    else if (value === "history") navigate(routes.history(sessionId));
  };

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
    >
      <SessionTitle
        sessionId={sessionId}
        name={facts.name}
        runCount={facts.runCount}
      />
      <PillTabs
        value={tab}
        onChange={onTab}
        aria-label={t(`${NS}.tabsLabel`)}
        sx={{ mb: 4, flexShrink: 0, alignSelf: "flex-start" }}
      >
        <Tab value="configure" label={t("fineTuning:shellA.tabs.configure")} />
        <Tab
          value="current"
          label={t("fineTuning:shellA.tabs.current")}
          disabled={!facts.latestRunId}
        />
        <Tab value="history" label={t("fineTuning:shellA.tabs.history")} />
      </PillTabs>

      {view === "configure" && (
        <ConfigureView
          key={sessionId}
          sessionId={sessionId}
          step={route.step}
        />
      )}
      {view === "run" && (
        <RunView
          sessionId={sessionId}
          runId={route.runId}
          latestRunId={facts.latestRunId}
        />
      )}
      {view === "history" && (
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 1, pb: 4 }}>
          <RunHistory sessionId={sessionId} hideable />
        </Box>
      )}
    </Box>
  );
}

SessionWorkspace.propTypes = {
  route: PropTypes.object.isRequired,
};
