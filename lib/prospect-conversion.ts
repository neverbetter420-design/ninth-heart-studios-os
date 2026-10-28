// Read-only outcomes tied to scanner-origin leads.
// Promotion is NOT a reply, a scheduled consultation is NOT an attended meeting,
// and a project-created event is NOT revenue or confirmed payment.
import { categoryBucket } from "./prospect-curation.ts";
import type { NicheKey } from "./prospect-scan.ts";

type Category = NicheKey | "other";
const CATEGORIES: Category[] = [
  "restaurants", "bars", "cafes", "salons", "contractors", "auto_repair", "fitness", "other",
];
export type ScannerOutcomeProspect = {
  id: string;
  category: string | null;
  source_ref?: string | null;
  status: string;
  outreach_status: string | null;
  lead_id: string | null;
};
export type ScannerOutcomeLead = {
  id: string;
  status: string | null;
  last_reply_at: string | null;
  consultation_at: string | null;
  metadata: unknown;
};
export type ScannerProjectEvent = {
  lead_id: string | null;
  project_id: string | null;
  event_type: string | null;
};
export type CategoryOutcome = {
  category: Category;
  saved_records: number;
  drafts_open: number;
  marked_sent: number;
  linked_leads: number;
  replies_recorded: number;
  consultations_scheduled: number;
  projects_created: number;
  declined: number;
};
export type ScannerOutcomeSnapshot = {
  totals: Omit<CategoryOutcome, "category">;
  categories: CategoryOutcome[];
  unmatched_promotions: number;
};
const blank = (category: Category): CategoryOutcome => ({
  category, saved_records: 0, drafts_open: 0, marked_sent: 0,
  linked_leads: 0, replies_recorded: 0, consultations_scheduled: 0,
  projects_created: 0, declined: 0,
});
const hasRecordedDate = (s: string | null | undefined) =>
  typeof s === "string" && !!s.trim() && Number.isFinite(Date.parse(s));
const metaFor = (m: unknown): { source?: unknown; prospect_id?: unknown } | null =>
  m && typeof m === "object" && !Array.isArray(m) ? m as { source?: unknown; prospect_id?: unknown } : null;

/** Requires COMPLETE capped reads of prospects, leads and project-created
 * activities, enforced in the protected page. No CRM write or causal inference.
 */
export function buildScannerOutcomeSnapshot(
  prospects: ScannerOutcomeProspect[],
  leads: ScannerOutcomeLead[],
  events: ScannerProjectEvent[],
): ScannerOutcomeSnapshot {
  const groups = new Map(CATEGORIES.map(k => [k, blank(k)]));
  const saved = new Map<string, ScannerOutcomeProspect>();
  for (const p of prospects) if (typeof p.id === "string" && p.id) saved.set(p.id, p);
  const projectsByLead = new Set(events.filter(e => e.event_type === "project_created" &&
      typeof e.lead_id === "string" && e.lead_id &&
      typeof e.project_id === "string" && e.project_id)
    .map(e => e.lead_id as string));
  const linked = new Map<string, ScannerOutcomeLead>();
  const linksPerLead = new Map<string, number>();
  const knownLeads = new Map(leads.filter(l => typeof l.id === "string" && l.id).map(l => [l.id, l]));
  for (const p of saved.values()) {
    const g = groups.get(categoryBucket(p.category))!;
    g.saved_records++;
    if (p.outreach_status === "drafted") g.drafts_open++;
    if (p.outreach_status === "sent") g.marked_sent++;
    if (p.status !== "promoted" || !p.lead_id) continue;
    const lead = knownLeads.get(p.lead_id);
    const metadata = metaFor(lead?.metadata);
    // Require both sides of the relationship. Never attribute a same-name
    // lead or an unrelated inbound inquiry to scanner outreach.
    if (lead && metadata?.source === "prospect_scanner" && metadata.prospect_id === p.id) {
      linksPerLead.set(lead.id, (linksPerLead.get(lead.id) ?? 0) + 1);
      linked.set(p.id, lead);
    }
  }
  let unmatched_promotions = 0;
  for (const p of saved.values()) {
    if (p.status !== "promoted") continue;
    const lead = linked.get(p.id);
    if (!lead || linksPerLead.get(lead.id) !== 1) { unmatched_promotions++; continue; }
    const g = groups.get(categoryBucket(p.category))!;
    g.linked_leads++;
    if (hasRecordedDate(lead.last_reply_at)) g.replies_recorded++;
    if (hasRecordedDate(lead.consultation_at)) g.consultations_scheduled++;
    if (projectsByLead.has(lead.id)) g.projects_created++;
    if (lead.status === "not_interested") g.declined++;
  }
  const categories = [...groups.values()]
    .filter(x => x.saved_records > 0)
    .sort((a, b) => b.saved_records - a.saved_records ||
      CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category));
  const totals = blank("other");
  for (const row of groups.values()) {
    for (const field of ["saved_records", "drafts_open", "marked_sent", "linked_leads",
      "replies_recorded", "consultations_scheduled", "projects_created", "declined"] as const) {
      totals[field] += row[field];
    }
  }
  const { category: _ignored, ...counts } = totals;
  void _ignored;
  return { totals: counts, categories, unmatched_promotions };
}
