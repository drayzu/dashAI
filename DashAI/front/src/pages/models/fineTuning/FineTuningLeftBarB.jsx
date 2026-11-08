import PropTypes from "prop-types";
import { Box, Divider, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ModelTrainingIcon from "@mui/icons-material/ModelTraining";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SideBar from "../../../components/threeSectionLayout/panelContainers/SideBar";
import NewItemButton from "../../../components/threeSectionLayout/NewItemButton";
import GroupedCollapsibleList from "../../../components/threeSectionLayout/GroupedCollapsibleList";
import Footer from "../../../components/threeSectionLayout/Footer";
import ModelsLeftBar from "../../../components/models/ModelsLeftBar";
import { useModels } from "../../../components/models/ModelsContext";
import { useFineTuningActions } from "../../../components/fineTuning/FineTuningContext";
import { useFineTuningModelsGroups } from "../../../components/fineTuning/integration/useFineTuningModelsGroups";

/**
 * Look-alike of the Models left bar used only when the app-wide
 * ModelsProvider is absent (isolated renders, tests): 64px header with the
 * "Models Hub" button and the prototype B sessions group.
 */
export function FineTuningLeftBarFallback() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation(["fineTuning", "models", "common"]);
  const store = useFineTuningActions();
  const group = useFineTuningModelsGroups({ store });
  const groups =
    group.items.length > 0 ? { [group.groupName]: group.items } : {};

  return (
    <SideBar>
      <Box p={4} sx={{ height: "64px", display: "flex", alignItems: "center" }}>
        <NewItemButton
          onClick={() => navigate("/app/models")}
          title={t("models:button.modelsHub")}
          EndIcon={ViewModuleIcon}
        />
      </Box>
      <Divider
        sx={{
          width: "90%",
          bgcolor: theme.palette.ui ? theme.palette.ui.borderDark : undefined,
          mx: "auto",
        }}
      />
      <Box display="flex" flexDirection="column" flex={1} minHeight={0}>
        {group.items.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 4 }}>
            {t("fineTuning:shellB.leftBar.empty")}
          </Typography>
        ) : (
          <GroupedCollapsibleList
            groups={groups}
            selectedItemId={group.selectedItemId}
            onItemClick={group.onItemClick}
            onItemDelete={group.onItemDelete}
            onItemEdit={group.onItemEdit}
            title={group.groupName}
            Icon={ModelTrainingIcon}
            getDeleteConfirmationContent={(item) =>
              t("fineTuning:shellB.leftBar.confirmDelete", { name: item.name })
            }
          />
        )}
      </Box>
      <Footer />
    </SideBar>
  );
}

/**
 * Left panel of prototype B on the Models side. Renders the real
 * ModelsLeftBar (real datasets/sessions keep working; the B sessions appear
 * as the extra "Ajuste fino de LLM (prototipo)" group) when the app-wide
 * Models context exists, else the look-alike fallback.
 */
export default function FineTuningLeftBarB({ onToggle }) {
  const models = useModels();
  if (models) return <ModelsLeftBar onToggle={onToggle} />;
  return <FineTuningLeftBarFallback />;
}

FineTuningLeftBarB.propTypes = {
  onToggle: PropTypes.func,
};
