import { useEffect } from "react";
import { fineTuningDemoStore } from "../../../api/fineTuningDemo/store";

export default function FineTuningDemoRuntime() {
  useEffect(() => {
    fineTuningDemoStore.tick();
    const timer = setInterval(() => fineTuningDemoStore.tick(), 500);
    return () => clearInterval(timer);
  }, []);
  return null;
}
