import { MUSE_DEMO_PLAN } from "./muse-project-guide-demo.ts";
import { validateMuseProjectPlan, type MuseProjectPlan } from "./muse-project-guide.ts";

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function projectGuideEnabled(): boolean {
  return typeof process !== "undefined" && process.env.MUSE_PROJECT_GUIDE_PG04_ENABLED === "true";
}

// AI generation is deliberately NOT wired in PG-04. A deterministic, owner-reviewable
// roadmap template is attached to the selected actual project, then saved as a draft.
export function buildMuseProjectPlan(project: { id: string; name: string; muse_revision: number }): MuseProjectPlan {
  if (!UUID_PATTERN.test(project.id) || !Number.isSafeInteger(project.muse_revision) || project.muse_revision < 0)
    throw new Error("Invalid project context");
  const plan: MuseProjectPlan = structuredClone(MUSE_DEMO_PLAN);
  plan.projectId = project.id;
  plan.projectRevision = project.muse_revision;
  plan.summary = "Website redesign roadmap for " + project.name.slice(0, 160);
  plan.warnings = ["Review and customize every task before approval. This plan does not grant launch authorization."];
  const check = validateMuseProjectPlan(plan);
  if (!check.ok) throw new Error("Template did not validate: " + check.errors.join("; "));
  return plan;
}

export function parseMuseProjectPlan(value: unknown): MuseProjectPlan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    // Prevent unexpectedly large AI/model outputs from entering the review UI.
    const json = JSON.stringify(value);
    if (json.length > 150_000) return null;
    const plan = value as MuseProjectPlan;
    if (!Array.isArray(plan.phases) || plan.phases.length < 1 || plan.phases.length > 12 ||
      !Array.isArray(plan.warnings) || plan.warnings.length > 20 ||
      typeof plan.summary !== "string" || typeof plan.projectId !== "string" ||
      !plan.phases.every(p => p && Array.isArray(p.tasks) && p.tasks.length <= 250 &&
        p.tasks.every(t => t && Array.isArray(t.subtasks) && t.subtasks.length <= 100 &&
          Array.isArray(t.dependsOn) && Array.isArray(t.completionCriteria)))) return null;
    if (plan.phases.flatMap(p => p.tasks).length > 250) return null;
    return validateMuseProjectPlan(plan).ok ? plan : null;
  } catch {
    return null;
  }
}
