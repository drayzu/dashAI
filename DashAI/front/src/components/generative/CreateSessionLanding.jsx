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
  prototypeVisible,
  useActivePrototype,
} from "../../utils/demoPrototype";
import {
  FT_D_PATH,
  SESSIONS_D_PATH,
} from "../../pages/generative/prototypeD/storeD";
import {
  FT_E_PATH,
  SESSIONS_E_PATH,
} from "../../pages/generative/prototypeE/SessionsE";
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
  const activePrototype = useActivePrototype();

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

    const single = activePrototype !== "all";
    const chip = (label) => (single ? [] : [label]);
    const show = (id) => prototypeVisible(activePrototype, id);
    return [
      {
        name: CREATE_SESSION,
        display_name: t("generative:label.createNewSession"),
        description: t("generative:label.createNewSessionDescription"),
        Icon: AutoAwesomeIcon,
      },
      show("A") && {
        name: "fine_tuning",
        display_name: t("generative:label.fineTuningModule"),
        description: t("generative:label.fineTuningModuleDescription"),
        Icon: ModelTrainingIcon,
        chips: chip(t("fineTuning:shellB.prototypeChip", { prototype: "A" })),
      },
      show("C") && {
        name: "fine_tuning_simple",
        display_name: single ? "Fine-tuning" : "Fine-tuning (versión simple)",
        description:
          "Flujo lineal en cinco pasos: modelo, datos, configuración, entrenamiento y resultado.",
        Icon: ModelTrainingIcon,
        chips: chip("Prototipo C"),
      },
      show("B") && {
        name: ADAPTED_MODELS_OPTION_NAME,
        display_name: t("fineTuning:shellB.generativeCard.title"),
        description: t("fineTuning:shellB.generativeCard.description"),
        Icon: ExtensionOutlinedIcon,
        chips: chip(t("fineTuning:shellB.prototypeChip", { prototype: "B" })),
      },
      show("D") && {
        name: "fine_tuning_d",
        display_name: single
          ? "Fine-tuning"
          : "Fine-tuning (solo entrenamiento)",
        description:
          "Entrena un adaptador LoRA/QLoRA. Después se usa desde «Crear nueva sesión».",
        Icon: ModelTrainingIcon,
        chips: chip("Prototipo D"),
      },
      show("E") && {
        name: "fine_tuning_e",
        display_name: single
          ? "Fine-tuning local"
          : "Fine-tuning local (completo)",
        description:
          "Entrena adaptadores LoRA/QLoRA con tus datasets. Después se usan desde «Crear nueva sesión».",
        Icon: ModelTrainingIcon,
        chips: chip("Prototipo E"),
      },
      activePrototype === "all" && {
        name: "sessions_e",
        display_name: "Crear nueva sesión (completa, con adaptados)",
        description:
          "Copia simulada de «Crear nueva sesión» con los adaptadores del prototipo E.",
        Icon: AutoAwesomeIcon,
        chips: ["Prototipo E"],
      },
      activePrototype === "all" && {
        name: "sessions_d",
        display_name: "Crear nueva sesión (con modelos adaptados)",
        description:
          "Copia simulada de «Crear nueva sesión» donde los adaptadores aparecen como modelos.",
        Icon: AutoAwesomeIcon,
        chips: ["Prototipo D"],
      },
      ...standalone,
    ].filter(Boolean);
  }, [tasks, t, activePrototype]);

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
    if (name === "fine_tuning_e") {
      navigate(FT_E_PATH);
      return;
    }
    if (
      name === "sessions_e" ||
      (name === CREATE_SESSION && activePrototype === "E")
    ) {
      navigate(`${SESSIONS_E_PATH}/new`);
      return;
    }
    if (name === "fine_tuning_d") {
      navigate(FT_D_PATH);
      return;
    }
    if (
      name === "sessions_d" ||
      (name === CREATE_SESSION && activePrototype === "D")
    ) {
      navigate(`${SESSIONS_D_PATH}/new`);
      return;
    }
    if (name === "fine_tuning_simple") {
      navigate("/app/generative/fine-tuning-simple");
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
