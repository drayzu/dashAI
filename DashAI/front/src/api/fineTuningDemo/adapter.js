import { AxiosError } from "axios";
import { fineTuningDemoStore } from "./store";

const task = {
  name: "TextToTextGenerationTask",
  display_name: "Text to text",
  type: "GenerativeTask",
  description: "",
  metadata: { inputs: { str: 1 }, standalone: false },
};

// This adapter has no network fallback, including for destructive or unknown calls.
export async function fineTuningDemoAdapter(config) {
  const path = new URL(config.url, "http://demo.invalid").pathname.replace(
    /\/$/,
    "",
  );
  const method = (config.method || "get").toLowerCase();
  const state = fineTuningDemoStore.getSnapshot();
  let data;
  if (method === "get" && path === "/v1/dataset") {
    data = state.datasets.map((d) => ({
      ...d,
      status: 3,
      total_rows: d.rows.length,
      folder_id: null,
    }));
  } else if (
    method === "get" &&
    [
      "/v1/folder",
      "/v1/model-session",
      "/v1/generative-session",
      "/v1/credential",
    ].includes(path)
  ) {
    data = [];
  } else if (method === "get" && path === "/v1/component") {
    const types = config.params?.select_types || [];
    data = types.includes("GenerativeTask") ? [task] : [];
  } else if (method === "get" && path === "/v1/job/changes") {
    data = {
      jobs: fineTuningDemoStore.jobs(),
      cursor: String(Date.now()),
      server_now: new Date().toISOString(),
      queue_empty: !state.runs.some((r) =>
        ["DELIVERED", "STARTED"].includes(r.status),
      ),
      recently_completed: false,
    };
  } else if (method === "get" && path === "/v1/job/is_empty") {
    data = {
      is_empty: !state.runs.some((r) =>
        ["DELIVERED", "STARTED"].includes(r.status),
      ),
    };
  } else if (method === "get" && path === "/v1/job") {
    data = fineTuningDemoStore.jobs();
  } else if (method === "get" && /^\/v1\/job\/[^/]+\/details$/.test(path)) {
    const id = path.split("/")[3];
    data = fineTuningDemoStore.jobs().find((j) => j.id === id) || {};
    data = { ...data, job_name: data.name, last_modified: data.updated_at };
  } else if (method === "delete" && path === "/v1/job/all") {
    data = { cancelled: fineTuningDemoStore.clearJobs() };
  } else if (method === "delete" && /^\/v1\/job\/[^/]+$/.test(path)) {
    fineTuningDemoStore.removeJob(path.split("/")[3]);
    data = {};
  } else {
    const response = {
      config,
      data: { detail: "Not available in the offline prototype." },
      status: 501,
      statusText: "Demo only",
      headers: {},
    };
    throw new AxiosError(
      "Blocked by the offline demo adapter",
      "ERR_DEMO_UNSUPPORTED",
      config,
      null,
      response,
    );
  }
  return { config, data, status: 200, statusText: "OK", headers: {} };
}
