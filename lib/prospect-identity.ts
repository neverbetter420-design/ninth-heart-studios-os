// Conservative, deterministic identity guard for local business discovery.
// Never treats a name alone as proof of identity and never merges or edits records.
import { categoryBucket, protectedFromScannerUpdate, type ComparableProspect, type ExistingLead } from "./prospect-curation.ts";

export type ClientIdentity = {
  id: string;
  name: string;
  website: string | null;
  status?: string | null;
};
export type IdentityDecision = {
  action: "allow" | "protect" | "review";
  reason: "clear" | "existing_client" | "existing_lead" | "protected_prospect" |
    "ambiguous_prospect" | "ambiguous_relationship" | "duplicate_source";
};

type IdentityFields = {
  name: string;
  website?: string | null;
  phone?: string | null;
  address?: string | null;
  category?: string | null;
};

function nameKey(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}
function phoneKey(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) :
    digits.length === 10 ? digits : "";
}
function webKey(value: string | null | undefined): string {
  if (!value || value.length > 2048) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(value) ? value : "https://" + value);
    if (!["http:", "https:"].includes(u.protocol) || u.username || u.password) return "";
    // Preserve hosted-site paths: two Square/Wix customers might share a domain.
    const host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
    if (!host.includes(".") || host.includes(":")) return "";
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    return host + path;
  } catch { return ""; }
}
function streetKey(value: string | null | undefined): string {
  const first = (value ?? "").split(",")[0];
  const key = nameKey(first);
  // A city-only or street-only label is not unique identity evidence.
  return /^\d{1,6} [a-z]/.test(key) ? key : "";
}
function compatible(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = categoryBucket(a ?? null), right = categoryBucket(b ?? null);
  return left === "other" || right === "other" || left === right;
}
function compare(incoming: IdentityFields, saved: IdentityFields): "same" | "maybe" | "none" {
  if (!compatible(incoming.category, saved.category)) return "none";
  const sameName = Boolean(nameKey(incoming.name) && nameKey(incoming.name) === nameKey(saved.name));
  const sharedPhone = Boolean(phoneKey(incoming.phone) && phoneKey(incoming.phone) === phoneKey(saved.phone));
  const sharedSite = Boolean(webKey(incoming.website) && webKey(incoming.website) === webKey(saved.website));
  const aStreet = streetKey(incoming.address), bStreet = streetKey(saved.address);
  const sharedStreet = Boolean(aStreet && aStreet === bStreet);
  if (sameName && (sharedPhone || sharedSite || sharedStreet)) return "same";
  // Shared infrastructure or rebrands need manual review, not an automatic merge.
  if (sharedPhone || sharedSite || sharedStreet) return "maybe";
  // Matching franchise names at *different confirmed street addresses* are distinct.
  if (sameName && (!aStreet || !bStreet)) return "maybe";
  return "none";
}
function asProspect(p: ComparableProspect): IdentityFields {
  return { name: p.business_name, website: p.website, phone: p.phone,
    address: p.address, category: p.category };
}

/** Run before curation and before any insert/update, using complete bounded reads.
 * A source-ref match to one UNPROTECTED prospect may use the existing safe
 * refresh path. An existing client/lead always takes precedence.
 */
export function checkBusinessIdentity(
  incoming: ComparableProspect,
  prospects: Array<ComparableProspect & { id: string }>,
  leads: ExistingLead[],
  clients: ClientIdentity[],
): IdentityDecision {
  const query = asProspect(incoming);
  for (const client of clients) {
    const match = compare(query, { name: client.name, website: client.website });
    if (match === "same") return { action: "protect", reason: "existing_client" };
    if (match === "maybe") return { action: "review", reason: "ambiguous_relationship" };
  }
  for (const lead of leads) {
    const meta = lead.metadata as { category?: string | null; address?: string | null } | null | undefined;
    const match = compare(query, { name: lead.business_name, website: lead.website,
      phone: lead.phone, category: meta?.category, address: meta?.address });
    if (match === "same") return { action: "protect", reason: "existing_lead" };
    if (match === "maybe") return { action: "review", reason: "ambiguous_relationship" };
  }
  const exact = prospects.filter(p => p.source_ref && incoming.source_ref &&
    p.source_ref === incoming.source_ref);
  if (exact.length > 1) return { action: "review", reason: "duplicate_source" };
  if (exact.some(protectedFromScannerUpdate)) {
    return { action: "protect", reason: "protected_prospect" };
  }
  for (const prior of prospects) {
    if (exact.length === 1 && prior.id === exact[0].id) continue;
    const match = compare(query, asProspect(prior));
    if (match !== "none") return { action: "review", reason: "ambiguous_prospect" };
  }
  return { action: "allow", reason: "clear" };
}
