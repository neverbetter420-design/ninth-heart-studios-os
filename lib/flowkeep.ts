export const PACIFIC_TIME_ZONE = "America/Los_Angeles";
export const BUSINESS_CUTOFF_HOUR = 20;

export type AcquisitionType = "outbound" | "inbound";
export type MomentumState =
  | "Waiting on Me"
  | "Waiting on Them"
  | "New Inbound"
  | "Prepare for Consultation"
  | "Scheduled Consultation";

export type QuickLogOutcome =
  | "Sent Email"
  | "Called"
  | "DM (IG/FB)"
  | "Received Reply"
  | "Spoke in Person"
  | "Not Interested";

export type NextActionKind =
  | "reply"
  | "consultation"
  | "new_inbound"
  | "follow_up"
  | "first_outreach"
  | "research"
  | "closed";

export type FlowkeepLead = {
  id: string;
  business_name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  acquisition_type: AcquisitionType;
  momentum_state: MomentumState;
  score?: number | null;
  status: string;
  next_action?: string | null;
  next_action_kind?: NextActionKind | null;
  next_action_due?: string | null;
  original_inquiry_at?: string | null;
  last_outreach_at?: string | null;
  last_reply_at?: string | null;
  last_activity_at?: string | null;
  consultation_at?: string | null;
  last_outcome?: QuickLogOutcome | null;
  created_at: string;
  updated_at: string;
};

export type RankedLead = FlowkeepLead & {
  priorityScore: number;
  priorityLabel: "critical" | "high" | "normal";
  actionTitle: string;
  actionMeta: string;
  sla: SlaState;
};

export type SlaState = {
  applicable: boolean;
  status: "not_applicable" | "met" | "safe" | "due_soon" | "overdue";
  dueAt: string | null;
  label: string;
};

type PacificParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string;
};

const pacificFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PACIFIC_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

function pacificParts(date: Date): PacificParts {
  const parts = Object.fromEntries(
    pacificFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: parts.weekday,
  };
}

function offsetMinutesAt(date: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIME_ZONE,
    timeZoneName: "longOffset",
    year: "numeric",
  });
  const value = formatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value ?? "GMT-08:00";
  const match = value.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return -480;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "+" ? minutes : -minutes;
}

function pacificInstant(year: number, month: number, day: number, hour: number, minute = 0): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = offsetMinutesAt(guess);
  return new Date(guess.getTime() - offset * 60_000);
}

function addCalendarDays(parts: Pick<PacificParts, "year" | "month" | "day">, amount: number) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount, 12));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function weekdayFor(parts: Pick<PacificParts, "year" | "month" | "day">): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)),
  );
}

function isBusinessDay(parts: Pick<PacificParts, "year" | "month" | "day">): boolean {
  const weekday = weekdayFor(parts);
  return weekday !== "Sat" && weekday !== "Sun";
}

function nextBusinessDate(parts: Pick<PacificParts, "year" | "month" | "day">) {
  let cursor = addCalendarDays(parts, 1);
  while (!isBusinessDay(cursor)) cursor = addCalendarDays(cursor, 1);
  return cursor;
}

/**
 * Inbound SLA: end of the next business day, Pacific time.
 * An inquiry arriving after the 8 PM Pacific cutoff (or on a weekend) is treated
 * as entering the business queue on the next business day; its SLA then ends at
 * 8 PM on the following business day.
 */
export function inboundSlaDueAt(receivedAt: Date): Date {
  const received = pacificParts(receivedAt);
  let queueDate = { year: received.year, month: received.month, day: received.day };
  const afterCutoff = received.hour >= BUSINESS_CUTOFF_HOUR;

  if (!isBusinessDay(queueDate) || afterCutoff) {
    while (!isBusinessDay(queueDate) || (queueDate.year === received.year && queueDate.month === received.month && queueDate.day === received.day)) {
      queueDate = nextBusinessDate(queueDate);
    }
  }

  const dueDate = nextBusinessDate(queueDate);
  return pacificInstant(dueDate.year, dueDate.month, dueDate.day, BUSINESS_CUTOFF_HOUR);
}

