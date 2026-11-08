import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Box, TextField, Typography } from "@mui/material";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import CenterPanel from "../../../components/threeSectionLayout/panels/CenterPanel";
import RightPanel from "../../../components/threeSectionLayout/panels/RightPanel";
import SideBar from "../../../components/threeSectionLayout/panelContainers/SideBar";
import StepperNavigationFooter from "../../../components/shared/StepperNavigationFooter";
import {
  useFineTuningActions,
  useFineTuningRoutes,
  useFineTuningStore,
} from "../../../components/fineTuning/FineTuningContext";
import { useDataPreparation } from "../../../components/fineTuning/dataPrep/useDataPreparation";
import DataPreparationForm from "../../../components/fineTuning/dataPrep/DataPreparationForm";
import SftExampleView, {
  SftLegend,
} from "../../../components/fineTuning/dataPrep/SftExampleView";
import SectionCard from "../../../components/fineTuning/common/SectionCard";
import KeyValueList from "../../../components/fineTuning/common/KeyValueList";
import EmptyState from "../../../components/fineTuning/common/EmptyState";
import PrototypeBHeader from "../../../components/fineTuning/integration/PrototypeBHeader";
import {
  blockerLabel,
  datasetName,
  formatLabel,
} from "../../../components/fineTuning/data/labels";
import { createDefaultDraft } from "../../../components/fineTuning/data/catalog";
import { extractDataPrep } from "../../../components/fineTuning/data/store";
import Hideable from "../../../components/fineTuning/viewEditing/Hideable";

const selectSessionNames = (s) => s.sessions.map((session) => session.name);

/** First free "Sesión SFT N" (translated base). */
export function nextSftSessionName(names, t) {
  const taken = new Set(names);
  let n = 1;
  while (taken.has(t("fineTuning:shellB.create.defaultName", { n }))) n += 1;
  return t("fineTuning:shellB.create.defaultName", { n });
}

/**
 * Right panel while creating a session: "Vista previa SFT" (two rendered
 * examples with the loss mask) and the resulting split counts.
 */
export function SftPreviewPanel({ prep }) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const hasData = Boolean(prep && prep.dataset);
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
            {t("fineTuning:shellB.preview.title")}
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
          {!hasData ? (
            <EmptyState
              icon={VisibilityOutlinedIcon}
              title={t("fineTuning:shellB.preview.emptyTitle")}
              description={t("fineTuning:shellB.preview.emptyDescription")}
            />
          ) : (
            <>
              <Hideable
                id="b.create.previewSummary"
                label={t(
                  "fineTuning:viewEditing.sections.bCreatePreviewSummary",
                )}
                level="intermediate"
              >
                <KeyValueList
                  dense
                  rows={[
                    {
                      label: t("fineTuning:shellB.preview.dataset"),
                      value: datasetName(prep.dataset, t),
                    },
                    {
                      label: t("fineTuning:shellB.preview.format"),
                      value: formatLabel(prep.format, t),
                    },
                    {
                      label: t("fineTuning:shellB.preview.rows"),
                      value: t("fineTuning:shellB.preview.rowsValue", {
                        used: prep.usedRows,
                        total: prep.datasetState.totalRows,
                      }),
                    },
                    {
                      label: t("fineTuning:shellB.preview.train"),
                      value: String(prep.splitCounts.train),
                    },
                    {
                      label: t("fineTuning:shellB.preview.eval"),
                      value: String(prep.splitCounts.eval),
                    },
                    {
                      label: t("fineTuning:shellB.preview.fingerprint"),
                      value: prep.fingerprint
                        ? prep.fingerprint.slice(0, 12)
                        : "",
                      mono: true,
                    },
                  ]}
                />
              </Hideable>
              {prep.renderedExamples.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t("fineTuning:shellB.preview.noExamples")}
                </Typography>
              ) : (
                <>
                  <Hideable
                    id="shared.data.sftLegend"
                    label={t("fineTuning:viewEditing.sections.dataSftLegend")}
                    level="full"
                  >
                    <SftLegend />
                  </Hideable>
                  {prep.renderedExamples.map((ex, i) => (
                    <SftExampleView
                      key={ex.sourceIndex}
                      rendered={ex.rendered}
                      maxLength={prep.maxLength}
                      title={t("fineTuning:shellB.preview.example", {
                        n: i + 1,
                        row: ex.rowNumber,
                      })}
                      maxHeight={260}
                    />
                  ))}
                  <Hideable
                    id="shared.data.tokenApproxNote"
                    label={t(
                      "fineTuning:viewEditing.sections.dataTokenApproxNote",
                    )}
                    level="full"
                  >
                    <Typography variant="caption" color="text.secondary">
                      {t("fineTuning:shellB.preview.approxNote")}
                    </Typography>
                  </Hideable>
                </>
              )}
            </>
          )}
        </Box>
      </Box>
    </SideBar>
  );
}

SftPreviewPanel.propTypes = { prep: PropTypes.object };

