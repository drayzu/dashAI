import { useSyncExternalStore } from "react";
import { fineTuningDemoStore } from "../../api/fineTuningDemo/store";

export default function useFineTuningDemo() {
  return useSyncExternalStore(
    fineTuningDemoStore.subscribe,
    fineTuningDemoStore.getSnapshot,
  );
}
