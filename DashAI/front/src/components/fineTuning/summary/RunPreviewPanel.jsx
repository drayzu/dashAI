// Right panel "Resumen de ejecución" (SPEC §4 summary): the Unsloth "Run
// preview" idea in DashAI style. 64px header (h6 + readiness chip), compact
// summary of model / data / training / hardware, and a sticky start button
// that shares its logic with ReviewStep (useStartRun).

import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SideBar from "../../threeSectionLayout/panelContainers/SideBar";
import KeyValueList from "../common/KeyValueList";
import VramEstimate from "../common/VramEstimate";
import { useFineTuningRoutes } from "../FineTuningContext";
import useStepValidation from "../steps/useStepValidation";
import {
  StartRunButton,
  buildRunSummary,
  gpuQueueMessage,
  useStartRun,
} from "../steps/ReviewStep";
import { blockerLabel, warningLabel } from "../data/labels";
import Hideable from "../viewEditing/Hideable";

const NS = "fineTuning:runPreview";

const READINESS_COLOR = {
  ready: "success",
  incomplete: "default",
  blocked: "error",
};

function SectionLabel({ children }) {
  return (
    <Typography
      variant="overline"
      color="text.secondary"
      component="h3"
      sx={{ letterSpacing: 1, display: "block", mt: 2 }}
    >
      {children}
    </Typography>
  );
}

/**
 * @param {object} props
 * @param {object} props.session
 * @param {(runId: string) => void} [props.onStart]
 * @param {object} [props.dataState] result of useDataPreparation (optional)
 * @param {object} [props.preparedData] rows for startRun (optional)
 */
