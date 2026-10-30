import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { checkMuseRateLimit } from "@/lib/muse-ai-rate-limit";
import { ALLOWED_MODELS, boundedText } from "@/lib/muse-ai-runner";
import { buildProjectPlanRequest, extractPlanFromResponse } from "@/lib/muse-project-guide";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const error = (message: string, status: number, extra: Record<string, string> = {}) =>
  NextResponse.json({ error: message }, { status, headers: { ...HEADERS, ...extra } });

async function parsePayload(request: NextRequest) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new Error("mime");
  if (Number(request.headers.get("content-length") || 0) > 8000) throw new Error("large");
  const raw = await boundedText(request.body, 8000);
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

  if (action === "apply") {
    const planId = typeof payload.plan_id === "string" ? payload.plan_id : "";
    if (!UUID.test(planId)) return error("Select a valid Muse plan.", 400);
    try {
      const { data, error: applyError } = await db.rpc("apply_muse_project_plan", { target_plan_id: planId });
      const result = Array.isArray(data) ? data[0] as { applied_plan_id?: unknown; applied_project_id?: unknown; created_count?: unknown } | undefined : undefined;
      if (applyError || result?.applied_plan_id !== planId || result.applied_project_id !== projectId || !Number.isInteger(result.created_count)) throw new Error("apply_failed");
      revalidatePath(`/projects/${projectId}`);
      return NextResponse.json({ plan_id: planId, created_count: result.created_count }, { headers: HEADERS });
    } catch {
      return error("Muse couldn't apply that plan. It may be stale; generate a fresh version and review it again.", 409);
    }
  }

  if (action !== "draft") return error("Choose a supported Project Guide action.", 400);
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
    }).select("id,status,expires_at").single();
    if (saveError || !saved?.id || saved.status !== "draft") throw new Error("save_failed");
    return NextResponse.json({ plan_id: saved.id, expires_at: saved.expires_at, ...plan }, { headers: HEADERS });
  } catch {
    return error("Muse couldn't build a verified project plan. Try a smaller objective.", 502);
  }
}
