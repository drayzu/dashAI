import { useRef } from "react";
import { Button, Typography } from "@mui/material";
import ChatOutlinedIcon from "@mui/icons-material/ChatOutlined";
import { useNavigate } from "react-router-dom";
import FineTuningSimple from "../fineTuningSimple/FineTuningSimple";
import { DATASETS } from "../fineTuningSimple/simpleData";
import { SESSIONS_D_PATH, storeD, useStoreD } from "./storeD";

/**
 * Prototype D, training side: same linear flow as C, but the module only
 * trains. The adapter is used from "Crear nueva sesión" (SessionsD).
 */
export default function FineTuningD() {
  const navigate = useNavigate();
  const { adapters } = useStoreD();
  const lastCreated = useRef(null);

  const openSession = (adapter) =>
    navigate(`${SESSIONS_D_PATH}/new?adapter=${adapter.id}`);

  return (
    <FineTuningSimple
      chipLabel="Prototipo D"
      adapters={adapters}
      onAdapterClick={openSession}
      onAdapterCreated={({ datasetId, ...adapter }) => {
        lastCreated.current = storeD.addAdapter({
          ...adapter,
          dataset: DATASETS.find((d) => d.id === datasetId)?.name,
        });
      }}
      renderResultExtra={() => (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            El adaptador ya aparece en Generativo → Crear nueva sesión, en «Mis
            modelos adaptados».
          </Typography>
          <Button
            variant="contained"
            startIcon={<ChatOutlinedIcon />}
            onClick={() =>
              lastCreated.current && openSession(lastCreated.current)
            }
          >
            Crear sesión con este adaptador
          </Button>
        </>
      )}
    />
  );
}
