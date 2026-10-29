"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildMuseProjectPlan, parseMuseProjectPlan, projectGuideEnabled, UUID_PATTERN } from "@/lib/muse-project-guide-runtime";

type GuideSupabase = Awaited<ReturnType<typeof createClient>>;
const string = (v: FormDataEntryValue | null) => typeof v === "string" ? v.trim() : "";
const base = (projectId: string) => "/muse/project-guide?mode=connected&project=" + encodeURIComponent(projectId);
const toNumber = (v: string) => /^\d{1,9}$/.test(v) ? Number(v) : -1;
async function guard(): Promise<GuideSupabase> {
  await requireAdmin();
  if (!projectGuideEnabled()) throw new Error("Muse Project Guide connected mode is disabled");
  return createClient();
}
async function getProject(supabase: GuideSupabase, id: string) {
  if (!UUID_PATTERN.test(id)) throw new Error("Invalid project");
  const { data, error } = await supabase.from("projects").select("id,name,muse_revision").eq("id", id).single();
  if (error || !data || !Number.isSafeInteger(data.muse_revision)) throw new Error("Project or migration unavailable");
  return data as { id: string; name: string; muse_revision: number };
}
async function getDraft(supabase: GuideSupabase, projectId: string, draftId: string) {
  if (!UUID_PATTERN.test(draftId)) throw new Error("Invalid draft");
  const { data, error } = await supabase.from("muse_project_plan_drafts")
    .select("id,project_id,plan_version,base_project_revision,status,plan,approved_hash")
    .eq("id", draftId).eq("project_id", projectId).single();
  if (error || !data) throw new Error("Draft unavailable");
  return data;
}
async function invoke(supabase: GuideSupabase, name: string, parameters: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, parameters);
  if (error) throw new Error("Muse operation rejected by the approval guard");
  return data;
}
function refresh(projectId: string, event: string) {
  revalidatePath("/muse/project-guide");
  revalidatePath("/projects/" + projectId);
  redirect(base(projectId) + "&result=" + event);
}
function ids(form: FormData) {
  const projectId = string(form.get("project_id"));
  const draftId = string(form.get("draft_id"));
  if (!UUID_PATTERN.test(projectId) || !UUID_PATTERN.test(draftId)) throw new Error("Invalid plan context");
  return { projectId, draftId };
}

export async function createMuseProjectDraft(form: FormData) {
  const supabase = await guard();
  const projectId = string(form.get("project_id"));
  const project = await getProject(supabase, projectId);
  const plan = buildMuseProjectPlan(project);
  await invoke(supabase, "muse_create_project_plan", { p_project_id: project.id, p_plan: plan });
  refresh(project.id, "created");
}

export async function renameMuseDraftTask(form: FormData) {
  const supabase = await guard();
  const { projectId, draftId } = ids(form);
  const project = await getProject(supabase, projectId);
  const draft = await getDraft(supabase, projectId, draftId);
  const expectedVersion = toNumber(string(form.get("expected_version")));
  if (expectedVersion < 1 || draft.status !== "draft" || draft.plan_version !== expectedVersion ||
    draft.base_project_revision !== project.muse_revision) throw new Error("Draft changed; reload before editing");
  const title = string(form.get("title"));
  const taskTempId = string(form.get("task_temp_id"));
  if (title.length < 2 || title.length > 160 || taskTempId.length > 64) throw new Error("Invalid task title");
  const plan = parseMuseProjectPlan(draft.plan);
  if (!plan || plan.projectId !== projectId || plan.projectRevision !== project.muse_revision)
    throw new Error("Draft schema mismatch");
  const task = plan.phases.flatMap(p => p.tasks).find(t => t.tempId === taskTempId);
  if (!task) throw new Error("Unknown task");
  task.title = title;
  await invoke(supabase, "muse_edit_project_plan", {
    p_draft_id: draftId, p_expected_version: expectedVersion, p_plan: plan,
  });
  refresh(projectId, "edited");
}

export async function submitMuseProjectDraft(form: FormData) {
  const supabase = await guard();
  const { projectId, draftId } = ids(form);
  await getProject(supabase, projectId);
  const draft = await getDraft(supabase, projectId, draftId);
  const version = toNumber(string(form.get("expected_version")));
  if (version < 1 || draft.plan_version !== version || draft.status !== "draft") throw new Error("Draft version mismatch");
  await invoke(supabase, "muse_submit_project_plan", { p_draft_id: draftId, p_expected_version: version });
  refresh(projectId, "submitted");
}

export async function approveMuseProjectDraft(form: FormData) {
  const supabase = await guard();
  const { projectId, draftId } = ids(form);
  const project = await getProject(supabase, projectId);
  const draft = await getDraft(supabase, projectId, draftId);
  const version = toNumber(string(form.get("expected_version")));
  const expectedHash = string(form.get("expected_hash"));
  if (string(form.get("confirm_review")) !== "yes" ||
    !/^[0-9a-f]{64}$/.test(expectedHash) ||
    draft.status !== "pending_approval" || draft.plan_version !== version ||
    draft.base_project_revision !== project.muse_revision)
    throw new Error("Review or approval conditions unmet");
  const { data: reviewRows, error } = await supabase.rpc("muse_review_project_plan", { p_draft_id: draftId });
  const review = Array.isArray(reviewRows) ? reviewRows[0] : null;
  if (error || !review || review.plan_version !== version || review.plan_digest !== expectedHash)
    throw new Error("Plan preview differs from current version");
  await invoke(supabase, "muse_approve_project_plan", {
    p_draft_id: draftId, p_expected_version: version, p_expected_hash: expectedHash,
  });
  refresh(projectId, "approved");
}

export async function applyMuseProjectDraft(form: FormData) {
  const supabase = await guard();
  const { projectId, draftId } = ids(form);
  const project = await getProject(supabase, projectId);
  const draft = await getDraft(supabase, projectId, draftId);
  const version = toNumber(string(form.get("expected_version")));
  const hash = string(form.get("expected_hash"));
  if (string(form.get("confirm_apply")) !== "yes" ||
    !/^[0-9a-f]{64}$/.test(hash) || draft.status !== "approved" ||
    draft.plan_version !== version || draft.approved_hash !== hash ||
    draft.base_project_revision !== project.muse_revision)
    throw new Error("Apply confirmation or revision conditions unmet");
  await invoke(supabase, "muse_apply_project_plan", {
    p_draft_id: draftId, p_expected_version: version, p_expected_hash: hash,
  });
  refresh(projectId, "applied");
}

export async function rejectMuseProjectDraft(form: FormData) {
  const supabase = await guard();
  const { projectId, draftId } = ids(form);
  await getProject(supabase, projectId);
  const draft = await getDraft(supabase, projectId, draftId);
  if (!["draft", "pending_approval", "approved"].includes(draft.status)) throw new Error("Draft already finalized");
  await invoke(supabase, "muse_reject_project_plan", { p_draft_id: draftId });
  refresh(projectId, "rejected");
}
