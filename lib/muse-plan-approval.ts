// PG-01 approval preflight. Pure logic only; persistence and authentication belong to server/RLS.
import { validateMuseProjectPlan, type MuseProjectPlan } from "./muse-project-guide.ts";

export type PlanDraftState = "draft" | "pending_approval" | "approved" | "applying" | "applied" | "rejected" | "expired" | "conflicted";
export type PlanDraftApproval = {
  projectId: string;
  planVersion: number;
  projectRevision: number;
  status: PlanDraftState;
  approvedVersion: number | null;
  approvedDigest: string | null;
  expiresAt: string | null;
};
export type ApplyPreflight = { ok: true } | { ok: false; reason: string };

// Digest is produced by the server from canonical JSON via a cryptographic hash.
// This preflight deliberately does not implement hashing or permission checks.
export function preflightApplyPlan(input: {
  draft: PlanDraftApproval;
  plan: MuseProjectPlan;
  authenticatedAdmin: boolean;
  currentProjectRevision: number;
  currentDigest: string;
  nowIso: string;
}): ApplyPreflight {
  const { draft, plan } = input;
  if (!input.authenticatedAdmin) return { ok: false, reason: "Admin authorization required" };
  if (draft.status !== "approved") return { ok: false, reason: "Draft is not approved" };
  if (!draft.approvedDigest || draft.approvedDigest !== input.currentDigest) return { ok: false, reason: "Approved payload digest mismatch" };
  if (draft.approvedVersion !== draft.planVersion) return { ok: false, reason: "Approval version mismatch" };
  if (draft.projectId !== plan.projectId || draft.projectRevision !== plan.projectRevision) return { ok: false, reason: "Project identity/revision mismatch" };
  if (draft.projectRevision !== input.currentProjectRevision) return { ok: false, reason: "Project changed since draft creation" };
  if (draft.expiresAt && (!Number.isFinite(Date.parse(draft.expiresAt)) || Date.parse(draft.expiresAt) <= Date.parse(input.nowIso))) return { ok: false, reason: "Approval expired" };
  const checked = validateMuseProjectPlan(plan);
  if (!checked.ok) return { ok: false, reason: checked.errors.join("; ") };
  return { ok: true };
}

export function canEditPlan(status: PlanDraftState): boolean { return status === "draft"; }
export function canSubmitPlan(status: PlanDraftState): boolean { return status === "draft"; }
export function canApprovePlan(status: PlanDraftState): boolean { return status === "pending_approval"; }
