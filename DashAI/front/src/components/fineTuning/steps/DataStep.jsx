import { useCallback } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import {
  useFineTuningActions,
  useFineTuningRoutes,
} from "../FineTuningContext";
import { useDataPreparation } from "../dataPrep/useDataPreparation";
import DataPreparationForm from "../dataPrep/DataPreparationForm";

/**
 * Step "Datos" of prototype A's configuration (SPEC §4): dataset choice,
 * format/mapping confirmation, validation, splits and an inline SFT preview
 * that shows which parts count toward the loss. Writes to the session draft.
 *
 * @param {object} props
 * @param {object} props.session Session from the store
 */
export default function DataStep({ session }) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const store = useFineTuningActions();
  const routes = useFineTuningRoutes();
  const navigate = useNavigate();
  const sessionId = session ? session.id : null;

  const onChange = useCallback(
    (patch) => {
      if (sessionId) store.updateDraft(sessionId, patch);
    },
    [store, sessionId],
  );
  const onSelectDataset = useCallback(
    (ref, columns, rows) => {
      if (!sessionId) return;
      if (ref) store.selectDataset(sessionId, ref, columns, rows);
      else store.selectDataset(sessionId, null);
    },
    [store, sessionId],
  );

  const prep = useDataPreparation({
    dataPrep: session ? session.draft : null,
    onChange,
    onSelectDataset,
    fallbackRows: session ? session.datasetRows : null,
  });

  const onUpload = useCallback(() => {
    if (sessionId && routes && routes.uploadDataset)
      navigate(routes.uploadDataset(sessionId));
  }, [navigate, routes, sessionId]);

  if (!session) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <Typography variant="body2" color="text.secondary">
          {t("fineTuning:dataStep.noSession")}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Box>
        <Typography variant="h5" component="h2">
          {t("fineTuning:dataStep.title")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("fineTuning:dataStep.subtitle")}
        </Typography>
      </Box>
      <DataPreparationForm
        prep={prep}
        onChange={onChange}
        onUpload={onUpload}
      />
    </Box>
  );
}

DataStep.propTypes = {
  session: PropTypes.object,
};