export function getSlaState(lead: FlowkeepLead, now = new Date()): SlaState {
  if (lead.acquisition_type !== "inbound" || !lead.original_inquiry_at) {
    return { applicable: false, status: "not_applicable", dueAt: null, label: "No inbound SLA" };
  }

  const computedDue = inboundSlaDueAt(new Date(lead.original_inquiry_at));
  if (lead.last_outreach_at && new Date(lead.last_outreach_at).getTime() >= new Date(lead.original_inquiry_at).getTime()) {
    return { applicable: true, status: "met", dueAt: computedDue.toISOString(), label: "SLA met" };
  }

  const due = lead.next_action_due
    ? new Date(lead.next_action_due)
    : computedDue;
  const delta = due.getTime() - now.getTime();
  const hours = Math.abs(delta) / 3_600_000;

  if (delta < 0) {
    return {
      applicable: true,
      status: "overdue",
      dueAt: due.toISOString(),
      label: `${hours < 1 ? "<1" : Math.round(hours)}h overdue`,
    };
  }

  if (delta <= 6 * 3_600_000) {
    return {
      applicable: true,
      status: "due_soon",
      dueAt: due.toISOString(),
      label: `Due in ${hours < 1 ? "<1" : Math.ceil(hours)}h`,
    };
  }

  return {
    applicable: true,
    status: "safe",
    dueAt: due.toISOString(),
    label: `SLA due ${formatPacificDateTime(due)}`,
  };
}

export function deriveNewLead(input: {
  acquisitionType: AcquisitionType;
  hasContactMethod: boolean;
  createdAt?: Date;
}) {
  const createdAt = input.createdAt ?? new Date();

  if (input.acquisitionType === "inbound") {
    return {
      momentum_state: "New Inbound" as const,
      next_action: "Respond to new lead",
      next_action_kind: "new_inbound" as const,
      original_inquiry_at: createdAt.toISOString(),
      next_action_due: inboundSlaDueAt(createdAt).toISOString(),
      last_activity_at: createdAt.toISOString(),
    };
  }

  return {
    momentum_state: "Waiting on Me" as const,
    next_action: input.hasContactMethod ? "Send first outreach" : "Find contact method",
    next_action_kind: input.hasContactMethod ? ("first_outreach" as const) : ("research" as const),
    original_inquiry_at: null,
    next_action_due: null,
    last_activity_at: createdAt.toISOString(),
  };
}

export function outcomePatch(outcome: QuickLogOutcome, at = new Date()) {
  const timestamp = at.toISOString();

  switch (outcome) {
    case "Received Reply":
      return {
        momentum_state: "Waiting on Me" as const,
        last_reply_at: timestamp,
        last_activity_at: timestamp,
        last_outcome: outcome,
        next_action: "Reply to lead",
        next_action_kind: "reply" as const,
        next_action_due: timestamp,
        status: "engaged",
      };
    case "Sent Email":
    case "Called":
    case "DM (IG/FB)":
      return {
        momentum_state: "Waiting on Them" as const,
        last_outreach_at: timestamp,
        last_activity_at: timestamp,
        last_outcome: outcome,
        next_action: "Follow up when momentum warrants it",
        next_action_kind: "follow_up" as const,
        next_action_due: null,
        status: "contacted",
      };
    case "Spoke in Person":
      return {
        momentum_state: "Waiting on Me" as const,
        last_outreach_at: timestamp,
        last_activity_at: timestamp,
        last_outcome: outcome,
        next_action: "Send follow-up",
        next_action_kind: "follow_up" as const,
        next_action_due: null,
        status: "engaged",
      };
    case "Not Interested":
      return {
        momentum_state: "Waiting on Them" as const,
        last_activity_at: timestamp,
        last_outcome: outcome,
        next_action: null,
        next_action_kind: "closed" as const,
        next_action_due: null,
        status: "not_interested",
      };
  }
}

