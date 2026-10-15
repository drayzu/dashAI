import PropTypes from "prop-types";
import { Box, Breadcrumbs, IconButton, Link, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PrototypeBadge from "../../../components/fineTuning/common/PrototypeBadge";
import DemoControlsMenu from "../../../components/fineTuning/common/DemoControlsMenu";
import {
  useFineTuningRoutes,
  useFineTuningStore,
} from "../../../components/fineTuning/FineTuningContext";
import {
  adapterById,
  chatById,
  runById,
  sessionById,
} from "../../../components/fineTuning/data/selectors";

const NS = "fineTuning:shellA";

export const OTHER_PROTOTYPE_HREF = "/app/models/fine-tuning/new";

/** Names needed by the crumbs (flat strings: cheap shallow equality). */
function useCrumbNames(route) {
  return useFineTuningStore((s) => {
    const session = route.sessionId ? sessionById(s, route.sessionId) : null;
    const run = route.runId ? runById(s, route.runId) : null;
    const adapter = route.adapterId ? adapterById(s, route.adapterId) : null;
    const chat = route.chatId ? chatById(s, route.chatId) : null;
    return {
      session: session ? session.name : null,
      run: run ? run.name : null,
      runNumber: run ? run.number : null,
      adapter: adapter ? adapter.name : null,
      chat: chat ? chat.name : null,
      storageError: Boolean(s && s.storageError),
    };
  });
}

/**
 * Crumbs of prototype A: Generative › Fine-tuning › <session|section> › <view>.
 * @returns {{label: string, path: string|null, current?: boolean}[]}
 */
export function buildCrumbs(route, names, routes, t) {
  const root = { label: t("common:generative"), path: "/app/generative" };
  const module = { label: t(`${NS}.crumbs.module`), path: routes.home() };
  const crumbs = [root, module];
  const sid = route.sessionId;

  switch (route.view) {
    case "session":
    case "configure":
    case "run":
    case "history": {
      crumbs.push({
        label: names.session || t(`${NS}.crumbs.unknownSession`),
        path: names.session ? routes.session(sid) : null,
      });
      if (route.view === "configure") {
        crumbs.push({
          label: route.step
            ? t(`${NS}.crumbs.configureStep`, {
                step: t(`fineTuning:stepNav.steps.${route.step}`),
              })
            : t(`${NS}.tabs.configure`),
          path: null,
        });
      } else if (route.view === "run") {
        crumbs.push({
          label:
            names.run ||
            (route.runId
              ? t(`${NS}.crumbs.unknownRun`)
              : t(`${NS}.tabs.current`)),
          path: null,
        });
      } else if (route.view === "history") {
        crumbs.push({ label: t(`${NS}.tabs.history`), path: null });
      }
      break;
    }
    case "adapters":
      crumbs.push({
        label: t(`${NS}.crumbs.adapters`),
        path: route.adapterId ? routes.adapters() : null,
      });
      if (route.adapterId)
        crumbs.push({
          label: names.adapter || t(`${NS}.crumbs.unknownAdapter`),
          path: null,
        });
      break;
    case "chat":
      crumbs.push({
        label: t(`${NS}.crumbs.chat`),
        path: route.chatId ? routes.chat() : null,
      });
      if (route.chatId)
        crumbs.push({
          label: names.chat || t(`${NS}.crumbs.unknownChat`),
          path: null,
        });
      break;
    case "compare":
      crumbs.push({
        label: t(`${NS}.crumbs.compare`),
        path: route.adapterId ? `${routes.home()}/compare` : null,
      });
      if (route.adapterId)
        crumbs.push({
          label: names.adapter || t(`${NS}.crumbs.unknownAdapter`),
          path: null,
        });
      break;
    case "notFound":
      crumbs.push({ label: t(`${NS}.crumbs.notFound`), path: null });
      break;
    default:
      break;
  }
  const last = crumbs[crumbs.length - 1];
  crumbs[crumbs.length - 1] = { ...last, path: null, current: true };
  return crumbs;
}

/**
 * Center header row of prototype A: back arrow + breadcrumbs (pattern of
 * GenerativeBreadcrumbs) on the left, PrototypeBadge + DemoControlsMenu on
 * the right.
 *
 * @param {object} props
 * @param {object} props.route result of useFineTuningRouteA()
 */
export default function FineTuningBreadcrumbs({ route }) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const navigate = useNavigate();
  const routes = useFineTuningRoutes();
  const names = useCrumbNames(route);
  const crumbs = buildCrumbs(route, names, routes, t);

  const handleBack = () => {
    const parent = [...crumbs.slice(0, -1)].reverse().find((c) => c.path);
    navigate(parent ? parent.path : routes.home());
  };

  return (
    <Box
      sx={{
        mb: 4,
        minHeight: "24px",
        display: "flex",
        alignItems: "center",
        gap: 2,
        flexShrink: 0,
      }}
    >
      <IconButton
        onClick={handleBack}
        size="small"
        sx={{
          color: "text.secondary",
          "&:hover": { color: "primary.main", backgroundColor: "action.hover" },
        }}
        aria-label={t(`${NS}.crumbs.back`)}
      >
        <ArrowBackIcon fontSize="small" />
      </IconButton>
      <Breadcrumbs
        aria-label={t(`${NS}.crumbs.label`)}
        sx={{
          minHeight: "24px",
          display: "flex",
          alignItems: "center",
          flex: 1,
          minWidth: 0,
        }}
      >
        {crumbs.map((crumb, index) =>
          crumb.current || !crumb.path ? (
            <Typography
              key={`${index}-${crumb.label}`}
              color={crumb.current ? "text.primary" : "text.secondary"}
              aria-current={crumb.current ? "page" : undefined}
              noWrap
              sx={{ maxWidth: 260 }}
            >
              {crumb.label}
            </Typography>
          ) : (
            <Link
              key={`${index}-${crumb.label}`}
              underline="hover"
              color="inherit"
              href={crumb.path}
              onClick={(e) => {
                e.preventDefault();
                navigate(crumb.path);
              }}
              sx={{ cursor: "pointer" }}
            >
              {crumb.label}
            </Link>
          ),
        )}
      </Breadcrumbs>
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}
      >
        <PrototypeBadge prototype="A" storageError={names.storageError} />
        <DemoControlsMenu
          otherPrototypeHref={OTHER_PROTOTYPE_HREF}
          otherPrototypeLabel={t(`${NS}.otherPrototype`)}
        />
      </Box>
    </Box>
  );
}

FineTuningBreadcrumbs.propTypes = {
  route: PropTypes.object.isRequired,
};
