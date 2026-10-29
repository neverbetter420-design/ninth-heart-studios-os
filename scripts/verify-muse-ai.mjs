import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Compile/build and authenticated Playwright tests run separately. This source
// contract catches accidental additions of autonomous or privileged behavior.
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const route = read("app/api/admin/muse-ai/route.ts");
const tools = read("lib/muse-ai-tools.ts");
const shell = read("components/AppShell.tsx");
const ui = read("components/MuseConcierge.tsx");

for (const token of ["getCurrentAuth", 'auth.profile.role !== "admin"', "auth.profile?.active",
  "OPENAI_API_KEY", 'MUSE_AI_ENABLED !== "true"', "store: false",
  "parallel_tool_calls: false", 'tool_choice: turn === 2 ? "none" : "auto"',
  "response.json()", "No automatic"]) {
  if (token !== "No automatic") assert.ok(route.includes(token), "Missing Muse route security rule: " + token);
}
assert.ok(route.includes("origin !== new URL(request.url).origin"), "Origin validation must be present");
assert.ok(route.includes("raw.length > 12000"), "Request body must be bounded");
assert.ok(route.includes("question.length > 1000"), "Question length must be bounded");
assert.ok(route.includes("ALLOWED_MODELS.includes(configuredModel)"), "No arbitrary model routing");
assert.ok(!route.includes("NEXT_PUBLIC_OPENAI"), "Never expose model keys to browser");
assert.ok(tools.includes('import "server-only"'), "Tools must be server only");
assert.ok(tools.includes("await createClient()"), "Tools must use user-scoped Supabase client");
assert.ok(!/service_role|serviceRole|SUPABASE_SERVICE_ROLE|SUPABASE_SECRET_KEY/.test(route + tools),
  "Never use privileged Supabase credentials for Muse");
assert.ok(!/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(|sendEmail\(|runScan\(/.test(tools),
  "Muse tool implementations must remain read-only");
for (const name of ["studio_overview", "lead_priorities", "project_watch", "prospect_comparison", "opportunity_radar"]) {
  assert.ok(tools.includes('name: "' + name + '"'), "Missing bounded read tool: " + name);
}
assert.ok(route.includes("strict: true"), "Tools must use strict schemas");
assert.ok(route.includes("additionalProperties: false"), "Tools must reject model-invented arguments");
assert.ok(shell.includes('role === "admin" && <MuseConcierge />'), "Never expose Muse to client portal");
assert.ok(ui.includes('fetch("/api/admin/muse-ai"'), "Muse drawer must use secured server route");
assert.ok(ui.includes("No automatic scans or messages"), "Show read-only boundary visibly");
console.log("Muse AI static safety contract passed: admin-only, feature gated, RLS reads, fixed tool allowlist, no writes or automatic outreach.");
