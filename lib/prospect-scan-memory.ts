// Bounded, owner-only scan memory stored alongside existing prospect signals.
// Track observed *differences* only, never infer closure, removal or wrongdoing
// from an unavailable website or a social platform login wall.
import type { WebsiteSignals } from "./prospect-scan.ts";

export type ScanChange = {
  at: string;
  key: string;
  description: string;
  source: "directory" | "website" | "social";
  kind: "review" | "new_evidence";
};
export type ScanMemory = {
  version: 1;
  last_checked_at: string;
  events: ScanChange[];
};
export type ScanMemoryRecord = {
  website?: string | null;
  phone?: string | null;
  scanned_at?: string | null;
  signals?: Partial<WebsiteSignals> | null;
};

const MAX_EVENTS = 12;

function phoneKey(raw: string | null | undefined): string {
  const d = (raw ?? "").replace(/\D/g, "");
  return d.length === 11 && d[0] === "1" ? d.slice(1) : d.length === 10 ? d : "";
}
function siteKey(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    if (!["http:", "https:"].includes(u.protocol) || u.username || u.password) return "";
    return u.hostname.toLowerCase().replace(/^www\./, "") +
      u.pathname.replace(/\/+$/, "").toLowerCase();
  } catch { return ""; }
}
function matchedSocial(signal: Partial<WebsiteSignals> | null | undefined): Set<string> {
  return new Set((signal?.social_profiles ?? [])
    .filter(p => p.status === "matched" && (p.platform === "instagram" || p.platform === "facebook"))
    .map(p => p.platform + ":" + p.url));
}

/** Pure update: no database writes. Events are evidence changes, not verified
 * outcomes. Outages, missing pages and temporary social blocks NEVER emit a
 * negative "business closed" or "feature removed" event.
 */
export function updateScanMemory(
  before: ScanMemoryRecord | null,
  after: ScanMemoryRecord,
  at: string,
): ScanMemory {
  const priorMemory = before?.signals?.scan_memory;
  const history = Array.isArray(priorMemory?.events)
    ? priorMemory.events.filter(e => e && typeof e.at === "string" &&
      typeof e.key === "string" && typeof e.description === "string").slice(-MAX_EVENTS)
    : [];
  const changes: ScanChange[] = [];
  const add = (key: string, description: string, source: ScanChange["source"],
    kind: ScanChange["kind"] = "review") => {
    if (!changes.some(e => e.key === key)) changes.push({ at, key, description, source, kind });
  };
  if (before) {
    const priorPhone = phoneKey(before.phone), nextPhone = phoneKey(after.phone);
    if (priorPhone && nextPhone && priorPhone !== nextPhone) add(
      "listed-phone", "Listed phone changed between directory observations; confirm before contacting.", "directory",
    );
    const oldSite = siteKey(before.website), newSite = siteKey(after.website);
    if (oldSite && newSite && oldSite !== newSite &&
      before.signals?.reachable === true && after.signals?.reachable === true) add(
      "website-url", "The reachable website URL changed between scans; manually confirm the current official site.", "website",
    );
    const oldSocial = matchedSocial(before.signals);
    for (const val of matchedSocial(after.signals)) {
      if (!oldSocial.has(val)) {
        const platform = val.split(":")[0];
        add("social-" + platform, (platform === "instagram" ? "Instagram" : "Facebook") +
          " public profile identity is newly corroborated.", "social", "new_evidence");
      }
    }
    // Only record newly *observed* homepage actions, never removal based on
    // "not observed" (which is only a partial page-level heuristic).
    const oldAudit = before.signals?.industry_audit;
    const newAudit = after.signals?.industry_audit;
    if (oldAudit?.scope === "homepage_only" && newAudit?.scope === "homepage_only" &&
      oldAudit.category === newAudit.category) {
      const known = new Map(oldAudit.signals.map(s => [s.key, s.status]));
      for (const signal of newAudit.signals) {
        if (signal.status === "observed" && known.get(signal.key) === "not_observed_on_homepage") {
          add("homepage-" + signal.key,
            signal.label + " is now observed on the homepage; review before making recommendations.",
            "website", "new_evidence");
        }
      }
    }
  }
  // Only 12 recent changes are retained; no raw page content or secrets.
  return {
    version: 1,
    last_checked_at: at,
    events: [...history, ...changes].slice(-MAX_EVENTS),
  };
}
