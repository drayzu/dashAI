import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { useFineTuningActions } from "../../../components/fineTuning/FineTuningContext";
import {
  useDataPreparation,
  datasetKey,
} from "../../../components/fineTuning/dataPrep/useDataPreparation";
import DataPreparationForm from "../../../components/fineTuning/dataPrep/DataPreparationForm";
import { extractDataPrep } from "../../../components/fineTuning/data/store";
import { blockerLabel } from "../../../components/fineTuning/data/labels";

function DataPrepEditor({ session, onClose }) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const store = useFineTuningActions();
  const { enqueueSnackbar } = useSnackbar();
  const [dataPrep, setDataPrep] = useState(() =>
    extractDataPrep(session.draft),
  );
  const onChange = useCallback(
    (patch) => setDataPrep((prev) => ({ ...prev, ...patch })),
    [],
  );
  const prep = useDataPreparation({
    dataPrep,
    onChange,
    fallbackRows: session.datasetRows,
  });

  const save = () => {
    if (!prep.ready) return;
    const datasetChanged =
      datasetKey(prep.dataset) !== datasetKey(session.draft.dataset);
    if (datasetChanged) {
      store.selectDataset(
        session.id,
        prep.dataset,
        prep.datasetState.columns,
        prep.datasetState.rows,
      );
    }
    store.updateDraft(session.id, {
      format: prep.format,
      mapping: prep.mapping,
      formatConfirmed: prep.formatConfirmed,
      systemPrompt: prep.systemPrompt,
      splits: prep.splits,
      maxSamples: prep.maxSamples,
    });
    enqueueSnackbar(t("fineTuning:shellB.dataDialog.saved"), {
      variant: "success",
    });
    onClose();
  };

  const reason = prep.ready
    ? ""
    : blockerLabel(prep.blockingIssues[0] || "data_unavailable", t);

  return (
    <>
      <DialogContent dividers sx={{ bgcolor: "background.paper" }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Alert severity="info" sx={{ py: 0.5 }}>
            {t("fineTuning:shellB.dataDialog.frozenNote")}
          </Alert>
          <DataPreparationForm prep={prep} onChange={onChange} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 4, bgcolor: "background.paper" }}>
        <Button variant="outlined" onClick={onClose}>
          {t("common:cancel")}
        </Button>
        <Tooltip
          title={reason}
          disableHoverListener={!reason}
          disableFocusListener={!reason}
        >
          <span>
            <Button variant="contained" onClick={save} disabled={!prep.ready}>
              {t("common:save")}
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </>
  );
}

DataPrepEditor.propTypes = {
  session: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
};

/**
 * "Editar preparación de datos" of a prototype B session: the data editors
 * on a local copy; saving updates the session. Existing runs keep their
 * frozen data (the dialog says so).
 */
export default function DataPrepDialog({ open, onClose, session }) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const [mountKey, setMountKey] = useState(0);
  useEffect(() => {
    if (open) setMountKey((k) => k + 1);
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { minHeight: "500px" } }}
    >
      <DialogTitle sx={{ bgcolor: "background.paper" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          {t("fineTuning:shellB.dataDialog.title")}
          <IconButton
            onClick={onClose}
            size="small"
            sx={{ color: "text.secondary" }}
            aria-label={t("common:cancel")}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      {open && session && (
        <DataPrepEditor key={mountKey} session={session} onClose={onClose} />
      )}
    </Dialog>
  );
}

DataPrepDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  session: PropTypes.object,
};
