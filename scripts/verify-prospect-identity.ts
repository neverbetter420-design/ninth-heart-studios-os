// Client protection is a pure read-only comparison. No live contacts are read.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkBusinessIdentity } from "../lib/prospect-identity.ts";
import type { ComparableProspect, ExistingLead } from "../lib/prospect-curation.ts";
import type { ClientIdentity } from "../lib/prospect-identity.ts";

const proposed = (extra: Partial<ComparableProspect> = {}): ComparableProspect => ({
  source_ref: "node:1001", business_name: "Café Thorn", category: "restaurant",
  website: "https://cafethorn.example/menu", phone: "253-555-0140",
  address: "100 Main St, Puyallup, WA", status: "new",
  outreach_status: "none", ...extra,
});
const previous = (extra: Partial<ComparableProspect> = {}) => ({
  id: "existing-prospect-id", ...proposed(extra),
});
const lead = (extra: Partial<ExistingLead> = {}): ExistingLead => ({
  business_name: "Cafe Thorn", website: "https://cafethorn.example/menu",
  phone: null, metadata: { category: "restaurant" }, ...extra,
});
const client = (extra: Partial<ClientIdentity> = {}): ClientIdentity => ({
  id: "existing-client-id", name: "Cafe Thorn",
  website: "https://cafethorn.example/menu", status: "active", ...extra,
});
const decision = (p: ComparableProspect, prospects: Array<ComparableProspect & {id: string}> = [],
  leads: ExistingLead[] = [], clients: ClientIdentity[] = []) =>
  checkBusinessIdentity(p, prospects, leads, clients);

assert.equal(decision(proposed()).action, "allow");
assert.deepEqual(decision(proposed(), [], [], [client()]),
  { action: "protect", reason: "existing_client" });
assert.deepEqual(decision(proposed(), [], [lead()]),
  { action: "protect", reason: "existing_lead" });
assert.equal(decision(proposed(), [], [], [
  client({ id: "uncertain", website: null }),
  client({ id: "real-client", name: "Café Thorn", website: "https://cafethorn.example/menu" }),
]).reason, "existing_client", "strong client match takes priority over ambiguous name");
assert.equal(decision(proposed(), [previous({
  source_ref: "node:2004", business_name: "Cafe Thorn",
  address: "250 Elm St, Tacoma, WA", phone: "253-555-0140",
  website: "https://cafethorn.example/menu",
})]).action, "review", "same franchise phone and website at a different street must be held");
assert.deepEqual(decision(proposed(), [], [], [client({ website: null })]),
  { action: "review", reason: "ambiguous_relationship" },
  "a client name alone must not silently suppress or create a new prospect");
assert.equal(decision(proposed(), [], [lead({
  website: null, phone: "+1 (253) 555-0140",
})]).action, "protect", "normalized phone with matching name blocks lead duplication");
assert.equal(decision(proposed(), [previous()]).action, "allow",
  "safe same-source refresh is allowed for an uncontacted prospect");
assert.equal(decision(proposed(), [previous({ status: "promoted" })]).reason,
  "protected_prospect");
assert.equal(decision(proposed(), [previous({ outreach_status: "sent" })]).action,
  "protect");
assert.equal(decision(proposed(), [previous({ outreach_draft: "Hello there" })]).action,
  "protect");
assert.equal(decision(proposed(), [previous(), { ...previous(), id: "duplicate-id" }]).reason,
  "duplicate_source");
assert.equal(decision(proposed(), [previous({ source_ref: "node:2001" })]).reason,
  "ambiguous_prospect", "same name and website but different source should be reviewed");
assert.equal(decision(proposed(), [], [], [client({
  name: "Unrelated Brand", website: "https://cafethorn.example/menu",
})]).action, "review", "rebrands and shared domains need manual review");
assert.equal(decision(proposed(), [], [lead({
  business_name: "Unrelated Brand",
  website: "https://cafethorn.example/menu", metadata: { category: "bar" },
})]).action, "allow", "different known niches do not suppress businesses");
assert.equal(decision(proposed(), [previous({
  business_name: "Cafe Thorn", source_ref: "node:2002",
  address: "202 Pine St, Tacoma, WA", phone: null, website: null,
})]).action, "allow", "identical chain names at different addresses are not auto-merged");
assert.equal(decision(proposed(), [], [], [client({
  name: "Cafe Thorn", website: "https://cafethorn.example/other-location",
})]).action, "review", "shared names with unclear location need manual review");
assert.equal(decision(proposed(), [], [], [client({
  name: "Other Cafe", website: "https://cafethorn.example/different-store",
})]).action, "allow", "different hosted-site paths represent different businesses");
assert.equal(decision(proposed({
  business_name: "Cafe Thorn", website: null, phone: null,
  address: "Puyallup, WA",
}), [previous({ source_ref: "node:2003", phone: null, website: null,
  address: "Tacoma, WA" })]).action, "review",
  "city-only labels must not be treated as reliable distinct street addresses");

// The production entry point is required to query clients, fail closed, and
// keep manual-review candidates OUT of both writes and shortlist curation.
const action = readFileSync("app/(protected)/(admin)/leads/discover/actions.ts", "utf8");
assert.match(action, /\.from\("clients"\)[\s\S]{0,110}\.select\("id, name, website, status"\)/);
assert.match(action, /clientsError \|\| !clientRows \|\| clientRows\.length >= 1000/);
assert.match(action, /identity\.action === "protect"/);
assert.match(action, /identity\.action === "review"/);
assert.match(action, /const selected = curateProspects\(candidatePool, previous, SCAN_CAP\)/);
assert.doesNotMatch(action, /matchesExistingLead\(/);
console.log("verify:prospect-identity — client/lead protection and collision checks passed.");
