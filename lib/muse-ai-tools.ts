import "server-only";
import { createClient } from "@/lib/supabase/server";
import { rankLeads, type FlowkeepLead } from "./flowkeep.ts";
import { buildChallengerShortlists, type SavedChallenger } from "./prospect-shortlists.ts";

// Models cannot choose SQL, columns, filters, URLs or record identifiers.
export const MUSE_READ_TOOLS = [
  { name: "studio_overview", description: "Review lead priorities, project tasks and approvals, and saved opportunities to suggest today's focus." },
  { name: "lead_priorities", description: "Read leads in deterministic attention order, with next actions and SLA evidence." },
  { name: "project_watch", description: "Read projects, unfinished tasks, milestones and pending approvals. On project detail pages review that project only." },
  { name: "prospect_comparison", description: "Compare qualified uncontacted saved prospects within each category using reliability-first ranking." },
  { name: "opportunity_radar", description: "Review saved freelance opportunities by recorded fit score and source. No live marketplace browsing." },
] as const;
export type MuseReadTool = (typeof MUSE_READ_TOOLS)[number]["name"];
export type MuseSource = { label: string; href: string };
export type MuseCoverage = { area: string; available: number | null; reviewed: number; complete: boolean };
export type MuseEvidence = {
  tool: MuseReadTool; rows: Record<string, unknown>[]; sources: MuseSource[];
  note: string; partial: boolean; coverage: MuseCoverage[];
};
export type MuseReadContext = { page: string; now: string; signal?: AbortSignal };
type Db = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;
type ReadResult = { rows: Row[]; available: number | null; complete: boolean };
const READ_CAP = 1000;
const short = (v: unknown, max = 120) => typeof v === "string" ? v.replace(/[\r\n\t]+/g, " ").slice(0, max) : null;
const id = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const number = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : null;
const date = (v: unknown) => typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : null;
const source = (label: unknown, href: string): MuseSource => ({ label: short(label, 80) ?? "Open record", href });
const coverage = (area: string, r: ReadResult): MuseCoverage => ({ area, available: r.available, reviewed: r.rows.length, complete: r.complete });

// Exact count detects lower PostgREST row caps as well as errors/large lists.
// Incomplete reads never become a zero count or a misleading global ranking.
type QueryResult = { data: Row[] | null; error: unknown; count: number | null };
type Query = PromiseLike<QueryResult> & { abortSignal(signal: AbortSignal): PromiseLike<QueryResult> };
async function read(query: Query, signal?: AbortSignal): Promise<ReadResult> {
  try {
    const { data, error, count } = await query.abortSignal(signal ?? AbortSignal.timeout(15000));
    const complete = !error && Array.isArray(data) && Number.isInteger(count) && count !== null && count <= READ_CAP && data.length === count;
    return { rows: complete ? data! : [], available: error ? null : count, complete };
  } catch { return { rows: [], available: null, complete: false }; }
}
export async function runMuseReadTool(tool: MuseReadTool, context: MuseReadContext): Promise<MuseEvidence> {
  const db = await createClient(); // Current user session and RLS only.
  return createMuseReader(db, context)(tool);
}

