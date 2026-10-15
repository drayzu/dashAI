import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "../../test-utils/renderWithProviders";

// Mutable job lists the mocked hooks return; set per test.
let mockJobs = [];
let mockExternalJobs = [];

// Mock API modules before importing component
jest.mock("../../api/job", () => ({
  deleteJob: jest.fn(),
  deleteAllJobs: jest.fn(),
  getJobs: jest.fn(() => Promise.resolve([])),
}));

jest.mock("../../hooks/useJobPolling", () => ({
  useJobManager: () => ({
    jobs: mockJobs,
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
  forceRefreshNow: jest.fn(),
}));

jest.mock(
  "../../utils/externalJobs",
  () => ({ useExternalJobs: () => mockExternalJobs }),
  { virtual: true },
);

import JobQueueWidget from "./JobQueueWidget";
import { deleteAllJobs, deleteJob } from "../../api/job";

const externalJob = (overrides = {}) => ({
  id: "ft-A-run-4",
  external: true,
  task_type: "FineTuningJob",
  job_name: "Asistente de soporte · 4",
  status: "started",
  progress: 30,
  progress_message: "Entrenamiento · paso 18/60",
  last_update: new Date().toISOString(),
  href: "/app/generative/fine-tuning/sessions/s1/runs/r4",
  ...overrides,
});

beforeEach(() => {
  mockJobs = [];
  mockExternalJobs = [];
  jest.clearAllMocks();
  // Ensure the job list is expanded so rows (and their bars) render.
  localStorage.setItem("jobQueueWidgetExpanded", "true");
});

describe("JobQueueWidget", () => {
  it("renders without crashing", () => {
    renderWithProviders(<JobQueueWidget />);
  });

  it("renders the Job Queue header", () => {
    renderWithProviders(<JobQueueWidget />);
    expect(screen.getByText("Job Queue")).toBeInTheDocument();
  });

  it("shows a determinate bar and phase message for a running job", () => {
    mockJobs = [
      {
        id: "job-1",
        task_type: "ModelJob",
        job_name: "Train model",
        status: "started",
        last_update: "2026-07-01 00:00:00.000",
        progress: 42,
        progress_message: "Training",
      },
    ];
    renderWithProviders(<JobQueueWidget />);

    expect(screen.getByText("Training")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "42");
  });

  it("shows an indeterminate bar when a running job has no progress", () => {
    mockJobs = [
      {
        id: "job-2",
        task_type: "ModelJob",
        job_name: "Train model",
        status: "started",
        last_update: "2026-07-01 00:00:00.000",
        progress: null,
        progress_message: null,
      },
    ];
    renderWithProviders(<JobQueueWidget />);

    const bar = screen.getByRole("progressbar");
    expect(bar).not.toHaveAttribute("aria-valuenow");
  });

  describe("external jobs", () => {
    it("lists them with their message and progress, and counts them", () => {
      mockExternalJobs = [externalJob()];
      renderWithProviders(<JobQueueWidget />);

      expect(screen.getByText("Asistente de soporte · 4")).toBeInTheDocument();
      expect(
        screen.getByText("Entrenamiento · paso 18/60"),
      ).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "30",
      );
      expect(screen.getByText("1 active")).toBeInTheDocument();
    });

    it("navigates to the job href when clicked", () => {
      mockExternalJobs = [externalJob()];
      renderWithProviders(
        <>
          <JobQueueWidget />
          <Routes>
            <Route path="/" element={null} />
            <Route
              path="/app/generative/fine-tuning/sessions/s1/runs/r4"
              element={<div>run detail page</div>}
            />
          </Routes>
        </>,
      );

      fireEvent.click(screen.getByText("Asistente de soporte · 4"));
      expect(screen.getByText("run detail page")).toBeInTheDocument();
    });

    it("cancels an active job through onCancel after confirming", () => {
      const onCancel = jest.fn();
      mockExternalJobs = [externalJob({ onCancel })];
      renderWithProviders(<JobQueueWidget />);

      fireEvent.click(screen.getByRole("button", { name: "delete" }));
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Cancel job",
        }),
      );

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(deleteJob).not.toHaveBeenCalled();
    });

    it("hides a job without onCancel instead of deleting it via the API", () => {
      mockExternalJobs = [externalJob({ status: "finished", progress: 100 })];
      renderWithProviders(<JobQueueWidget />);

      fireEvent.click(screen.getByText("Show Completed"));
      expect(screen.getByText("Asistente de soporte · 4")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "delete" }));
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Delete",
        }),
      );

      expect(
        screen.queryByText("Asistente de soporte · 4"),
      ).not.toBeInTheDocument();
      expect(deleteJob).not.toHaveBeenCalled();
    });

    it("never sends external jobs to the clear-all API", () => {
      mockExternalJobs = [externalJob({ status: "finished", progress: 100 })];
      renderWithProviders(<JobQueueWidget />);

      fireEvent.click(screen.getByRole("button", { name: "Clear All Jobs" }));
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Clear All",
        }),
      );

      expect(deleteAllJobs).not.toHaveBeenCalled();
    });
  });
});