export default function RunPreviewPanel({
  session,
  onStart,
  dataState,
  preparedData,
}) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const theme = useTheme();
  const navigate = useNavigate();
  const routes = useFineTuningRoutes();
  const v = useStepValidation(session, { dataState, preparedData });
  const startRun = useStartRun(v.session, v, { onStart, preparedData });

  const header = (chip) => (
    <Box
      sx={{
        p: 4,
        height: 64,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        borderBottom: `1px solid ${
          theme.palette.ui ? theme.palette.ui.border : theme.palette.divider
        }`,
      }}
    >
      <Typography variant="h6" color="text.primary" noWrap>
        {t(`${NS}.title`)}
      </Typography>
      {chip}
    </Box>
  );

  if (!v.session) {
    return (
      <SideBar>
        {header(null)}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 4,
          }}
        >
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {t(`${NS}.empty`)}
          </Typography>
        </Box>
      </SideBar>
    );
  }

  const s = buildRunSummary(v, t);
  const readiness = v.review.readiness;
  const blockers = v.review.blockers;
  const warnings = v.review.warnings.filter((w) => w !== "download_required");
  const gpuMessage = gpuQueueMessage(v.gpu, t);
  const activeRunId = v.sessionActiveRunId;

  return (
    <SideBar data-testid="run-preview-panel">
      {header(
        <Hideable
          id="a.preview.readinessChip"
          label={t("fineTuning:viewEditing.sections.aPreviewReadinessChip")}
          level="essential"
        >
          <Chip
            size="small"
            label={t(`${NS}.readiness.${readiness}`)}
            color={READINESS_COLOR[readiness]}
            variant={readiness === "incomplete" ? "outlined" : "filled"}
            aria-live="polite"
          />
        </Hideable>,
      )}

      <Box
        sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 4, pt: 3, pb: 4 }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
            {s.modelName}
          </Typography>
          {v.checkpoint && (
            <Chip size="small" variant="outlined" label={s.method} />
          )}
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          component="p"
          noWrap
        >
          {v.session.draft.dataset
            ? `${s.datasetName} · ${s.format}`
            : t(`${NS}.noDataset`)}
        </Typography>

        <Hideable
          id="a.preview.training"
          label={t("fineTuning:viewEditing.sections.aPreviewTraining")}
          level="essential"
        >
          <SectionLabel>{t(`${NS}.sections.training`)}</SectionLabel>
          <KeyValueList
            dense
            rows={[
              {
                label: t("fineTuning:reviewStep.fields.duration"),
                value: s.duration,
              },
              {
                label: t("fineTuning:reviewStep.fields.effectiveBatch"),
                value: s.effectiveBatch,
              },
              {
                label: t("fineTuning:reviewStep.fields.maxLength"),
                value: s.maxLength,
              },
              {
                label: t("fineTuning:reviewStep.fields.learningRate"),
                value: s.learningRate,
                mono: true,
              },
              { label: t(`${NS}.loraShort`), value: s.loraShort },
            ]}
          />
        </Hideable>

        <Hideable
          id="a.preview.data"
          label={t("fineTuning:viewEditing.sections.aPreviewData")}
          level="intermediate"
        >
          <SectionLabel>{t(`${NS}.sections.data`)}</SectionLabel>
          <KeyValueList
            dense
            rows={[
              { label: t(`${NS}.trainEval`), value: s.split },
              {
                label: t("fineTuning:reviewStep.fields.fingerprint"),
                value: s.fingerprintShort,
                mono: true,
                title: t("fineTuning:reviewStep.hints.fingerprint"),
              },
            ]}
          />
        </Hideable>

        <Hideable
          id="a.preview.hardware"
          label={t("fineTuning:viewEditing.sections.aPreviewHardware")}
          level="intermediate"
        >
          <SectionLabel>{t(`${NS}.sections.hardware`)}</SectionLabel>
          <VramEstimate
            estimatedGb={v.estimatedVramGb ?? undefined}
            hardware={v.hardware || undefined}
          />
        </Hideable>

        {v.checkpoint && (
          <Hideable
            id="a.preview.files"
            label={t("fineTuning:viewEditing.sections.aPreviewFiles")}
            level="full"
          >
            <SectionLabel>{t(`${NS}.sections.files`)}</SectionLabel>
            <Typography
              variant="body2"
              color={s.needsDownload ? "warning.main" : "text.secondary"}
            >
              {s.needsDownload
                ? t(`${NS}.download`, { size: s.downloadSize })
                : t(`${NS}.cached`, { size: s.downloadSize })}
            </Typography>
          </Hideable>
        )}

        {(blockers.length > 0 || warnings.length > 0) && (
          <Hideable
            id="a.preview.pending"
            label={t("fineTuning:viewEditing.sections.aPreviewPending")}
            level="intermediate"
          >
            <SectionLabel>{t(`${NS}.sections.pending`)}</SectionLabel>
            <Stack component="ul" spacing={1} sx={{ m: 0, pl: 4 }}>
              {blockers.map((code) => (
                <Typography
                  key={code}
                  component="li"
                  variant="caption"
                  color="error.main"
                >
                  {blockerLabel(code, t)}
                </Typography>
              ))}
              {warnings.map((code) => (
                <Typography
                  key={code}
                  component="li"
                  variant="caption"
                  color="warning.main"
                >
                  {warningLabel(code, t)}
                </Typography>
              ))}
            </Stack>
          </Hideable>
        )}
      </Box>

      <Box
        sx={{
          position: "sticky",
          bottom: 0,
          flexShrink: 0,
          p: 4,
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "background.box",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {gpuMessage && (
          <Hideable
            id="a.preview.gpuQueueNote"
            label={t("fineTuning:viewEditing.sections.aPreviewGpuQueueNote")}
            level="full"
          >
            <Typography
              variant="caption"
              color="text.secondary"
              aria-live="polite"
            >
              {gpuMessage}
            </Typography>
          </Hideable>
        )}
        {activeRunId && (
          <Button
            variant="outlined"
            size="small"
            fullWidth
            startIcon={<VisibilityOutlinedIcon fontSize="small" />}
            onClick={() => navigate(routes.run(v.session.id, activeRunId))}
          >
            {t(`${NS}.viewCurrent`)}
          </Button>
        )}
        <StartRunButton startRun={startRun} fullWidth />
      </Box>
    </SideBar>
  );
}
