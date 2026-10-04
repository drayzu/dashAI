// Presentation models for the demo, not schemas of the experimental backend.
export type DemoRunStatus =
  "NOT_STARTED" | "DELIVERED" | "STARTED" | "FINISHED" | "ERROR";
export type DemoTermination = "failed" | "cancelled" | "interrupted" | null;
export type DemoPhase =
  | "preparing"
  | "downloading"
  | "validating"
  | "loading"
  | "training"
  | "saving";
export type DemoAvailability = "ready" | "missing" | "invalid" | "downloading";
export type DemoScenario =
  | "success"
  | "invalid_data"
  | "incompatible"
  | "incomplete_download"
  | "oom"
  | "interrupted"
  | "missing_adapter";
export interface DemoDraft {
  checkpointId: string;
  datasetId: number;
  format: "alpaca" | "pairs" | "messages";
  mapping: Record<string, string>;
  method: "lora" | "qlora";
  durationMode: "steps" | "epochs";
  parameters: Record<string, number | string>;
  validation: number;
  seed: number;
  scenario: DemoScenario;
}
export interface DemoSession {
  id: string;
  name: string;
  draft: DemoDraft;
  createdAt: number;
}
export interface DemoRun {
  id: string;
  sessionId: string;
  name: string;
  snapshot: {
    draft: DemoDraft;
    checkpoint: Record<string, any>;
    dataset: Record<string, any>;
    prepared: Record<string, any>[];
    splits: { train: number[]; evaluation: number[] };
  };
  status: DemoRunStatus;
  queueStatus: string;
  phase: DemoPhase;
  terminationReason: DemoTermination;
  progress: number;
  step: number;
  metrics: { step: number; train: number; evaluation: number }[];
  startedAt: number;
  updatedAt: number;
  error: string | null;
}
export interface DemoAdaptedModel {
  id: string;
  name: string;
  runId: string;
  availability: DemoAvailability;
}
