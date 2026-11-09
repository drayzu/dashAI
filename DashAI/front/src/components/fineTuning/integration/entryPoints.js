// Entry points of fine-tuning prototype B in the real DashAI modules
// (SPEC-B "Entry points"). Kept here so the edits in ModelCenterContent,
// ModelsLeftBar and CreateSessionLanding stay one-liners.

import ModelTrainingIcon from "@mui/icons-material/ModelTraining";

/** Base route of prototype B on the Models side. */
export const FINE_TUNING_B_BASE = "/app/models/fine-tuning";
/** Create-session route of prototype B. */
export const FINE_TUNING_B_NEW = `${FINE_TUNING_B_BASE}/new`;
/** "Modelos adaptados" page (prototype B, Generative side). */
export const ADAPTERS_B_BASE = "/app/generative/adapters";
/** Prototype A base route (Generative). */
export const FINE_TUNING_A_BASE = "/app/generative/fine-tuning";

/** Name of the front-only task card appended to the Models hub. */
export const FINE_TUNING_TASK_NAME = "llm_fine_tuning_prototype";
/** Name of the "Modelos adaptados" card in the Generative hub. */
export const ADAPTED_MODELS_OPTION_NAME = "adapted_models";

/** Prefix of the left-bar item ids of prototype B sessions ("ft-B-<id>"). */
export const FT_B_ITEM_PREFIX = "ft-B-";

export function toFineTuningItemId(sessionId) {
  return `${FT_B_ITEM_PREFIX}${sessionId}`;
}

/** True for left-bar ids that belong to prototype B (real ids are numbers). */
export function isFineTuningItemId(id) {
  return typeof id === "string" && id.startsWith(FT_B_ITEM_PREFIX);
}

export function fromFineTuningItemId(id) {
  return isFineTuningItemId(id) ? id.slice(FT_B_ITEM_PREFIX.length) : null;
}

/**
 * Option for the Models hub `SelectOptionMenu`, appended after the backend
 * tasks. `dataTour: undefined` keeps the Joyride target on the real tasks.
 * @param {Function} t i18n t
 */
export function buildFineTuningTaskOption(t) {
  return {
    name: FINE_TUNING_TASK_NAME,
    display_name: t("fineTuning:shellB.taskCard.title"),
    description: t("fineTuning:shellB.taskCard.description"),
    Icon: ModelTrainingIcon,
    // Supervised fine-tuning: the response column is the target.
    badge: t("models:label.supervisedBadge"),
    chips: [t("fineTuning:shellB.prototypeChip", { prototype: "B" })],
    dataTour: undefined,
  };
}
