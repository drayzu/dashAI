import { useState } from "react";
import PropTypes from "prop-types";
import { Box, Button, Chip, Divider, Typography } from "@mui/material";
import { Edit } from "@mui/icons-material";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import CenterPanel from "../../../components/threeSectionLayout/panels/CenterPanel";
import RightPanel from "../../../components/threeSectionLayout/panels/RightPanel";
import SideBar from "../../../components/threeSectionLayout/panelContainers/SideBar";
import {
  useFineTuningActions,
  useFineTuningRoutes,
  useFineTuningStore,
} from "../../../components/fineTuning/FineTuningContext";
import PrototypeBHeader from "../../../components/fineTuning/integration/PrototypeBHeader";
import RunDetail, {
  RUN_DETAIL_TABS,
} from "../../../components/fineTuning/runs/RunDetail";
import { frozenConfigGroups } from "../../../components/fineTuning/runs/FrozenConfigAccordion";
import { adapterUseBlocker } from "../../../components/fineTuning/runs/AdapterResultCard";
import KeyValueList from "../../../components/fineTuning/common/KeyValueList";
import EmptyState from "../../../components/fineTuning/common/EmptyState";
import {
  adapterById,
  checkpointById,
  runById,
  sessionById,
} from "../../../components/fineTuning/data/selectors";
import {
  adapterAvailabilityLabel,
  availabilityColor,
} from "../../../components/fineTuning/data/labels";
import { formatBytes } from "../../../components/fineTuning/data/catalog";
import RunConfigDialog from "./RunConfigDialog";
import { SessionNotFound } from "./SessionViewB";

/**
 * Right panel of a run detail (like Models' RunInfoSidebar): the frozen
 * configuration grouped as key/value lists plus a mini card of the adapter.
 */
export function RunInfoPanel({ runId }) {
  const { t, i18n } = useTranslation(["fineTuning", "common"]);
  const store = useFineTuningActions();
  const routes = useFineTuningRoutes();
  const navigate = useNavigate();
  const run = useFineTuningStore((s) => runById(s, runId));
  const adapter = useFineTuningStore((s) =>
    run && run.adapterId ? adapterById(s, run.adapterId) : null,
  );
  const checkpoint = useFineTuningStore((s) =>
    adapter ? checkpointById(s, adapter.checkpointId) : null,
  );
  const groups = run ? frozenConfigGroups(run, t, i18n.language) : [];
  const blocker = adapter ? adapterUseBlocker(adapter, checkpoint, t) : null;

  const openInGenerative = () => {
    if (!adapter) return;
    const chatId = store.openChat({ kind: "adapter", id: adapter.id });
    navigate(routes.chat(chatId));
  };

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
            {t("fineTuning:shellB.runInfo.title")}
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
          {!run ? (
            <EmptyState
              icon={InfoOutlinedIcon}
              title={t("fineTuning:shellB.runInfo.empty")}
            />
          ) : (
            <>
              {adapter && (
                <Box
                  sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    p: 3,
                    bgcolor: "background.paper",
                  }}
                >
                  <Typography
                    variant="overline"
                    color="text.secondary"
                    sx={{ display: "block" }}
                  >
                    {t("fineTuning:shellB.runInfo.adapter")}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, wordBreak: "break-word" }}
                  >
                    {adapter.name}
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mt: 1,
                      flexWrap: "wrap",
                    }}
                  >
                    <Chip
                      size="small"
                      variant="outlined"
                      color={availabilityColor(adapter.availability)}
                      label={adapterAvailabilityLabel(adapter.availability, t)}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {formatBytes(adapter.sizeBytes)}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    fullWidth
                    startIcon={<ForumOutlinedIcon fontSize="small" />}
                    disabled={Boolean(blocker)}
                    onClick={openInGenerative}
                    sx={{ mt: 3 }}
                  >
                    {t("fineTuning:shellB.runInfo.useInGenerative")}
                  </Button>
                  {blocker && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      component="p"
                      sx={{ mt: 1 }}
                    >
                      {blocker}
                    </Typography>
                  )}
                </Box>
              )}
              {groups.map((group, index) => (
                <Box key={group.key}>
                  {index > 0 && <Divider sx={{ mb: 3 }} />}
                  <KeyValueList
                    dense
                    title={group.title}
                    rows={group.rows.map((row) => ({
                      key: row.key,
                      label: row.label,
                      value: row.value,
                      mono: row.mono,
                      title: row.full,
                    }))}
                  />
                </Box>
              ))}
            </>
          )}
        </Box>
      </Box>
    </SideBar>
  );
}

RunInfoPanel.propTypes = { runId: PropTypes.string };

/**
 * `/app/models/fine-tuning/:sessionId/run/:runId`: run detail with the
 * result tabs (Métricas en vivo · Datos SFT · Recursos · Registro ·
 * Procedencia). The tab lives in `?tab=`; a not-started configuration can be
 * edited from the header.
 */
export default function RunDetailViewB({ sessionId, runId }) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const routes = useFineTuningRoutes();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const session = useFineTuningStore((s) => sessionById(s, sessionId));
  const run = useFineTuningStore((s) => runById(s, runId));
  const [editOpen, setEditOpen] = useState(false);

  const tabParam = searchParams.get("tab");
  const tab = RUN_DETAIL_TABS.includes(tabParam) ? tabParam : "metrics";
  const setTab = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === "metrics") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  if (!session) return <SessionNotFound />;

  const crumbs = [
    { label: t("common:models"), path: "/app/models" },
    { label: t("fineTuning:shellB.crumbs.fineTuning"), path: routes.home() },
    { label: session.name, path: routes.session(sessionId) },
    {
      label: run ? run.name : t("fineTuning:shellB.runInfo.notFoundCrumb"),
      path: null,
    },
  ];

  const belongs = run && run.sessionId === sessionId;

  return (
    <>
      <CenterPanel>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "auto",
            px: 4,
            pt: 4,
            pb: 4,
          }}
        >
          <PrototypeBHeader crumbs={crumbs} />
          {belongs ? (
            <RunDetail
              runId={runId}
              variant="B"
              tab={tab}
              onTabChange={setTab}
              onDeleted={() => navigate(routes.session(sessionId))}
              extraActions={
                run.status === 0 ? (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Edit fontSize="small" />}
                    onClick={() => setEditOpen(true)}
                  >
                    {t("fineTuning:shellB.runInfo.editConfig")}
                  </Button>
                ) : null
              }
            />
          ) : (
            <EmptyState
              size="page"
              minHeight="50vh"
              title={t("fineTuning:shellB.runInfo.notFound")}
              action={
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => navigate(routes.session(sessionId))}
                >
                  {t("fineTuning:shellB.runInfo.backToSession")}
                </Button>
              }
            />
          )}
        </Box>
      </CenterPanel>
      <RightPanel toggleButtonTop="50%">
        <RunInfoPanel runId={belongs ? runId : null} />
      </RightPanel>
      {belongs && run.status === 0 && (
        <RunConfigDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          session={session}
          runId={runId}
        />
      )}
    </>
  );
}

RunDetailViewB.propTypes = {
  sessionId: PropTypes.string.isRequired,
  runId: PropTypes.string.isRequired,
};
