import { useSyncExternalStore } from "react";

/**
 * Prototype D (quick, unpolished): fine-tuning only trains; the resulting
 * adapters are used from a simulated copy of "Crear nueva sesión".
 * Adapters and sessions are shared through localStorage; no backend calls.
 */

const KEY = "dashai:ft-proto:D:v1";

const SEED = {
  adapters: [
    {
      id: "adp-1",
      name: "soporte-v1",
      base: "Qwen2.5-0.5B-Instruct",
      method: "QLoRA",
      dataset: "fichas_soporte.csv",
    },
    {
      id: "adp-2",
      name: "faq-prueba",
      base: "Llama-3.2-1B-Instruct",
      method: "LoRA",
      dataset: "preguntas_frecuentes.json",
    },
  ],
  sessions: [],
};

function load() {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...SEED, ...JSON.parse(raw) } : SEED;
  } catch {
    return SEED;
  }
}

let state = typeof window !== "undefined" ? load() : SEED;
const listeners = new Set();

function set(patch) {
  state = { ...state, ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export const storeD = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => state,
  addAdapter(adapter) {
    if (state.adapters.some((a) => a.name === adapter.name)) {
      return state.adapters.find((a) => a.name === adapter.name);
    }
    const created = { id: `adp-${Date.now()}`, ...adapter };
    set({ adapters: [created, ...state.adapters] });
    return created;
  },
  addSession(session) {
    const created = { id: `s-${Date.now()}`, messages: [], ...session };
    set({ sessions: [created, ...state.sessions] });
    return created;
  },
  addMessages(sessionId, messages) {
    set({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, messages: [...s.messages, ...messages] }
          : s,
      ),
    });
  },
};

export function useStoreD() {
  return useSyncExternalStore(storeD.subscribe, storeD.get);
}

export const FT_D_PATH = "/app/generative/fine-tuning-d";
export const SESSIONS_D_PATH = "/app/generative/sessions-d";
