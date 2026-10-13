// Phase 8 — Automations: the engine room.
//
// Built-in internal automations. Each runner is a pure function: data in,
// notifications + summary out. The server action (app/(protected)/(admin)/
// automations/actions.ts) handles the database: kill-switch check, audit log,
// notification writes.
//
// Nothing here sends externally. External providers (email, calendar,
// payments, lead sources) plug in later behind the same registry.

import {
  findStaleLeads,
  summarizeProjectRisk,
  type ProjectRiskInput,
} from "./muse.ts";
import { rankLeads, type FlowkeepLead } from "./flowkeep.ts";

export type PendingNotification = {
  title: string;
  body: string;
  href: string | null;
  kind: "info" | "warning" | "action";
};

export type AutomationResult = {
  notifications: PendingNotification[];
  summary: string;
  details: Record<string, unknown>;
};

/** stale_lead_digest: daily digest of leads going quiet. */
export function runStaleLeadDigest(
  leads: FlowkeepLead[],
  thresholdDays = 7,
  now = new Date(),
): AutomationResult {
  const ranked = rankLeads(leads, now);
  const stale = findStaleLeads(ranked, now, thresholdDays);

  if (stale.length === 0) {
    return {
      notifications: [],
      summary: "No stale leads — pipeline is warm.",
      details: { stale_count: 0, threshold_days: thresholdDays },
    };
  }

  const top = stale.slice(0, 5);
  return {
    notifications: [
      {
        title: `${stale.length} lead${stale.length === 1 ? "" : "s"} going quiet`,
        body: top.map((s) => `${s.businessName} (${s.daysQuiet}d quiet)`).join(" · "),
        href: "/muse#stale",
        kind: "warning",
      },
    ],
    summary: `${stale.length} stale lead${stale.length === 1 ? "" : "s"} flagged.`,
    details: {
      stale_count: stale.length,
      threshold_days: thresholdDays,
      leads: top.map((s) => ({ id: s.leadId, business: s.businessName, days_quiet: s.daysQuiet })),
    },
  };
}

/** sla_watch: flags inbound leads with breached or due-soon SLAs. */
export function runSlaWatch(leads: FlowkeepLead[], now = new Date()): AutomationResult {
  const ranked = rankLeads(leads, now);
  const breached = ranked.filter(
    (l) => l.sla.applicable && l.sla.status === "overdue",
  );
  const dueSoon = ranked.filter(
    (l) => l.sla.applicable && l.sla.status === "due_soon",
  );

  const notifications: PendingNotification[] = [];
  if (breached.length > 0) {
    notifications.push({
      title: `SLA breached: ${breached.length} lead${breached.length === 1 ? "" : "s"}`,
      body: breached.map((l) => l.business_name).join(" · "),
      href: `/leads?filter=sla`,
      kind: "action",
    });
  }
  if (dueSoon.length > 0) {
    notifications.push({
      title: `SLA due soon: ${dueSoon.length} lead${dueSoon.length === 1 ? "" : "s"}`,
      body: dueSoon.map((l) => l.business_name).join(" · "),
      href: `/leads?filter=sla`,
      kind: "warning",
    });
  }

  return {
    notifications,
    summary:
      breached.length + dueSoon.length === 0
        ? "All inbound SLAs healthy."
        : `${breached.length} breached, ${dueSoon.length} due soon.`,
    details: {
      breached: breached.map((l) => l.business_name),
      due_soon: dueSoon.map((l) => l.business_name),
    },
  };
}

/** project_risk_scan: notifies on new high/critical project risks. */
export function runProjectRiskScan(
  projects: ProjectRiskInput[],
  now = new Date(),
): AutomationResult {
  const risks = projects.map((p) => summarizeProjectRisk(p, now));
  const bad = risks.filter((r) => r.level === "high" || r.level === "critical");

  if (bad.length === 0) {
    return {
      notifications: [],
      summary: "No high-risk projects — delivery looks healthy.",
      details: { scanned: projects.length, high_risk: 0 },
    };
  }

  return {
    notifications: bad.map((r) => ({
      title: `${r.level === "critical" ? "Critical" : "High"} risk: ${r.name}`,
      body: r.factors[0] ?? "Risk factors detected.",
      href: `/projects/${r.projectId}`,
      kind: "action" as const,
    })),
    summary: `${bad.length} project${bad.length === 1 ? "" : "s"} at ${bad.some((r) => r.level === "critical") ? "critical" : "high"} risk.`,
    details: {
      scanned: projects.length,
      risks: bad.map((r) => ({ id: r.projectId, name: r.name, level: r.level })),
    },
  };
}

export type PendingApprovalInput = {
  id: string;
  title: string;
  project_id: string;
  project_name: string;
  requested_at: string;
};

/** approval_nudge: reminds when client approvals sit pending past N days. */
export function runApprovalNudge(
  approvals: PendingApprovalInput[],
  pendingDays = 3,
  now = new Date(),
): AutomationResult {
  const cutoff = now.getTime() - pendingDays * 86_400_000;
  const stale = approvals.filter((a) => {
    const requested = new Date(a.requested_at).getTime();
    return !Number.isNaN(requested) && requested < cutoff;
  });

  if (stale.length === 0) {
    return {
      notifications: [],
      summary: "No approvals sitting past the nudge threshold.",
      details: { pending: approvals.length, stale: 0, pending_days: pendingDays },
    };
  }

  return {
    notifications: [
      {
        title: `${stale.length} approval${stale.length === 1 ? "" : "s"} waiting on clients`,
        body: stale.map((a) => `${a.title} (${a.project_name})`).join(" · "),
        href: "/projects",
        kind: "warning",
      },
    ],
    summary: `${stale.length} approval${stale.length === 1 ? "" : "s"} pending ${pendingDays}+ days.`,
    details: {
      pending_days: pendingDays,
      approvals: stale.map((a) => ({ id: a.id, title: a.title, project: a.project_name })),
    },
  };
}

export type PendingChangeOrderInput = {
  id: string;
  description: string;
  project_id: string;
  project_name: string;
  proposed_at: string | null;
};

/** change_order_watch: notifies when proposed change orders sit past N days. */
export function runChangeOrderWatch(
  orders: PendingChangeOrderInput[],
  proposedDays = 3,
  now = new Date(),
): AutomationResult {
  const cutoff = now.getTime() - proposedDays * 86_400_000;
  const stale = orders.filter((o) => {
    const proposed = o.proposed_at ? new Date(o.proposed_at).getTime() : NaN;
    return !Number.isNaN(proposed) && proposed < cutoff;
  });

  if (stale.length === 0) {
    return {
      notifications: [],
      summary: "No proposed change orders past the watch threshold.",
      details: { proposed: orders.length, stale: 0, proposed_days: proposedDays },
    };
  }

  return {
    notifications: [
      {
        title: `${stale.length} change order${stale.length === 1 ? "" : "s"} awaiting a decision`,
        body: stale.map((o) => `${o.description.slice(0, 60)} (${o.project_name})`).join(" · "),
        href: "/projects",
        kind: "warning",
      },
    ],
    summary: `${stale.length} proposed change order${stale.length === 1 ? "" : "s"} sitting ${proposedDays}+ days.`,
    details: {
      proposed_days: proposedDays,
      orders: stale.map((o) => ({ id: o.id, project: o.project_name })),
    },
  };
}
