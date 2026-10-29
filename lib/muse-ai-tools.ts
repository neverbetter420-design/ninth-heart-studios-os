import "server-only";
import { createClient } from "@/lib/supabase/server";

// Five intentionally bounded, read-only queries. Never offer the model SQL,
// database identifiers as input parameters, credentials, or write operations.
export const MUSE_READ_TOOLS = [
  { name: "studio_overview", description: "Get a short factual overview of current leads, active projects and opportunities." },
  { name: "lead_priorities", description: "Get current lead priorities and next actions. Use for pipeline and follow-up questions." },
  { name: "project_watch", description: "Get active projects and upcoming deadlines. Use for project bottlenecks and delivery planning." },
  { name: "prospect_comparison", description: "Compare saved scanner prospects using stored scores and verified evidence only." },
  { name: "opportunity_radar", description: "Review saved freelance marketplace opportunities and their recorded fit scores." },
] as const;

export type MuseReadTool = (typeof MUSE_READ_TOOLS)[number]["name"];
export type MuseSource = { label: string; href: string };
export type MuseEvidence = {
  tool: MuseReadTool;
  rows: Record<string, unknown>[];
  sources: MuseSource[];
  note: string;
  partial?: boolean;
};

const short = (value: unknown, max = 120) =>
  typeof value === "string" ? value.replace(/[\r\n\t]+/g, " ").slice(0, max) : null;
const safeId = (value: unknown) =>
  typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
const score = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function evidence(
  tool: MuseReadTool,
  rows: Record<string, unknown>[],
  prefix: string,
  title: string,
  note: string,
  partial = false,
): MuseEvidence {
  return {
    tool, rows, note, partial,
    sources: rows.flatMap(row => {
      const id = safeId(row.id);
      return id ? [{ label: String(row[title] ?? "Open record").slice(0, 80), href: `/${prefix}/${id}` }] : [];
    }).slice(0, 12),
  };
}

export async function runMuseReadTool(tool: MuseReadTool): Promise<MuseEvidence> {
  const db = await createClient(); // User session + existing table RLS; no service role.
  if (tool === "lead_priorities" || tool === "studio_overview") {
    const { data, error } = await db.from("leads")
      .select("id, business_name, status, momentum_state, score, next_action, next_action_due, last_activity_at, created_at")
      .neq("status", "not_interested")
      .order("updated_at", { ascending: false }).limit(18);
    const rows = (error ? [] : data ?? []).map(row => ({
      id: row.id, business_name: short(row.business_name), status: short(row.status),
      momentum_state: short(row.momentum_state), score: score(row.score),
      next_action: short(row.next_action, 180), next_action_due: row.next_action_due,
      last_activity_at: row.last_activity_at,
    }));
    if (tool === "lead_priorities") {
      return evidence(tool, rows, "leads", "business_name",
        error ? "Lead data unavailable: do not infer priorities." :
          "Most recently updated 18 non-declined leads. Ordering is recency, not a comprehensive risk ranking.", Boolean(error));
    }
    const [projects, opportunities] = await Promise.all([
      db.from("projects").select("id, name, status, due_date, updated_at")
        .order("updated_at", { ascending: false }).limit(12),
      db.from("opportunities").select("id, title, source, status, score")
        .neq("status", "closed").order("score", { ascending: false, nullsFirst: false }).limit(8),
    ]);
    const projectRows = (projects.error ? [] : projects.data ?? []).map(row => ({
      id: row.id, name: short(row.name), status: short(row.status),
      due_date: row.due_date, updated_at: row.updated_at,
    }));
    const opportunityRows = (opportunities.error ? [] : opportunities.data ?? []).map(row => ({
      id: row.id, title: short(row.title), source: short(row.source),
      status: short(row.status), score: score(row.score),
    }));
    return {
      tool, rows: [{ leads: rows, projects: projectRows, opportunities: opportunityRows }],
      sources: [
        ...evidence(tool, rows.slice(0, 4), "leads", "business_name", "").sources,
        ...evidence(tool, projectRows.slice(0, 4), "projects", "name", "").sources,
        ...evidence(tool, opportunityRows.slice(0, 4), "opportunities", "title", "").sources,
      ],
      note: "Bounded sample: up to 18 leads, 12 recent projects, 8 open opportunities. Not an exhaustive business report.",
      partial: Boolean(error || projects.error || opportunities.error),
    };
  }
  if (tool === "project_watch") {
    const { data, error } = await db.from("projects")
      .select("id, name, status, due_date, updated_at")
      .order("updated_at", { ascending: false }).limit(18);
    return evidence(tool, (error ? [] : data ?? []).map(row => ({
      id: row.id, name: short(row.name), status: short(row.status),
      due_date: row.due_date, updated_at: row.updated_at,
    })), "projects", "name",
      error ? "Project data unavailable." : "18 most recently updated projects; dates only, without an exhaustive tasks or approval audit.",
      Boolean(error));
  }
  if (tool === "prospect_comparison") {
    const { data, error } = await db.from("prospects")
      .select("id, business_name, category, status, opportunity_score, scanned_at, signals")
      .neq("status", "archived")
      .order("opportunity_score", { ascending: false, nullsFirst: false }).limit(15);
    return evidence(tool, (error ? [] : data ?? []).map(row => {
      const signals = row.signals && typeof row.signals === "object" ? row.signals : {};
      const checked = signals as Record<string, unknown>;
      return {
        id: row.id, business_name: short(row.business_name), category: short(row.category),
        status: short(row.status), opportunity_score: score(row.opportunity_score),
        scanned_at: row.scanned_at,
        has_website: typeof checked.has_website === "boolean" ? checked.has_website : null,
        social_profiles_verified: Array.isArray(checked.social_profiles)
          ? checked.social_profiles.filter(p => p && typeof p === "object" && (p as Record<string, unknown>).verified === true).length : null,
      };
    }), "leads/discover?prospect", "business_name",
      error ? "Scanner prospects unavailable." :
        "Top 15 active saved prospects by recorded score. Scores are leads indicators, not independently verified conclusions.",
      Boolean(error));
  }
  const { data, error } = await db.from("opportunities")
    .select("id, title, source, score, fit, status, updated_at")
    .neq("status", "closed")
    .order("score", { ascending: false, nullsFirst: false }).limit(15);
  return evidence("opportunity_radar", (error ? [] : data ?? []).map(row => ({
    id: row.id, title: short(row.title), source: short(row.source),
    score: score(row.score), fit: short(row.fit), status: short(row.status),
    updated_at: row.updated_at,
  })), "opportunities", "title",
    error ? "Opportunity data unavailable." : "Top 15 saved, non-closed opportunities by recorded fit score. No live marketplace browsing.",
    Boolean(error));
}
