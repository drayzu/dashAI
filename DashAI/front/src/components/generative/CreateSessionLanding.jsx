import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ModelTrainingIcon from "@mui/icons-material/ModelTraining";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SelectOptionMenu from "../threeSectionLayout/SelectOptionMenu";
import { useTourContext } from "../tour/TourProvider";
import { useGenerative } from "./GenerativeContext";
import {
  ADAPTED_MODELS_OPTION_NAME,
  ADAPTERS_B_BASE,
} from "../fineTuning/integration/entryPoints";
import {
  STANDALONE_ENTRY_POINTS,
  isStandaloneTask,
  standaloneRouteFor,
} from "./standaloneEntryPoints";

const CREATE_SESSION = "new_session";

/**
 * Landing of the Generative module.
 *
 * Offers "create a session" alongside every task that owns a dedicated entry
 * point, so those tasks sit at the same level rather than hidden inside the
 * session-creation flow. The option list is built from the tasks the backend
 * reports, including their names and descriptions.
 *
 * @returns {JSX.Element} The module landing menu.
 */
export default function CreateSessionLanding() {
  const navigate = useNavigate();
  const { t } = useTranslation(["generative", "common", "fineTuning"]);
  const tourContext = useTourContext();
  const { tasks } = useGenerative();

  const options = useMemo(() => {
    const standalone = (tasks ?? [])
      .filter(isStandaloneTask)
      .filter((task) => STANDALONE_ENTRY_POINTS[task.name])
      .map((task) => ({
        name: task.name,
        display_name: task.display_name || task.name,
        description: task.description || "",
        Icon: STANDALONE_ENTRY_POINTS[task.name].Icon,
      }));

    return [
      {
        name: CREATE_SESSION,
        display_name: t("generative:label.createNewSession"),
        description: t("generative:label.createNewSessionDescription"),
        Icon: AutoAwesomeIcon,
      },
      {
        name: "fine_tuning",
        display_name: t("generative:label.fineTuningModule"),
        description: t("generative:label.fineTuningModuleDescription"),
        Icon: ModelTrainingIcon,
        chips: [t("fineTuning:shellB.prototypeChip", { prototype: "A" })],
      },
      {
        name: ADAPTED_MODELS_OPTION_NAME,
        display_name: t("fineTuning:shellB.generativeCard.title"),
        description: t("fineTuning:shellB.generativeCard.description"),
        Icon: ExtensionOutlinedIcon,
        chips: [t("fineTuning:shellB.prototypeChip", { prototype: "B" })],
      },
      ...standalone,
    ];
  }, [tasks, t]);

  /**
   * Navigate to the chosen entry point.
   * @param {string} name - The option name (a task name, or "new_session").
   */
  const handleOption = (name) => {
    if (tourContext?.run) {
      tourContext.nextStep();
    }
    if (name === "fine_tuning") {
      navigate("/app/generative/fine-tuning");
      return;
    }
    if (name === ADAPTED_MODELS_OPTION_NAME) {
      navigate(ADAPTERS_B_BASE);
      return;
    }
    navigate(standaloneRouteFor(name) ?? "/app/generative/sessions/new");
  };

  return (
    <SelectOptionMenu
      goToNextStep={handleOption}
      title={t("generative:label.generativeModule")}
      subtitle={t("generative:label.createNewSessionDescription")}
      options={options}
      searchBar={false}
      dataTour="create-session-landing"
      dataTourTarget={CREATE_SESSION}
    />
  );
}
