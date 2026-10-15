// Hardware profile for VRAM estimates and frozen snapshots (SPEC §3.3).
// Uses DashAI's real hardware monitor (read-only WebSocket) when it reports a
// GPU; otherwise falls back to the simulated GTX 1080 profile.
//
// Units: the backend (/api/v1/hardware/ws, endpoints/hardware.py) sends
// `gpus[].memory_total` and `ram.total` in BYTES (pynvml / psutil), the same
// values HardwareMonitorPanel formats with bytes / 1024³. We convert to GiB
// (labelled GB in the UI) rounded to 0.1.

import { createContext, useContext, useMemo } from "react";
import { useHardwareMonitor } from "../../../hooks/useHardwareMonitor";
import { SIMULATED_HARDWARE } from "../data/catalog";

const GIB = 1024 ** 3;

export const HardwareProfileContext = createContext(null);

function toGb(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round((n / GIB) * 10) / 10;
}

/**
 * Pure conversion of a hardware-monitor payload to a profile, or null when
 * no GPU with known memory is reported.
 * @returns {{gpuName, vramGb, ramGb, accelerator: "cuda", source: "detected",
 *   vendor}|null}
 */
export function hardwareProfileFromStats(stats) {
  if (!stats || !Array.isArray(stats.gpus) || stats.gpus.length === 0)
    return null;
  const gpus = stats.gpus.filter((g) => g && toGb(g.memory_total));
  if (gpus.length === 0) return null;
  const gpu = gpus.reduce((best, g) =>
    Number(g.memory_total) > Number(best.memory_total) ? g : best,
  );
  return {
    gpuName: gpu.name || "GPU",
    vramGb: toGb(gpu.memory_total),
    ramGb: toGb(stats.ram && stats.ram.total) || SIMULATED_HARDWARE.ramGb,
    // ROCm builds of PyTorch also expose the GPU as a "cuda" device.
    accelerator: "cuda",
    source: "detected",
    vendor: gpu.vendor || null,
  };
}

function defaultMonitoring() {
  return process.env.NODE_ENV !== "test";
}

/**
 * Opens the hardware monitor and returns a stable profile object (identity
 * changes only when GPU name / VRAM / RAM change).
 * @returns {{profile: object, connected: boolean, detected: boolean}}
 */
export function useHardwareProfileSource({
  enabled = defaultMonitoring(),
} = {}) {
  const { stats, connected } = useHardwareMonitor(enabled);
  const detected = connected ? hardwareProfileFromStats(stats) : null;
  const key = detected
    ? `${detected.gpuName}|${detected.vramGb}|${detected.ramGb}|${detected.vendor}`
    : "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const profile = useMemo(() => detected || { ...SIMULATED_HARDWARE }, [key]);
  return useMemo(
    () => ({
      profile,
      connected: Boolean(connected),
      detected: profile.source === "detected",
    }),
    [profile, connected],
  );
}

/**
 * Hardware profile for components. Inside FineTuningProvider it reuses the
 * provider's single connection; outside it opens its own.
 * @returns {{profile: {gpuName, vramGb, ramGb, accelerator, source},
 *   connected: boolean, detected: boolean}}
 */
export function useHardwareProfile() {
  const fromContext = useContext(HardwareProfileContext);
  const own = useHardwareProfileSource({
    enabled: !fromContext && defaultMonitoring(),
  });
  return fromContext || own;
}

export default useHardwareProfile;
