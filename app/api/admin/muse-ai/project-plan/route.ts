import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { checkMuseRateLimit } from "@/lib/muse-ai-rate-limit";
import { ALLOWED_MODELS, boundedText } from "@/lib/muse-ai-runner";
import { buildProjectPlanRequest, extractPlanFromResponse, parseMuseProjectPlan } from "@/lib/muse-project-guide";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const error = (message: string, status: number, extra: Record<string, string> = {}) =>
  NextResponse.json({ error: message }, { status, headers: { ...HEADERS, ...extra } });

async function parsePayload(request: NextRequest) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new Error("mime");
  if (Number(request.headers.get("content-length") || 0) > 65536) throw new Error("large");
  const raw = await boundedText(request.body, 65536);
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("body");
  return value as Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const auth = await getCurrentAuth();
  if (!auth.user) return error("Sign in to use Muse Project Guide.", 401);
  if (!auth.profile?.active || auth.profile.role !== "admin") return error("Admin access required.", 403);
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return error("Invalid request origin.", 403);

  let payload: Record<string, unknown>;
  try {
    payload = await parsePayload(request);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "body";
    if (message === "mime") return error("Send a JSON request.", 415);
    if (message === "large" || message === "body_too_large") return error("Request too large.", 413);
    return error("Invalid request body.", 400);
  }

  if (process.env.MUSE_PROJECT_GUIDE_ENABLED !== "true") {
    return error("Muse Project Guide is in private preview and has not been enabled yet.", 503);
  }
  const action = payload.action;
  const projectId = typeof payload.project_id === "string" ? payload.project_id : "";
  if (!UUID.test(projectId)) return error("Select a valid project.", 400);
  const db = await createClient();

  // Reading an existing proposal requires neither a model configuration nor
  // an external provider call. RLS + owner and project filters are mandatory.
  if (action === "load_latest") {
    const { data: saved, error: loadError } = await db.from("muse_project_plans")
      .select("id,project_id,created_by,status,current_revision,expires_at,plan")
      .eq("project_id", projectId).eq("created_by", auth.user.id).eq("status", "draft")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (loadError) return error("Couldn't securely load the saved Muse proposal.", 503);
    if (!saved) return error("No active saved Muse draft exists for this project.", 404);
    try {
      const clean = parseMuseProjectPlan(saved.plan);
      if (!UUID.test(saved.id) || saved.project_id !== projectId || saved.created_by !== auth.user.id ||
        saved.status !== "draft" || !Number.isSafeInteger(saved.current_revision) ||
        saved.current_revision < 1 || saved.current_revision > 25 ||
        !Number.isFinite(Date.parse(saved.expires_at)) || Date.parse(saved.expires_at) <= Date.now()) {
        throw new Error("invalid_saved_plan");
      }
      return NextResponse.json({
        plan_id: saved.id, project_id: projectId,
        revision: saved.current_revision, expires_at: saved.expires_at, ...clean,
      }, { headers: HEADERS });
    } catch {
      return error("The saved plan is inconsistent. Approval is blocked.", 409);
    }
  }

  if (action === "apply" || action === "save_revision") {
    const planId = typeof payload.plan_id === "string" ? payload.plan_id : "";
    const expectedRevision = payload.expected_revision;
    if (!UUID.test(planId) || !Number.isSafeInteger(expectedRevision)
      || Number(expectedRevision) < 1 || Number(expectedRevision) > 25) {
      return error("Select an exact saved Muse plan revision.", 400);
    }
    if (action === "apply") {
      const expectedCount = payload.expected_count;
      if (!Number.isSafeInteger(expectedCount) || Number(expectedCount) < 1 || Number(expectedCount) > 48) {
        return error("Review the complete proposed task count.", 400);
      }
      try {
        const { data, error: applyError } = await db.rpc("apply_muse_project_plan", {
          target_plan_id: planId, target_project_id: projectId,
          expected_revision: expectedRevision as number, expected_count: expectedCount as number,
        });
        const result = Array.isArray(data) ? data[0] as {
          applied_plan_id?: unknown; applied_project_id?: unknown;
          applied_revision?: unknown; created_count?: unknown;
        } | undefined : undefined;
        if (applyError || result?.applied_plan_id !== planId ||
          result.applied_project_id !== projectId || result.applied_revision !== expectedRevision ||
          result.created_count !== expectedCount) throw new Error("apply_failed");
        revalidatePath(`/projects/${projectId}`);
        return NextResponse.json({
          plan_id: planId, applied_revision: expectedRevision, created_count: expectedCount,
        }, { headers: HEADERS });
      } catch {
        return error("Muse couldn't apply that exact revision. Reload the saved plan and review again.", 409);
      }
    }
    if (Number(expectedRevision) >= 25) return error("Muse plan has reached its revision limit.", 409);
    const changeNote = typeof payload.change_note === "string" ? payload.change_note.trim() : "";
    if (changeNote.length < 2 || changeNote.length > 250) return error("Describe your edit in 2 to 250 characters.", 400);
    let proposed;
    try { proposed = parseMuseProjectPlan(payload.plan); }
    catch { return error("The revised plan contains invalid tasks or subtasks.", 400); }
    try {
      const { data, error: saveError } = await db.rpc("save_muse_project_plan_revision", {
        target_plan_id: planId, target_project_id: projectId,
        expected_revision: expectedRevision as number, updated_plan: proposed, change_note: changeNote,
      });
      const result = Array.isArray(data) ? data[0] as {
        saved_plan_id?: unknown; saved_project_id?: unknown;
        saved_revision?: unknown; saved_plan?: unknown; expires_at?: unknown;
      } | undefined : undefined;
      if (saveError || result?.saved_plan_id !== planId || result.saved_project_id !== projectId ||
        result.saved_revision !== Number(expectedRevision) + 1 ||
        typeof result.expires_at !== "string") throw new Error("save_failed");
      const stored = parseMuseProjectPlan(result.saved_plan);
      if (JSON.stringify(stored) !== JSON.stringify(proposed)) throw new Error("save_mismatch");
      return NextResponse.json({
        plan_id: planId, project_id: projectId,
        revision: result.saved_revision, expires_at: result.expires_at, ...stored,
      }, { headers: HEADERS });
    } catch {
      return error("Muse could not save that revision. It may be stale; reload before editing.", 409);
    }
  }

  if (action !== "draft") return error("Choose a supported Project Guide action.", 400);
  if ((process.env.MUSE_AI_PROVIDER || "openai") !== "openai") {
    return error("Project-plan generation is unavailable in the free preview; saved draft review stays offline.", 503);
  }
  const objective = typeof payload.objective === "string" ? payload.objective.trim() : "";
  if (objective.length < 2 || objective.length > 500) return error("Describe the project objective in 2 to 500 characters.", 400);
  const key = process.env.OPENAI_API_KEY;
  if (!key) return error("Muse AI is not configured yet.", 503);
  const model = process.env.OPENAI_MUSE_MODEL || "gpt-6.1-sol";
  if (!ALLOWED_MODELS.includes(model)) return error("Muse model configuration is invalid.", 503);
  const limit = await checkMuseRateLimit(auth.user.id);
  if (limit === "limited") return error("Muse needs a short breather. Try again in a minute.", 429, { "Retry-After": "60" });
  if (limit !== "allowed") return error("Muse request controls are unavailable. Please try again later.", 503);

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(45000)]);
  const now = new Date().toISOString();
  try {
    const [projectResult, tasksResult, milestonesResult, approvalsResult] = await Promise.all([
      db.from("projects").select("id,name,status,progress,due_date,internal_notes").eq("id", projectId).abortSignal(signal).maybeSingle(),
      db.from("tasks").select("id,title,status,priority,due_at,parent_task_id,description,definition_of_done,estimated_minutes", { count: "exact" })
        .eq("project_id", projectId).order("position").range(0, 199).abortSignal(signal),
      db.from("milestones").select("id,title,status,due_date", { count: "exact" })
        .eq("project_id", projectId).order("position").range(0, 99).abortSignal(signal),
      db.from("approvals").select("id,title,status,requested_at", { count: "exact" })
        .eq("project_id", projectId).eq("status", "pending").order("requested_at").range(0, 99).abortSignal(signal),
    ]);
    if (projectResult.error || !projectResult.data || tasksResult.error || milestonesResult.error || approvalsResult.error ||
        tasksResult.count !== tasksResult.data?.length || milestonesResult.count !== milestonesResult.data?.length ||
        approvalsResult.count !== approvalsResult.data?.length || (tasksResult.count ?? 201) > 200 ||
        (milestonesResult.count ?? 101) > 100 || (approvalsResult.count ?? 101) > 100) {
      return error("Project evidence is incomplete. Muse won't build a plan from a partial record.", 409);
    }

    const modelBody = buildProjectPlanRequest({
      model, objective, now,
      project: projectResult.data as Record<string, unknown>,
      tasks: (tasksResult.data ?? []) as Record<string, unknown>[],
      milestones: (milestonesResult.data ?? []) as Record<string, unknown>[],
      approvals: (approvalsResult.data ?? []) as Record<string, unknown>[],
    });
    const provider = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(modelBody),
    });
    if (!provider.ok) { await provider.body?.cancel(); throw new Error("model_unavailable"); }
    const plan = extractPlanFromResponse(JSON.parse(await boundedText(provider.body, 256000)));
    const { data: saved, error: saveError } = await db.from("muse_project_plans").insert({
      project_id: projectId,
      objective,
      summary: plan.summary,
      plan,
      source_model: model,
      evidence_checked_at: now,
      created_by: auth.user.id,
    }).select("id,status,expires_at,current_revision").single();
    if (saveError || !saved?.id || saved.status !== "draft" || saved.current_revision !== 1) throw new Error("save_failed");
    return NextResponse.json({ plan_id: saved.id, project_id: projectId, revision: 1, expires_at: saved.expires_at, ...plan }, { headers: HEADERS });
  } catch {
    return error("Muse couldn't build a verified project plan. Try a smaller objective.", 502);
  }
}