/**
 * `/app/models/fine-tuning/new`: one scrolling form like Models'
 * CreateSessionSteps (name + dataset + SFT preparation). The session fixes
 * the dataset and its preparation; runs later vary model/method/parameters.
 */
export default function CreateSftSessionView() {
  const { t } = useTranslation(["fineTuning", "common"]);
  const store = useFineTuningActions();
  const routes = useFineTuningRoutes();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionNames = useFineTuningStore(selectSessionNames);

  const [dataPrep, setDataPrep] = useState(() =>
    extractDataPrep(createDefaultDraft()),
  );
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const defaultName = useMemo(
    () => nextSftSessionName(sessionNames, t),
    [sessionNames, t],
  );
  const effectiveName = nameTouched ? name : defaultName;

  const onChange = useCallback(
    (patch) => setDataPrep((prev) => ({ ...prev, ...patch })),
    [],
  );
  const prep = useDataPreparation({ dataPrep, onChange });

  // Return from the real upload flow: `?datasetId=<id>` selects that dataset.
  const handledUpload = useRef(null);
  const uploadedId = searchParams.get("datasetId");
  const { selectDataset, source } = prep;
  useEffect(() => {
    if (!uploadedId || handledUpload.current === uploadedId) return;
    const option = source.datasets.find(
      (d) => d.source === "dashai" && String(d.id) === String(uploadedId),
    );
    if (!option && source.loading) return;
    handledUpload.current = uploadedId;
    selectDataset(
      option || {
        source: "dashai",
        id: Number(uploadedId),
        name: `#${uploadedId}`,
        totalRows: 0,
        columns: [],
      },
    );
    setSearchParams({}, { replace: true });
  }, [
    uploadedId,
    source.datasets,
    source.loading,
    selectDataset,
    setSearchParams,
  ]);

  const nameValid = effectiveName.trim().length > 0;
  const canCreate = nameValid && prep.ready;
  const blocking = !nameValid
    ? t("fineTuning:shellB.create.nameRequired")
    : prep.blockingIssues[0]
      ? blockerLabel(prep.blockingIssues[0], t)
      : prep.datasetState.loading
        ? t("fineTuning:shellB.create.loading")
        : "";

  const create = () => {
    if (!canCreate) return;
    try {
      const sessionId = store.createSession(effectiveName.trim());
      store.selectDataset(
        sessionId,
        prep.dataset,
        prep.datasetState.columns,
        prep.datasetState.rows,
      );
      store.updateDraft(sessionId, {
        format: prep.format,
        mapping: prep.mapping,
        formatConfirmed: prep.formatConfirmed,
        systemPrompt: prep.systemPrompt,
        splits: prep.splits,
        maxSamples: prep.maxSamples,
      });
      enqueueSnackbar(
        t("fineTuning:shellB.create.created", { name: effectiveName.trim() }),
        { variant: "success" },
      );
      navigate(routes.session(sessionId));
    } catch (e) {
      enqueueSnackbar(t("fineTuning:shellB.create.failed"), {
        variant: "error",
      });
    }
  };

  return (
    <>
      <CenterPanel>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minHeight: 0,
            px: 4,
            pt: 4,
          }}
        >
          <PrototypeBHeader
            crumbs={[
              { label: t("common:models"), path: "/app/models" },
              { label: t("fineTuning:shellB.crumbs.fineTuning"), path: null },
            ]}
          />
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" component="h1">
              {t("fineTuning:shellB.create.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("fineTuning:shellB.create.subtitle")}
            </Typography>
          </Box>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              pt: 2,
              pb: 4,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <SectionCard
              icon={DriveFileRenameOutlineIcon}
              title={t("fineTuning:shellB.create.nameTitle")}
              subtitle={t("fineTuning:shellB.create.nameHelp")}
            >
              <TextField
                size="small"
                fullWidth
                label={t("fineTuning:shellB.create.nameLabel")}
                value={effectiveName}
                onChange={(e) => {
                  setNameTouched(true);
                  setName(e.target.value);
                }}
                error={!nameValid}
                helperText={
                  !nameValid ? t("fineTuning:shellB.create.nameRequired") : " "
                }
              />
            </SectionCard>
            <DataPreparationForm
              prep={prep}
              onChange={onChange}
              onUpload={() => navigate(routes.uploadDataset())}
              showPreview={false}
            />
          </Box>
          {blocking && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textAlign: "right", pt: 1 }}
              aria-live="polite"
            >
              {blocking}
            </Typography>
          )}
          <StepperNavigationFooter
            onBack={() => navigate("/app/models")}
            onNext={create}
            nextDisabled={!canCreate}
            nextLabel={t("fineTuning:shellB.create.submit")}
            sx={{ pb: 4 }}
          />
        </Box>
      </CenterPanel>
      <RightPanel toggleButtonTop="50%">
        <SftPreviewPanel prep={prep} />
      </RightPanel>
    </>
  );
}
