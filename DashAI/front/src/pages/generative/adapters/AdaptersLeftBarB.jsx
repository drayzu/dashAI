import { useMemo } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Divider,
  Link,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import SideBar from "../../../components/threeSectionLayout/panelContainers/SideBar";
import NewItemButton from "../../../components/threeSectionLayout/NewItemButton";
import GroupedCollapsibleList from "../../../components/threeSectionLayout/GroupedCollapsibleList";
import GenerativeHubHeader from "../../../components/generative/GenerativeHubHeader";
import {
  useFineTuningActions,
  useFineTuningRoutes,
  useFineTuningStore,
} from "../../../components/fineTuning/FineTuningContext";
import {
  adapterAvailabilityLabel,
  methodLabel,
} from "../../../components/fineTuning/data/labels";
import { FINE_TUNING_B_BASE } from "../../../components/fineTuning/integration/entryPoints";

const selectLists = (s) => ({ adapters: s.adapters, chats: s.chats });

/**
 * Left panel of "Modelos adaptados" (prototype B, Generative side): hub
 * header, "Nuevo chat", navigation, adapters grouped by base model, chats,
 * and a pointer to where adapters are trained (Models › Ajuste fino de LLM).
 *
 * @param {object} props
 * @param {"registry"|"chat"|"compare"} props.view
 * @param {string|null} [props.selectedAdapterId]
 * @param {string|null} [props.chatId]
 */
export default function AdaptersLeftBarB({ view, selectedAdapterId, chatId }) {
  const theme = useTheme();
  const { t } = useTranslation(["fineTuning", "common"]);
  const store = useFineTuningActions();
  const routes = useFineTuningRoutes();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { adapters, chats } = useFineTuningStore(selectLists);

  const adapterGroups = useMemo(() => {
    const groups = {};
    [...adapters]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .forEach((a) => {
        const key = a.checkpointName || a.checkpointId;
        if (!groups[key]) groups[key] = [];
        groups[key].push({
          id: a.id,
          name: a.name,
          description: `${methodLabel(a.method, t)} · r ${a.loraR} · ${adapterAvailabilityLabel(a.availability, t)}`,
        });
      });
    return groups;
  }, [adapters, t]);

  const chatGroups = useMemo(() => {
    if (chats.length === 0) return {};
    const items = [...chats]
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: t("fineTuning:shellB.adapters.chatDescription", {
          count: c.messages.length,
        }),
      }));
    return { [t("fineTuning:shellB.adapters.chatsTitle")]: items };
  }, [chats, t]);

  const deleteAdapter = (id) => {
    const adapter = adapters.find((a) => a.id === id);
    const code = store.deleteAdapter(id);
    if (code) {
      enqueueSnackbar(t("fineTuning:shellB.adapters.deleteFailed"), {
        variant: "error",
      });
      return;
    }
    enqueueSnackbar(
      t("fineTuning:shellB.adapters.deleted", {
        name: adapter ? adapter.name : "",
      }),
      { variant: "success" },
    );
    if (id === selectedAdapterId) navigate(routes.adapters());
  };

  const renameAdapter = (id, name) => {
    if (store.renameAdapter(id, name)) {
      enqueueSnackbar(t("fineTuning:shellB.messages.renameEmpty"), {
        variant: "error",
      });
    }
  };

  const deleteChat = (id) => {
    store.deleteChat(id);
    enqueueSnackbar(t("fineTuning:shellB.adapters.chatDeleted"), {
      variant: "success",
    });
    if (id === chatId) navigate(routes.chat());
  };

  const renameChat = (id, name) => {
    if (store.renameChat(id, name)) {
      enqueueSnackbar(t("fineTuning:shellB.messages.renameEmpty"), {
        variant: "error",
      });
    }
  };

  return (
    <SideBar>
      <GenerativeHubHeader
        showHubButton
        onHubClick={() => navigate("/app/generative")}
      />
      <Divider
        sx={{
          width: "90%",
          bgcolor: theme.palette.ui ? theme.palette.ui.borderDark : undefined,
          mx: "auto",
        }}
      />
      <Box sx={{ px: 4, pt: 4, height: 56, flexShrink: 0 }}>
        <NewItemButton
          onClick={() => navigate(routes.chat())}
          title={t("fineTuning:shellB.adapters.newChat")}
          EndIcon={AddIcon}
        />
      </Box>
      <List
        dense
        sx={{ px: 4, pt: 2, flexShrink: 0 }}
        aria-label={t("fineTuning:shellB.adapters.navAria")}
      >
        <ListItemButton
          selected={view === "registry"}
          onClick={() => navigate(routes.adapters())}
          sx={{ borderRadius: 1 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <ExtensionOutlinedIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText
            primary={t("fineTuning:shellB.adapters.navRegistry", {
              count: adapters.length,
            })}
          />
        </ListItemButton>
        <ListItemButton
          selected={view === "chat"}
          onClick={() => navigate(routes.chat(chatId || undefined))}
          sx={{ borderRadius: 1 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <ForumOutlinedIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary={t("fineTuning:shellB.adapters.navChat")} />
        </ListItemButton>
      </List>
      <Box display="flex" flexDirection="column" flex={1} minHeight={0}>
        <GroupedCollapsibleList
          groups={adapterGroups}
          selectedItemId={selectedAdapterId}
          onItemClick={(id) => navigate(routes.adapter(id))}
          onItemDelete={deleteAdapter}
          onItemEdit={renameAdapter}
          title={t("fineTuning:shellB.adapters.listTitle")}
          Icon={ExtensionOutlinedIcon}
          getDeleteConfirmationContent={(item) =>
            t("fineTuning:shellB.adapters.confirmDelete", { name: item.name })
          }
        />
        {chats.length > 0 && (
          <GroupedCollapsibleList
            groups={chatGroups}
            selectedItemId={chatId}
            onItemClick={(id) => navigate(routes.chat(id))}
            onItemDelete={deleteChat}
            onItemEdit={renameChat}
            title={t("fineTuning:shellB.adapters.chatsTitle")}
            Icon={ForumOutlinedIcon}
            getDeleteConfirmationContent={(item) =>
              t("fineTuning:shellB.adapters.confirmDeleteChat", {
                name: item.name,
              })
            }
          />
        )}
      </Box>
      <Box
        sx={{
          px: 4,
          py: 3,
          borderTop: 1,
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Typography variant="caption" color="text.secondary" component="p">
          {t("fineTuning:shellB.adapters.trainedIn")}{" "}
          <Link
            component={RouterLink}
            to={FINE_TUNING_B_BASE}
            underline="hover"
          >
            {t("fineTuning:shellB.adapters.trainedInLink")}
          </Link>
        </Typography>
      </Box>
    </SideBar>
  );
}

AdaptersLeftBarB.propTypes = {
  view: PropTypes.oneOf(["registry", "chat", "compare"]).isRequired,
  selectedAdapterId: PropTypes.string,
  chatId: PropTypes.string,
};
