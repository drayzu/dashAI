import FineTuningPrototypeA from "../fineTuning/FineTuningPrototypeA";
import { FT_E_PATH, SESSIONS_E_PATH } from "./SessionsE";

/**
 * Prototype E, training side: the full prototype-A module with its own data,
 * except that chatting with an adapter goes to "Crear nueva sesión"
 * (SessionsE) instead of a chat inside fine-tuning.
 */
export default function FineTuningE() {
  return (
    <FineTuningPrototypeA
      prototype="E"
      base={FT_E_PATH}
      chatBase={SESSIONS_E_PATH}
    />
  );
}
