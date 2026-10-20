/** Presentation-only helpers. Recorded progress and dates are never changed. */
export function displayProgress(value: number): number {
  return Number.isFinite(value) ? Math.round(Math.min(100, Math.max(0, value))) : 0;
}

function projectDate(raw: string | null): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === raw ? date : null;
}

export function formatProjectDate(raw: string | null): string {
  const date = projectDate(raw);
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "No due date";
}

export function projectDueState(raw: string | null, now = new Date()): "overdue" | "soon" | null {
  const due = projectDate(raw);
  if (!due) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map(p => [p.type, p.value]));
  const today = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  const days = (due.getTime() - today) / 86400000;
  return days < 0 ? "overdue" : days <= 7 ? "soon" : null;
}