export function consultationPatch(consultationAt: Date, now = new Date()) {
  return {
    consultation_at: consultationAt.toISOString(),
    momentum_state: "Scheduled Consultation" as const,
    next_action: "Prepare for consultation",
    next_action_kind: "consultation" as const,
    next_action_due: consultationAt.toISOString(),
    last_activity_at: now.toISOString(),
    status: "consultation_scheduled",
  };
}

export function rankLead(lead: FlowkeepLead, now = new Date()): RankedLead | null {
  if (lead.status === "not_interested" || lead.next_action_kind === "closed") return null;

  const sla = getSlaState(lead, now);
  const kind = lead.next_action_kind ?? inferActionKind(lead);
  let bucket = 0;
  let label: RankedLead["priorityLabel"] = "normal";

  switch (kind) {
    case "reply":
      bucket = 1000;
      label = "critical";
      break;
    case "consultation":
      bucket = 900;
      label = "high";
      break;
    case "new_inbound":
      bucket = 800;
      label = sla.status === "overdue" || sla.status === "due_soon" ? "high" : "normal";
      break;
    case "follow_up":
      bucket = 500;
      break;
    case "first_outreach":
      bucket = 300;
      break;
    case "research":
      bucket = 200;
      break;
    default:
      bucket = 100;
  }

  const actionDue = lead.next_action_due ? new Date(lead.next_action_due).getTime() : Number.POSITIVE_INFINITY;
  const dueUrgency = Number.isFinite(actionDue)
    ? Math.max(0, Math.min(90, Math.round((now.getTime() - actionDue) / 60_000)))
    : 0;
  const ageMinutes = Math.max(0, Math.round((now.getTime() - new Date(lead.last_activity_at ?? lead.updated_at).getTime()) / 60_000));
  const ageTieBreaker = Math.min(80, Math.floor(ageMinutes / 60));

  return {
    ...lead,
    priorityScore: bucket + dueUrgency + ageTieBreaker,
    priorityLabel: label,
    actionTitle: lead.next_action ?? defaultActionForKind(kind),
    actionMeta: buildActionMeta(lead, sla, now),
    sla,
  };
}

export function rankLeads(leads: FlowkeepLead[], now = new Date()): RankedLead[] {
  return leads
    .map((lead) => rankLead(lead, now))
    .filter((lead): lead is RankedLead => Boolean(lead))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

function inferActionKind(lead: FlowkeepLead): NextActionKind {
  if (lead.last_outcome === "Received Reply") return "reply";
  if (lead.consultation_at || ["Prepare for Consultation", "Scheduled Consultation"].includes(lead.momentum_state)) return "consultation";
  if (lead.momentum_state === "New Inbound") return "new_inbound";
  if (lead.last_outreach_at) return "follow_up";
  if (lead.email || lead.phone) return "first_outreach";
  return "research";
}

function defaultActionForKind(kind: NextActionKind): string {
  const labels: Record<NextActionKind, string> = {
    reply: "Reply to lead",
    consultation: "Prepare for consultation",
    new_inbound: "Respond to new lead",
    follow_up: "Follow up",
    first_outreach: "Send first outreach",
    research: "Find contact method",
    closed: "No action",
  };
  return labels[kind];
}

function buildActionMeta(lead: FlowkeepLead, sla: SlaState, now: Date): string {
  const reference = lead.last_activity_at ?? lead.updated_at;
  const elapsed = formatElapsed(new Date(reference), now);
  if (lead.acquisition_type === "inbound" && sla.applicable) return `${elapsed} momentum · ${sla.label}`;
  if (lead.last_outcome) return `${elapsed} since ${lead.last_outcome.toLowerCase()}`;
  return `${elapsed} since last activity`;
}

export function formatElapsed(from: Date, to = new Date()): string {
  const minutes = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function pacificLocalDateTimeToDate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return pacificInstant(Number(year), Number(month), Number(day), Number(hour), Number(minute));
}

export function formatPacificDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export const QUICK_LOG_OUTCOMES: QuickLogOutcome[] = [
  "Sent Email",
  "Called",
  "DM (IG/FB)",
  "Received Reply",
  "Spoke in Person",
  "Not Interested",
];