// Request-local cache and injectable client support tests without hosted data.
export function createMuseReader(db: Db, context: MuseReadContext) {
  const cache = new Map<MuseReadTool, Promise<MuseEvidence>>();
  const query = (q: Query) => read(q, context.signal);
  async function run(tool: MuseReadTool): Promise<MuseEvidence> {
    if (tool === "studio_overview") {
      const areas = await Promise.all([cached("lead_priorities"), cached("project_watch"), cached("opportunity_radar")]);
      return { tool, rows: areas.map(a => ({ area: a.tool, records: a.rows.slice(0, 6), note: a.note, partial: a.partial })),
        sources: areas.flatMap(a => a.sources.slice(0, 3)), coverage: areas.flatMap(a => a.coverage),
        note: "Current saved evidence only. Existing studio rules supply priorities and scores. Proposed actions are suggestions, never changes.",
        partial: areas.some(a => a.partial) };
    }
    if (tool === "lead_priorities") {
      const r = await query(db.from("leads").select(
        "id,business_name,status,momentum_state,score,next_action,next_action_kind,next_action_due,last_activity_at,created_at,updated_at,acquisition_type,original_inquiry_at,last_outreach_at,last_reply_at,consultation_at,last_outcome",
        { count: "exact" }).neq("status", "not_interested").order("id").range(0, READ_CAP - 1));
      const valid = r.rows.every(row => id(row.id) && date(row.created_at) && date(row.updated_at) &&
        [row.original_inquiry_at, row.next_action_due, row.last_activity_at, row.last_outreach_at, row.last_reply_at, row.consultation_at].every(v => v == null || !!date(v)));
      if (!valid) { r.complete = false; r.rows = []; }
      const ranked = rankLeads(r.rows as FlowkeepLead[], new Date(context.now)).slice(0, 18);
      return { tool, rows: ranked.map(row => ({
        id: row.id, business_name: short(row.business_name), status: short(row.status), momentum_state: short(row.momentum_state),
        score: number(row.score), next_action: short(row.actionTitle, 180), next_action_due: date(row.next_action_due),
        priority: row.priorityLabel, sla: row.sla, last_activity_at: date(row.last_activity_at),
      })), sources: ranked.map(row => source(row.business_name, `/leads/${row.id}`)),
        coverage: [coverage("leads", r)], partial: !r.complete,
        note: r.complete ? "Up to 18 leads in canonical Flowkeep attention order from a complete bounded read. A score is not a conversion probability." : "Lead evidence unavailable or incomplete. No priority ranking can be inferred." };
    }
    if (tool === "project_watch") {
      const match = /^\/projects\/([0-9a-f-]{36})$/i.exec(context.page);
      const projectId = match && id(match[1]) ? match[1] : null;
      let q = db.from("projects").select("id,name,status,due_date,updated_at", { count: "exact" });
      if (projectId) q = q.eq("id", projectId);
      const projects = await query(q.order("id").range(0, READ_CAP - 1));
      const ids = projects.rows.map(row => row.id).filter(id);
      if (ids.length !== projects.rows.length) { projects.complete = false; projects.rows = []; }
      const empty: ReadResult = { rows: [], available: projects.complete ? 0 : null, complete: projects.complete };
      const [tasks, milestones, approvals] = projects.complete && ids.length ? await Promise.all([
        query(db.from("tasks").select("id,project_id,title,status,priority,due_at", { count: "exact" }).in("project_id", ids).neq("status", "complete").order("id").range(0, READ_CAP - 1)),
        query(db.from("milestones").select("id,project_id,title,status,due_date", { count: "exact" }).in("project_id", ids).neq("status", "complete").order("id").range(0, READ_CAP - 1)),
        query(db.from("approvals").select("id,project_id,title,status,requested_at", { count: "exact" }).in("project_id", ids).eq("status", "pending").order("id").range(0, READ_CAP - 1)),
      ]) : [empty, empty, empty];
      const complete = [projects, tasks, milestones, approvals].every(r => r.complete);
      const dueOrder = (a: Row, b: Row) => (Date.parse(String(a.due_at ?? a.due_date)) || Infinity) - (Date.parse(String(b.due_at ?? b.due_date)) || Infinity);
      const rows = complete ? [...projects.rows].sort((a, b) =>
        Number(b.status === "on_hold") - Number(a.status === "on_hold") || dueOrder(a, b) || String(a.id).localeCompare(String(b.id)),
      ).slice(0, 18).map(p => {
        const related = (items: ReadResult) => items.rows.filter(t => t.project_id === p.id);
        const openTasks = related(tasks), pending = related(approvals), openMilestones = related(milestones);
        return { id: p.id, name: short(p.name), status: short(p.status), due_date: date(p.due_date),
          open_task_count: openTasks.length, pending_approval_count: pending.length, open_milestone_count: openMilestones.length,
          blocked_task_count: openTasks.filter(t => t.status === "blocked").length,
          overdue_task_count: openTasks.filter(t => date(t.due_at) && Date.parse(String(t.due_at)) < Date.parse(context.now)).length,
          tasks: openTasks.sort((a, b) => Number(b.status === "blocked") - Number(a.status === "blocked") || dueOrder(a, b)).slice(0, 5).map(t => ({ title: short(t.title), status: short(t.status), priority: short(t.priority), due_at: date(t.due_at) })),
          milestones: openMilestones.sort(dueOrder).slice(0, 3).map(m => ({ title: short(m.title), status: short(m.status), due_date: date(m.due_date) })),
          pending_approvals: pending.sort((a, b) => String(a.requested_at).localeCompare(String(b.requested_at))).slice(0, 3).map(a => ({ title: short(a.title), requested_at: date(a.requested_at) })),
        };
      }) : [];
      return { tool, rows, sources: rows.map(p => source(p.name, `/projects/${p.id}`)),
        coverage: [coverage("projects", projects), coverage("unfinished tasks", tasks), coverage("unfinished milestones", milestones), coverage("pending approvals", approvals)],
        partial: !complete,
        note: complete ? `${projectId ? "Current project only." : "Up to 18 projects, on-hold first then earliest project due date."} Counts use complete bounded reads; details show at most 5 tasks, 3 milestones and 3 pending approvals per project. Pending is not proof of a blocker; due dates are not payment evidence.` : "Project review unavailable: at least one related read is incomplete. Do not infer tasks, milestones or approvals are clear." };
    }
    if (tool === "prospect_comparison") {
      const r = await query(db.from("prospects").select(
        "id,source_ref,business_name,category,address,phone,website,signals,opportunity_score,status,outreach_status,outreach_draft,scanned_at",
        { count: "exact" }).eq("status", "new").order("id").range(0, READ_CAP - 1));
      const valid = r.rows.every(p => id(p.id) && typeof p.business_name === "string" &&
        [p.source_ref, p.category, p.address, p.phone, p.website, p.outreach_draft].every(v => v == null || typeof v === "string") &&
        (p.signals == null || (typeof p.signals === "object" && !Array.isArray(p.signals) &&
        (!("social_profiles" in p.signals) || (Array.isArray(p.signals.social_profiles) && p.signals.social_profiles.every(s =>
          s && typeof s === "object" && typeof s.status === "string" && typeof s.platform === "string"))))));
      if (!valid) { r.complete = false; r.rows = []; }
      const groups = r.complete ? buildChallengerShortlists(r.rows as SavedChallenger[], 3) : [];
      const originals = new Map(r.rows.map(p => [p.id, p]));
      const rows = groups.map(g => ({ category: g.category, considered: g.considered, qualified: g.qualified,
        top: g.top.map(p => ({ ...p, business_name: short(p.business_name), scanned_at: date(originals.get(p.id)?.scanned_at) })),
      }));
      return { tool, rows, sources: groups.filter(g => g.top.length).map(g => source(`${g.category.replace(/_/g, " ")} best fits`, `/leads/discover?workspace=best&category=${g.category}`)),
        coverage: [coverage("saved new prospects", r)], partial: !r.complete,
        note: r.complete ? "Top 3 per category from all saved new prospects in the bounded read; excludes drafted, sent, archived, promoted and uncontactable records. Ranking: 70% public contact reliability + 30% recorded opportunity. Reliability is not verified ownership or likelihood of paying. Social matches use recorded status=matched; no live checks ran." : "Prospect read incomplete. Withholding comparison rather than ranking a sample." };
    }
    if (tool !== "opportunity_radar") throw new Error("unsupported_tool");
    const r = await query(db.from("opportunities").select("id,title,source,score,fit,status,updated_at", { count: "exact" })
      .neq("status", "closed").order("id").range(0, READ_CAP - 1));
    const rows = r.rows.filter(o => id(o.id)).sort((a, b) => (number(b.score) ?? -1) - (number(a.score) ?? -1) || String(a.id).localeCompare(String(b.id))).slice(0, 15)
      .map(o => ({ id: o.id, title: short(o.title), source: short(o.source), score: number(o.score), fit: short(o.fit), status: short(o.status), updated_at: date(o.updated_at) }));
    return { tool, rows, sources: rows.map(o => source(o.title, `/opportunities/${o.id}`)),
      coverage: [coverage("saved open opportunities", r)], partial: !r.complete,
      note: r.complete ? "Top 15 saved non-closed opportunities by recorded score. Sources are stored labels, not connected accounts. No live Fiverr/Upwork/Freelancer browsing; absence is not proof no jobs exist." : "Saved opportunity evidence unavailable or incomplete." };
  }
  function cached(tool: MuseReadTool): Promise<MuseEvidence> {
    if (!cache.has(tool)) cache.set(tool, run(tool));
    return cache.get(tool)!;
  }
  return cached;
}
