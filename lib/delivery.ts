// Phase 4 — Project Delivery: canonical pipeline stages and helpers.

export const PIPELINE_STAGES = [
  { key: "discovery", label: "Discovery" },
  { key: "content", label: "Content" },
  { key: "design", label: "Design" },
  { key: "build", label: "Build" },
  { key: "review", label: "Review" },
  { key: "launch", label: "Launch" },
  { key: "care", label: "Care Plan" },
] as const;

export type PipelineStageKey = (typeof PIPELINE_STAGES)[number]["key"];

/** Parking stage — not part of the forward flow. */
export const ON_HOLD_STAGE = "on_hold";

const STAGE_LABELS: Record<string, string> = Object.fromEntries([
  ...PIPELINE_STAGES.map((s) => [s.key, s.label] as const),
  [ON_HOLD_STAGE, "On Hold"],
]);

export function stageLabel(status: string): string {
  return STAGE_LABELS[status] ?? status;
}

export function isForwardStage(status: string): boolean {
  return PIPELINE_STAGES.some((s) => s.key === status);
}

/** Next forward stage, or null when already at Care Plan / parked. */
export function nextStage(status: string): PipelineStageKey | null {
  const idx = PIPELINE_STAGES.findIndex((s) => s.key === status);
  if (idx === -1 || idx === PIPELINE_STAGES.length - 1) return null;
  return PIPELINE_STAGES[idx + 1].key;
}

export type MilestoneStatus = "not_started" | "in_progress" | "complete";

export function milestoneStatusLabel(status: string): string {
  switch (status) {
    case "in_progress":
      return "In progress";
    case "complete":
      return "Complete";
    default:
      return "Not started";
  }
}

export type LaunchItemKind = "payment" | "checklist" | "followup";

export function launchItemKindLabel(kind: string): string {
  switch (kind) {
    case "payment":
      return "Payment gate";
    case "followup":
      return "Follow-up";
    default:
      return "Checklist";
  }
}
