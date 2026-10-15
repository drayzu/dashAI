import { useState } from "react";
import PropTypes from "prop-types";
import { Box, Button, Chip, Stack, Tooltip, Typography } from "@mui/material";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import SideBar from "../../../components/threeSectionLayout/panelContainers/SideBar";
import {
  useFineTuningActions,
  useFineTuningRoutes,
  useFineTuningStore,
} from "../../../components/fineTuning/FineTuningContext";
import KeyValueList from "../../../components/fineTuning/common/KeyValueList";
import EmptyState from "../../../components/fineTuning/common/EmptyState";
import AdapterProvenanceDialog from "../../../components/fineTuning/adapters/AdapterProvenanceDialog";
import { adapterUseBlocker } from "../../../components/fineTuning/runs/AdapterResultCard";
import {
  adapterById,
  checkpointById,
  runById,
} from "../../../components/fineTuning/data/selectors";
import {
  adapterAvailabilityLabel,
  availabilityColor,
  methodLabel,
} from "../../../components/fineTuning/data/labels";
import { formatBytes } from "../../../components/fineTuning/data/catalog";
import {
  formatDateTime,
  formatMetric,
} from "../../../components/fineTuning/runs/runFormat";

/**
 * Right panel of "Modelos adaptados" (prototype B): provenance summary of the
 * selected adapter with its actions (chat, compare, full provenance, source
 * run in Models).
 *
 * @param {object} props
 * @param {string|null} [props.adapterId]
 */
export default function AdapterSummaryPanel({ adapterId }) {
  const { t, i18n } = useTranslation(["fineTuning", "common"]);
  const store = useFineTuningActions();
  const routes = useFineTuningRoutes();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [provenanceOpen, setProvenanceOpen] = useState(false);
  const adapter = useFineTuningStore((s) =>
    adapterId ? adapterById(s, adapterId) : null,
  );
  const checkpoint = useFineTuningStore((s) =>
    adapter ? checkpointById(s, adapter.checkpointId) : null,
  );
  const run = useFineTuningStore((s) =>
    adapter ? runById(s, adapter.runId) : null,
  );
  const blocker = adapter ? adapterUseBlocker(adapter, checkpoint, t) : null;

  const openChat = () => {
    try {
      const chatId = store.openChat({ kind: "adapter", id: adapter.id });
      navigate(routes.chat(chatId));
    } catch (e) {
      enqueueSnackbar(t("fineTuning:shellB.adapters.openChatFailed"), {
        variant: "error",
      });
    }
  };

  const tip = (title, node) =>
    title ? (
      <Tooltip title={title}>
        <span>{node}</span>
      </Tooltip>
    ) : (
      node
    );

  return (
    <SideBar>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            px: 4,
            height: 64,
            display: "flex",
            alignItems: "center",
            borderBottom: 1,
            borderColor: "ui.border",
            flexShrink: 0,
          }}
        >
          <Typography variant="h6" component="h2" color="text.primary">
            {t("fineTuning:shellB.adapters.summaryTitle")}
          </Typography>
        </Box>
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            p: 4,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {!adapter ? (
            <EmptyState
              icon={ExtensionOutlinedIcon}
              minHeight={240}
              title={t("fineTuning:shellB.adapters.summaryEmpty")}
              description={t("fineTuning:shellB.adapters.summaryEmptyHelp")}
            />
          ) : (
            <>
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 600, wordBreak: "break-word" }}
                >
                  {adapter.name}
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  color={availabilityColor(adapter.availability)}
                  label={adapterAvailabilityLabel(adapter.availability, t)}
                  sx={{ mt: 1 }}
                />
              </Box>
              <KeyValueList
                dense
                rows={[
                  {
                    label: t("fineTuning:shellB.adapters.fields.base"),
                    value: adapter.checkpointName || adapter.checkpointId,
                  },
                  {
                    label: t("fineTuning:shellB.adapters.fields.revision"),
                    value: adapter.revision ? adapter.revision.slice(0, 7) : "",
                    mono: true,
                    title: adapter.revision,
                  },
                  {
                    label: t("fineTuning:shellB.adapters.fields.method"),
                    value: `${methodLabel(adapter.method, t)} · r ${adapter.loraR}`,
                  },
                  {
                    label: t("fineTuning:shellB.adapters.fields.dataset"),
                    value: adapter.datasetName,
                  },
                  {
                    label: t("fineTuning:shellB.adapters.fields.fingerprint"),
                    value: adapter.fingerprint
                      ? adapter.fingerprint.slice(0, 12)
                      : "",
                    mono: true,
                  },
                  {
                    label: t("fineTuning:shellB.adapters.fields.run"),
                    value: run
                      ? run.name
                      : t("fineTuning:shellB.adapters.runDeleted"),
                  },
                  {
                    label: t("fineTuning:shellB.adapters.fields.evalLoss"),
                    value: adapter.metrics
                      ? formatMetric(adapter.metrics.finalEvalLoss)
                      : "",
                  },
                  {
                    label: t("fineTuning:shellB.adapters.fields.size"),
                    value: formatBytes(adapter.sizeBytes),
                  },
                  {
                    label: t("fineTuning:shellB.adapters.fields.created"),
                    value: formatDateTime(adapter.createdAt, i18n.language),
                  },
                ]}
              />
              <Stack spacing={2}>
                {tip(
                  blocker,
                  <Button
                    fullWidth
                    size="small"
                    variant="contained"
                    startIcon={<ForumOutlinedIcon fontSize="small" />}
                    disabled={Boolean(blocker)}
                    onClick={openChat}
                  >
                    {t("fineTuning:shellB.adapters.chat")}
                  </Button>,
                )}
                {tip(
                  adapter.availability !== "ready" ? blocker : null,
                  <Button
                    fullWidth
                    size="small"
                    variant="outlined"
                    startIcon={<CompareArrowsIcon fontSize="small" />}
                    disabled={adapter.availability !== "ready"}
                    onClick={() => navigate(routes.compare(adapter.id))}
                  >
                    {t("fineTuning:shellB.adapters.compare")}
                  </Button>,
                )}
                <Button
                  fullWidth
                  size="small"
                  variant="text"
                  onClick={() => setProvenanceOpen(true)}
                >
                  {t("fineTuning:shellB.adapters.fullProvenance")}
                </Button>
                {run && (
                  <Button
                    fullWidth
                    size="small"
                    variant="text"
                    onClick={() => navigate(routes.run(run.sessionId, run.id))}
                  >
                    {t("fineTuning:shellB.adapters.openRun")}
                  </Button>
                )}
              </Stack>
              <AdapterProvenanceDialog
                adapterId={adapter.id}
                open={provenanceOpen}
                onClose={() => setProvenanceOpen(false)}
              />
            </>
          )}
        </Box>
      </Box>
    </SideBar>
  );
}

AdapterSummaryPanel.propTypes = {
  adapterId: PropTypes.string,
};
