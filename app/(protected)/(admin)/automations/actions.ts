"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  runApprovalNudge,
  runProjectRiskScan,
  runSlaWatch,
  runStaleLeadDigest,
  type AutomationResult,
} from "@/lib/automations";
import type { ProjectRiskInput } from "@/lib/muse";
import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

/** Kill switch: enable or disable an automation. Disabled = it never runs on its own. */
export async function toggleAutomation(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = clean(formData.get("automation_id"));
  const enabled = formData.get("enabled") === "true";
  if (!id) return;

  await supabase
    .from("automations")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/automations");
}

export async function markNotificationRead(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = clean(formData.get("notification_id"));
  if (!id) return;
  await supabase.from("notifications").update({ read: true }).eq("id", id);
  revalidatePath("/automations");
}

export async function markAllNotificationsRead() {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read: true }).eq("read", false);
  revalidatePath("/automations");
}

/**
 * Run an automation now. Manual runs work even when disabled (a human clicked
 * the button); the audit log records every run either way. Scheduled runs
 * would check the enabled flag first — that's the kill switch.
 */
export async function runAutomation(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const key = clean(formData.get("automation_key"));
  if (!key) return;

  const { data: automation } = await supabase
    .from("automations")
    .select("id, key, config")
    .eq("key", key)
    .single();
  if (!automation) return;

  const startedAt = new Date().toISOString();
  let result: AutomationResult;
  let status: "ok" | "error" | "skipped" = "ok";

  try {
    result = await executeAutomation(supabase, key, (automation.config as Record<string, unknown>) ?? {});
  } catch (err) {
    status = "error";
    result = {
      notifications: [],
      summary: `Run failed: ${err instanceof Error ? err.message : "unknown error"}`,
      details: {},
    };
  }

  const finishedAt = new Date().toISOString();

  // Write notifications (in-app only — nothing leaves the studio).
  if (result.notifications.length > 0) {
    await supabase.from("notifications").insert(
      result.notifications.map((n) => ({
        title: n.title,
        body: n.body,
        href: n.href,
        kind: n.kind,
      })),
    );
  }

  // Audit trail.
  await supabase.from("automation_runs").insert({
    automation_id: automation.id,
    started_at: startedAt,
    finished_at: finishedAt,
    status,
    summary: result.summary,
    details: result.details,
  });

  await supabase
    .from("automations")
    .update({ last_run_at: finishedAt, last_status: status, updated_at: finishedAt })
    .eq("id", automation.id);

  revalidatePath("/automations");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeAutomation(supabase: any, key: string, config: Record<string, unknown>): Promise<AutomationResult> {
  const now = new Date();

  if (key === "stale_lead_digest" || key === "sla_watch") {
    const { data: leads } = await supabase
      .from("leads")
      .select(
        "id, business_name, contact_name, email, phone, website, acquisition_type, momentum_state, score, status, next_action, next_action_kind, next_action_due, original_inquiry_at, last_outreach_at, last_reply_at, last_activity_at, consultation_at, last_outcome, created_at, updated_at",
      );
    if (key === "stale_lead_digest") {
      const threshold = Number(config.threshold_days) || 7;
      return runStaleLeadDigest((leads ?? []) as never[], threshold, now);
    }
    return runSlaWatch((leads ?? []) as never[], now);
  }

  if (key === "project_risk_scan") {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, name, status, due_date")
      .not("status", "in", "(care,archived)");
    const inputs: ProjectRiskInput[] = await Promise.all(
      ((projects ?? []) as { id: string; name: string; status: string; due_date: string | null }[]).map(
        async (p) => {
          const [{ data: milestones }, { data: tasks }, { data: activities }, { data: approvals }] =
            await Promise.all([
              supabase.from("milestones").select("title, status, due_date").eq("project_id", p.id),
              supabase.from("tasks").select("title, status, due_at").eq("project_id", p.id),
              supabase
                .from("activities")
                .select("created_at")
                .eq("project_id", p.id)
                .order("created_at", { ascending: false })
                .limit(1),
              supabase.from("approvals").select("id").eq("project_id", p.id).eq("status", "pending"),
            ]);
          return {
            id: p.id,
            name: p.name,
            status: p.status,
            dueDate: p.due_date,
            lastActivityAt: (activities?.[0] as { created_at: string } | undefined)?.created_at ?? null,
            milestones: ((milestones ?? []) as { title: string; status: string; due_date: string | null }[]).map((m) => ({
              title: m.title,
              status: m.status,
              dueDate: m.due_date,
            })),
            tasks: ((tasks ?? []) as { title: string; status: string; due_at: string | null }[]).map((t) => ({
              title: t.title,
              status: t.status,
              dueDate: t.due_at,
            })),
            pendingApprovals: (approvals ?? []).length,
          };
        },
      ),
    );
    return runProjectRiskScan(inputs, now);
  }

  if (key === "approval_nudge") {
    const pendingDays = Number(config.pending_days) || 3;
    const { data: approvals } = await supabase
      .from("approvals")
      .select("id, title, project_id, requested_at, projects(name)")
      .eq("status", "pending");
    const inputs = ((approvals ?? []) as {
      id: string;
      title: string;
      project_id: string;
      requested_at: string;
      projects: { name: string } | { name: string }[] | null;
    }[]).map((a) => ({
      id: a.id,
      title: a.title,
      project_id: a.project_id,
      project_name: Array.isArray(a.projects) ? (a.projects[0]?.name ?? "Unknown") : (a.projects?.name ?? "Unknown"),
      requested_at: a.requested_at,
    }));
    return runApprovalNudge(inputs, pendingDays, now);
  }

  return { notifications: [], summary: `Unknown automation key: ${key}`, details: {} };
}
