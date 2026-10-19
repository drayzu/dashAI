import { useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import ModelTrainingIcon from "@mui/icons-material/ModelTraining";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";
import SideBar from "../../../components/threeSectionLayout/panelContainers/SideBar";
import GroupedCollapsibleList from "../../../components/threeSectionLayout/GroupedCollapsibleList";
import NewItemButton from "../../../components/threeSectionLayout/NewItemButton";
import GenerativeHubHeader from "../../../components/generative/GenerativeHubHeader";
import RunStatusDot from "../../../components/shared/RunStatusDot";
import {
  useFineTuningActions,
  useFineTuningRoutes,
  useFineTuningStore,
} from "../../../components/fineTuning/FineTuningContext";
import { isActiveStatus } from "../../../components/fineTuning/data/selectors";
import { statusLabel } from "../../../components/fineTuning/data/labels";
import Hideable from "../../../components/fineTuning/viewEditing/Hideable";

const NS = "fineTuning:shellA.leftBar";

/** Flat per-session summary (stable under shallow equality per item). */
function selectSessionItems(state) {
  if (!state) return [];
  return [...state.sessions]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .map((session) => {
      const runs = state.runs.filter(
        (r) => r.sessionId === session.id && r.status !== 0,
      );
      const last = runs.reduce(
        (acc, r) => (!acc || r.number > acc.number ? r : acc),
        null,
      );
      return `${session.id}\u0000${session.name}\u0000${runs.length}\u0000${
        last ? last.status : ""
      }\u0000${runs.some((r) => isActiveStatus(r.status)) ? 1 : 0}`;
    });
}

function parseItem(key) {
  const [id, name, count, lastStatus, active] = key.split("\u0000");
  return {
    id,
    name,
    runCount: Number(count) || 0,
    lastStatus: lastStatus === "" ? null : Number(lastStatus),
    active: active === "1",
  };
}

function selectCounts(state) {
  return {
    adapters: state ? state.adapters.length : 0,
    chats: state ? state.chats.length : 0,
  };
}

/**
 * Left panel of prototype A: way back to the Generative hub, "Nueva sesión",
 * the fine-tuning session list (rename / delete through the item menu) and
 * the module navigation (adapters, chat, comparison).
 *
 * @param {object} props
 * @param {string|null} props.selectedSessionId
 * @param {"adapters"|"chat"|"compare"|null} [props.activeSection]
 */
export default function FineTuningLeftBar({
  selectedSessionId = null,
  activeSection = null,
}) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const navigate = useNavigate();
  const store = useFineTuningActions();
  const routes = useFineTuningRoutes();
  const { enqueueSnackbar } = useSnackbar();

  const itemKeys = useFineTuningStore(selectSessionItems);
  const counts = useFineTuningStore(selectCounts);
  const items = useMemo(() => itemKeys.map(parseItem), [itemKeys]);
  const namesKey = useMemo(() => items.map((i) => i.name).join("|"), [items]);
  const groups = useMemo(
    () => ({ [t(`${NS}.sessionsGroup`)]: items }),
    [items, t],
  );

  const handleNewSession = useCallback(() => {
    const id = store.createSession();
    const session = store.getState().sessions.find((s) => s.id === id);
    enqueueSnackbar(t(`${NS}.created`, { name: session ? session.name : "" }), {
      variant: "success",
    });
    navigate(routes.configure(id, "model"));
  }, [store, navigate, routes, enqueueSnackbar, t]);

  const handleDelete = useCallback(
    (id) => {
      const session = store.getState().sessions.find((s) => s.id === id);
      const code = store.deleteSession(id);
      if (code) {
        enqueueSnackbar(
          t(
            `${NS}.deleteErrors.${
              code === "session_has_active_run" ? "active" : "generic"
            }`,
          ),
          {
            variant: "error",
          },
        );
        return;
      }
      enqueueSnackbar(
        t(`${NS}.deleted`, { name: session ? session.name : "" }),
        { variant: "success" },
      );
      if (id === selectedSessionId) navigate(routes.home());
    },
    [store, enqueueSnackbar, t, selectedSessionId, navigate, routes],
  );

  const handleRename = useCallback(
    (id, name) => {
      const code = store.renameSession(id, name);
      if (code) {
        enqueueSnackbar(t(`${NS}.renameEmpty`), { variant: "error" });
        throw new Error(code);
      }
    },
    [store, enqueueSnackbar, t],
  );

  const getDescription = useCallback(
    (item) => {
      const runsText = t(`${NS}.runCount`, { count: item.runCount });
      if (item.lastStatus === null) return runsText;
      return (
        <Box
          component="span"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            minWidth: 0,
          }}
        >
          <RunStatusDot status={item.lastStatus} size={6} />
          <span>{`${runsText} · ${statusLabel(item.lastStatus, t)}`}</span>
        </Box>
      );
    },
    [t],
  );

  const allNavItems = [
    {
      key: "adapters",
      level: "intermediate",
      icon: ExtensionOutlinedIcon,
      label: t(`${NS}.adapters`, { count: counts.adapters }),
      to: routes.adapters(),
    },
    {
      key: "chat",
      level: "essential",
      icon: ForumOutlinedIcon,
      label: t(`${NS}.chat`),
      to: routes.chat(),
    },
    {
      key: "compare",
      level: "intermediate",
      icon: CompareArrowsIcon,
      label: t(`${NS}.compare`),
      to: `${routes.home()}/compare`,
    },
  ];
  // Prototype E chats from "Crear nueva sesión" instead.
  const navItems = routes.externalChat
    ? allNavItems.filter((item) => item.key !== "chat")
    : allNavItems;

  return (
    <SideBar>
      <Box
        sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <GenerativeHubHeader
          showHubButton
          onHubClick={() => navigate("/app/generative")}
        />
        <Box sx={{ px: 4, pb: 2, height: 40, flexShrink: 0 }}>
          <NewItemButton
            onClick={handleNewSession}
            title={t(`${NS}.newSession`)}
          />
        </Box>
        <Divider sx={{ width: "90%", bgcolor: "divider", mx: "auto" }} />
        <GroupedCollapsibleList
          // ItemBox keeps the name in local state: remount on renames done elsewhere.
          key={namesKey}
          groups={groups}
          selectedItemId={selectedSessionId}
          onItemClick={(id) => navigate(routes.session(id))}
          onItemDelete={handleDelete}
          onItemEdit={handleRename}
          title={t(`${NS}.title`)}
          Icon={ModelTrainingIcon}
          getItemDescription={getDescription}
          getDeleteConfirmationContent={(item) =>
            t(`${NS}.deleteConfirm`, { name: item.name })
          }
          getDeleteConfirmationWarning={(item) =>
            item.active
              ? t(`${NS}.deleteActiveWarning`)
              : t(`${NS}.deleteWarning`)
          }
        />
      </Box>
      <Box sx={{ flexShrink: 0 }}>
        <Divider sx={{ width: "90%", bgcolor: "divider", mx: "auto" }} />
        <List dense sx={{ px: 2, py: 2 }} aria-label={t(`${NS}.navLabel`)}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = activeSection === item.key;
            return (
              <Hideable
                key={item.key}
                id={`a.leftBar.nav.${item.key}`}
                label={t(
                  `fineTuning:viewEditing.sections.aLeftBarNav.${item.key}`,
                )}
                level={item.level}
              >
                <ListItemButton
                  selected={selected}
                  onClick={() => navigate(item.to)}
                  sx={{ borderRadius: 1 }}
                  aria-current={selected ? "page" : undefined}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Icon
                      fontSize="small"
                      color={selected ? "primary" : "inherit"}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    slotProps={{ primary: { variant: "body2" } }}
                  />
                </ListItemButton>
              </Hideable>
            );
          })}
        </List>
      </Box>
    </SideBar>
  );
}

FineTuningLeftBar.propTypes = {
  selectedSessionId: PropTypes.string,
  activeSection: PropTypes.oneOf(["adapters", "chat", "compare", null]),
};
