import { TourProvider } from "../../components/tour/TourProvider";
import { TOUR_KEYS } from "../../constants/tours";
import GenerativeContent from "./GenerativeContent";
import { fineTuningDemoEnabled } from "../../api/fineTuningDemo/config";

export default function Generative() {
  if (fineTuningDemoEnabled) return <GenerativeContent />;
  return (
    <TourProvider tourKey={TOUR_KEYS.GENERATIVE}>
      <GenerativeContent />
    </TourProvider>
  );
}
