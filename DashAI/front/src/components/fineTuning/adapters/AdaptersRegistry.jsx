import { useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import DeleteConfirmationModal from "../../threeSectionLayout/DeleteConfirmationModal";
import {
  useFineTuningActions,
  useFineTuningRoutes,
  useFineTuningStore,
} from "../FineTuningContext";
import { formatBytes } from "../data/catalog";
import {
  adapterAvailabilityLabel,
  availabilityColor,
  datasetName,
  methodLabel,
} from "../data/labels";
import { modelBlockReason } from "../inference/ModelPickerMenu";
import { formatDateTime, modelRefStatus } from "../inference/modelAvailability";
import AdapterProvenanceDialog from "./AdapterProvenanceDialog";

const selectRegistry = (s) => ({
  adapters: s.adapters,
  checkpoints: s.checkpoints,
  runs: s.runs,
  sessions: s.sessions,
  chats: s.chats,
  comparisons: s.comparisons,
});

function ActionButton({
  title,
  disabledReason,
  onClick,
  disabled,
  color,
  children,
}) {
  return (
    <Tooltip title={disabled && disabledReason ? disabledReason : title}>
      <span>
        <IconButton
          size="small"
          color={color}
          aria-label={title}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

ActionButton.propTypes = {
  title: PropTypes.string.isRequired,
  disabledReason: PropTypes.string,
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  color: PropTypes.string,
  children: PropTypes.node,
};

/**
 * Registry of adapters ("Resultados / Adaptadores", R63): name, base model,
 * dataset, method, created, size and availability (independent of the run's
 * historical success, R62). Row actions: Probar en chat, Comparar,
 * Procedencia, Renombrar, Eliminar (with confirmation; chats that use the
 * adapter will then report it missing, the base model is never deleted).
 *
 * Props:
 * - onSelect?(adapterId): row click (e.g. to show provenance in a side panel).
 * - selectedId?: string — highlights a row.
 * - showHeader?: boolean (default true) — h5 title + subtitle.
 */
export default function AdaptersRegistry({
  onSelect,
  selectedId,
  showHeader = true,
}) {
  const { t, i18n } = useTranslation(["fineTuning", "common"]);
  const store = useFineTuningActions();
  const routes = useFineTuningRoutes();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const data = useFineTuningStore(selectRegistry);

  const [provenanceId, setProvenanceId] = useState(null);
  const [renaming, setRenaming] = useState(null); // { id, name }
  const [deleting, setDeleting] = useState(null); // adapter

  const pseudoState = data;
  const adapters = [...data.adapters].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
  );

  const openChat = (adapter) => {
    try {
      const chatId = store.openChat({ kind: "adapter", id: adapter.id });
      navigate(routes.chat(chatId));
    } catch (error) {
      enqueueSnackbar(t("fineTuning:adapters.openChatFailed"), {
        variant: "error",
      });
    }
  };

  const submitRename = () => {
    if (!renaming) return;
    const code = store.renameAdapter(renaming.id, renaming.name);
    if (code) {
      enqueueSnackbar(t("fineTuning:adapters.rename.empty"), {
        variant: "error",
      });
      return;
    }
    enqueueSnackbar(t("fineTuning:adapters.rename.done"), {
      variant: "success",
    });
    setRenaming(null);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const code = store.deleteAdapter(deleting.id);
    if (code) {
      enqueueSnackbar(t("fineTuning:adapters.delete.failed"), {
        variant: "error",
      });
    } else {
      enqueueSnackbar(
        t("fineTuning:adapters.delete.done", { name: deleting.name }),
        { variant: "success" },
      );
      if (provenanceId === deleting.id) setProvenanceId(null);
    }
    setDeleting(null);
  };

  const deleteWarning = (adapter) => {
    if (!adapter) return null;
    const chatCount = data.chats.filter(
      (c) =>
        c.modelRef &&
        c.modelRef.kind === "adapter" &&
        c.modelRef.id === adapter.id,
    ).length;
    const comparisonCount = data.comparisons.filter(
      (c) => c.adapterId === adapter.id,
    ).length;
    const parts = [];
    if (chatCount > 0)
      parts.push(
        t("fineTuning:adapters.delete.chatsWarning", { count: chatCount }),
      );
    if (comparisonCount > 0) {
      parts.push(
        t("fineTuning:adapters.delete.comparisonsWarning", {
          count: comparisonCount,
        }),
      );
    }
    parts.push(
      t("fineTuning:adapters.delete.baseKept", {
        base: adapter.checkpointName || adapter.checkpointId,
      }),
    );
    return parts.join(" ");
  };

  return (
    <Box>
      {showHeader && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" component="h2">
            {t("fineTuning:adapters.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("fineTuning:adapters.subtitle")}
          </Typography>
        </Box>
      )}

      {adapters.length === 0 ? (
        <Box
          sx={{
            border: "1px dashed",
            borderColor: "divider",
            borderRadius: 1,
            p: 8,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            textAlign: "center",
          }}
        >
          <ExtensionOutlinedIcon sx={{ fontSize: 48, opacity: 0.4 }} />
          <Typography variant="body2" color="text.secondary">
            {t("fineTuning:adapters.empty")}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate(routes.home())}
          >
            {t("fineTuning:adapters.emptyAction")}
          </Button>
        </Box>
      ) : (
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{ border: 1, borderColor: "divider" }}
        >
          <Table
            size="small"
            sx={{ minWidth: 880 }}
            aria-label={t("fineTuning:adapters.tableAria")}
          >
            <TableHead>
              <TableRow>
                <TableCell>{t("fineTuning:adapters.columns.name")}</TableCell>
                <TableCell>{t("fineTuning:adapters.columns.base")}</TableCell>
                <TableCell>
                  {t("fineTuning:adapters.columns.dataset")}
                </TableCell>
                <TableCell>{t("fineTuning:adapters.columns.method")}</TableCell>
                <TableCell>
                  {t("fineTuning:adapters.columns.created")}
                </TableCell>
                <TableCell align="right">
                  {t("fineTuning:adapters.columns.size")}
                </TableCell>
                <TableCell>
                  {t("fineTuning:adapters.columns.availability")}
                </TableCell>
                <TableCell align="right">
                  {t("fineTuning:adapters.columns.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {adapters.map((adapter) => {
                const run =
                  data.runs.find((r) => r.id === adapter.runId) || null;
                const session =
                  data.sessions.find((s) => s.id === adapter.sessionId) || null;
                const checkpoint =
                  data.checkpoints.find((c) => c.id === adapter.checkpointId) ||
                  null;
                const status = modelRefStatus(pseudoState, {
                  kind: "adapter",
                  id: adapter.id,
                });
                const blocked = modelBlockReason(status, t);
                const dsRef = run && run.snapshot ? run.snapshot.dataset : null;
                const dsName = dsRef
                  ? datasetName(dsRef, t)
                  : adapter.datasetName || "";
                const loraR =
                  adapter.loraR ||
                  (run && run.snapshot
                    ? run.snapshot.draft.parameters.loraR
                    : null);
                const selected = selectedId === adapter.id;
                const baseNotReady =
                  checkpoint && checkpoint.availability !== "ready";
                return (
                  <TableRow
                    key={adapter.id}
                    hover
                    selected={selected}
                    onClick={onSelect ? () => onSelect(adapter.id) : undefined}
                    sx={{
                      cursor: onSelect ? "pointer" : "default",
                      "&.Mui-selected": { bgcolor: "action.selected" },
                    }}
                  >
                    <TableCell sx={{ maxWidth: 260 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600 }}
                        noWrap
                        title={adapter.name}
                      >
                        {adapter.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        component="div"
                      >
                        {run
                          ? t("fineTuning:adapters.origin", {
                              number: run.number,
                              session: session ? session.name : "",
                            })
                          : ""}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Typography variant="body2">
                          {adapter.checkpointName || adapter.checkpointId}
                        </Typography>
                        {baseNotReady && (
                          <Tooltip
                            title={t("fineTuning:adapters.baseNotReady")}
                          >
                            <WarningAmberIcon
                              fontSize="small"
                              color="warning"
                              aria-label={t("fineTuning:adapters.baseNotReady")}
                            />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{dsName}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={
                          loraR
                            ? t("fineTuning:adapters.methodRank", {
                                method: methodLabel(adapter.method, t),
                                r: loraR,
                              })
                            : methodLabel(adapter.method, t)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>
                        {formatDateTime(adapter.createdAt, i18n.language)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" noWrap>
                        {formatBytes(adapter.sizeBytes)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={availabilityColor(adapter.availability)}
                        label={adapterAvailabilityLabel(
                          adapter.availability,
                          t,
                        )}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <ActionButton
                        title={t("fineTuning:adapters.actions.chat")}
                        disabledReason={blocked}
                        disabled={!status.usable}
                        color="primary"
                        onClick={() => openChat(adapter)}
                      >
                        <ForumOutlinedIcon fontSize="small" />
                      </ActionButton>
                      <ActionButton
                        title={t("fineTuning:adapters.actions.compare")}
                        onClick={() => navigate(routes.compare(adapter.id))}
                      >
                        <CompareArrowsIcon fontSize="small" />
                      </ActionButton>
                      <ActionButton
                        title={t("fineTuning:adapters.actions.provenance")}
                        onClick={() => setProvenanceId(adapter.id)}
                      >
                        <ReceiptLongOutlinedIcon fontSize="small" />
                      </ActionButton>
                      <ActionButton
                        title={t("fineTuning:adapters.actions.rename")}
                        onClick={() =>
                          setRenaming({ id: adapter.id, name: adapter.name })
                        }
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </ActionButton>
                      <ActionButton
                        title={t("fineTuning:adapters.actions.delete")}
                        color="error"
                        onClick={() => setDeleting(adapter)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </ActionButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {adapters.length > 0 && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 2 }}
        >
          {t("fineTuning:adapters.availabilityNote")}
        </Typography>
      )}

      <AdapterProvenanceDialog
        adapterId={provenanceId}
        open={Boolean(provenanceId)}
        onClose={() => setProvenanceId(null)}
      />

      <Dialog
        open={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t("fineTuning:adapters.rename.title")}</DialogTitle>
        <DialogContent dividers sx={{ bgcolor: "background.paper" }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label={t("fineTuning:adapters.rename.label")}
            value={renaming ? renaming.name : ""}
            onChange={(e) =>
              setRenaming((r) => (r ? { ...r, name: e.target.value } : r))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitRename();
              }
            }}
            error={Boolean(renaming && !renaming.name.trim())}
            helperText={
              renaming && !renaming.name.trim()
                ? t("fineTuning:adapters.rename.empty")
                : " "
            }
          />
        </DialogContent>
        <DialogActions sx={{ p: 4 }}>
          <Button variant="outlined" onClick={() => setRenaming(null)}>
            {t("common:cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={submitRename}
            disabled={Boolean(renaming && !renaming.name.trim())}
          >
            {t("common:save")}
          </Button>
        </DialogActions>
      </Dialog>

      <DeleteConfirmationModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        content={
          deleting
            ? t("fineTuning:adapters.delete.content", { name: deleting.name })
            : ""
        }
        warning={deleteWarning(deleting)}
      />
    </Box>
  );
}

AdaptersRegistry.propTypes = {
  onSelect: PropTypes.func,
  selectedId: PropTypes.string,
  showHeader: PropTypes.bool,
};
