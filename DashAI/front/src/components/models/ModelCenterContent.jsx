import { useState } from "react";
import { useModels } from "./ModelsContext";
import {
  prototypeVisible,
  useActivePrototype,
} from "../../utils/demoPrototype";
import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
import CreateSessionSteps from "./CreateSessionSteps";
import DatasetVisualization from "../DatasetVisualization";
import SelectOptionMenu from "../threeSectionLayout/SelectOptionMenu";
import ModelsBreadcrumbs from "./ModelsBreadcrumbs";
import { useTourContext } from "../tour/TourProvider";
import { useNavigate } from "react-router-dom";
import { iconByName } from "./model/ModelIcon";
import {
  FINE_TUNING_B_NEW,
  FINE_TUNING_TASK_NAME,
  buildFineTuningTaskOption,
} from "../fineTuning/integration/entryPoints";
import {
  buildExtensionTaskOptions,
  extensionFromOptionName,
  extensionsVisible,
} from "../fineTuning/integration/extensions";
import ExtensionPreviewDialog from "../fineTuning/integration/ExtensionPreviewDialog";

export default function ModelsCenterContent() {
  const { t } = useTranslation(["models", "datasets", "common", "fineTuning"]);
  const tourContext = useTourContext();
  const navigate = useNavigate();
  const {
    sessions,
    setSessions,
    selectedTask,
    tasks,
    loadingTasks,
    datasets,
    selectedDatasetId,
    step,
  } = useModels();
  const activePrototype = useActivePrototype();
  const [extensionId, setExtensionId] = useState(null);

  const goToNextStep = (taskName) => {
    // Preview of a candidate extension (prototype F): nothing to navigate to.
    const extension = extensionFromOptionName(taskName);
    if (extension) {
      setExtensionId(extension);
      return;
    }
    // Front-only prototype card (LLM fine-tuning, prototype B).
    if (taskName === FINE_TUNING_TASK_NAME) {
      navigate(FINE_TUNING_B_NEW);
      return;
    }
    navigate(`/app/models/sessions/new/${taskName}`);

    if (tourContext?.run && tourContext?.stepIndex === 4) {
      const waitForElement = () => {
        const element = document.querySelector(
          '[data-tour="models-dataset-selection"]',
        );
        if (element) {
          tourContext.nextStep();
        } else {
          setTimeout(waitForElement, 100);
        }
      };
      setTimeout(waitForElement, 100);
    }
  };

  const handleBackToTaskSelection = () => {
    navigate("/app/models");
  };

  const handleGoToDatasets = () => {
    navigate("/app/data?action=upload");
  };

  const handleSessionCreated = (newSession) => {
    setSessions((prev) => [...prev, newSession]);
    navigate(`/app/models/sessions/${newSession.id}`);
  };

  const handleNewSessionFromDataset = () => {
    navigate("/app/models", {
      state: { preselectedDatasetId: selectedDatasetId },
    });
  };

  const handleBackToDataset = () => {
    if (selectedDatasetId) {
      navigate(`/app/models/datasets/${selectedDatasetId}`);
      return;
    }
    navigate("/app/models");
  };

  return (
    <>
      {step === 1 && selectedTask ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            overflow: "hidden",
            px: 4,
            pt: 4,
          }}
        >
          <ModelsBreadcrumbs />
          <CreateSessionSteps
            backHome={handleBackToTaskSelection}
            selectedTask={selectedTask}
            datasets={datasets}
            handleSessionCreated={handleSessionCreated}
            existingSessions={sessions}
            preselectedDatasetId={selectedDatasetId}
          />
        </Box>
      ) : step === 2 && selectedDatasetId ? (
        <DatasetVisualization
          dataset={datasets.find((d) => d.id === selectedDatasetId)}
          onItemCreated={handleSessionCreated}
          onNewItem={handleNewSessionFromDataset}
          existingItems={sessions}
          newItemButtonText={t("models:button.createSession")}
        />
      ) : step === 0 ? (
        <SelectOptionMenu
          loading={loadingTasks}
          title={
            selectedDatasetId
              ? t("models:label.selectTaskForSession")
              : t("models:label.modelsModule")
          }
          subtitle={
            selectedDatasetId
              ? t("models:label.chooseTaskForSessionWithDataset", {
                  datasetName: datasets.find((d) => d.id === selectedDatasetId)
                    ?.name,
                })
              : t("models:label.configureTasksTrainCompareModels")
          }
          options={[
            ...tasks.map((task) => ({
              name: task.name,
              display_name:
                task.display_name ||
                task.name
                  .replace("Task", "")
                  .replace(/([A-Z])/g, " $1")
                  .trim(),
              description:
                task.description || task.metadata?.short_description || "",
              // The task declares its icon, as a model does.
              Icon: iconByName(task.metadata?.icon),
              badge:
                task.metadata?.requires_target === false
                  ? t("models:label.unsupervisedBadge")
                  : t("models:label.supervisedBadge"),
            })),
            // Appended after the backend tasks so the tour keeps its target.
            ...(selectedDatasetId || !prototypeVisible(activePrototype, "B")
              ? []
              : [buildFineTuningTaskOption(t)]),
            ...(selectedDatasetId || !extensionsVisible(activePrototype)
              ? []
              : buildExtensionTaskOptions()),
          ]}
          searchBar={false}
          goToPrevStep={selectedDatasetId ? handleBackToDataset : null}
          showNoDatasetAlert={!selectedDatasetId && datasets.length === 0}
          onGoToDatasets={handleGoToDatasets}
          goToNextStep={goToNextStep}
          dataTour="task-selection"
        />
      ) : null}
      <ExtensionPreviewDialog
        extensionId={extensionId}
        onClose={() => setExtensionId(null)}
        onTry={() => {
          setExtensionId(null);
          navigate(FINE_TUNING_B_NEW);
        }}
      />
    </>
  );
}
