import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = resolve(import.meta.dirname, "../..");
const require = createRequire(import.meta.url);
const styles = ["globals", "phase2", "phase3", "phase4", "phase7", "scanner", "navigation", "nocturne", "nocturne-phase3", "nocturne-command", "atelier-studio", "nocturne-leads", "nocturne-management", "nocturne-documents", "nocturne-studio"];
export const previewCSS = styles.map((name) => readFileSync(resolve(root, `app/${name}.css`), "utf8"))
  .join("\n").replace('@import "tailwindcss";', "");

// Render the actual draft components with in-memory synthetic reads. No hosted
// SDK, credentials, server actions, database, or network connection is loaded.
export async function renderNocturne(role, scenario = "normal", view = "home", section = "") {
  const longTitle = "Alexandria's extraordinarily detailed studio website and international collection";
  const project = { id: "synthetic-a", client_id: "synthetic-client", name: scenario === "long" ? longTitle : "Synthetic Studio Website", status: "design", progress: 100, due_date: null, internal_notes: null, clients: { name: "Synthetic Studio" } };
  const rows = {
    profiles: [{ id: "synthetic-review-user" }],
    muse_drafts: [],
    clients: scenario === "empty" ? [] : [{ id: "synthetic-client", name: scenario === "long" ? "UnbrokenClientName".repeat(8) : "Cedar & Stone", website: "https://example.com/", primary_email: scenario === "long" ? "contact".repeat(18) + "@example.invalid" : "hello@example.invalid", status: scenario === "archived" ? "archived" : "active", client_memberships: [{ profile_id: "synthetic-profile" }], projects: [{ id: "synthetic-a" }] }],
    client_memberships: ["empty", "quiet"].includes(scenario) ? [] : [{ profile_id: "synthetic-profile", member_role: "client", profiles: { full_name: scenario === "long" ? "UnbrokenMemberName".repeat(8) : "Jamie Morgan", email: scenario === "long" ? "memberemail".repeat(12) + "@example.invalid" : "jamie@example.invalid", role: "client" } }],
    projects: ["empty", "quiet"].includes(scenario) ? [] : scenario === "populated" ? [
      { ...project, name: "Cedar & Stone Website", progress: 72 },
      { ...project, id: "synthetic-b", name: "Mira Studio", status: "build", progress: 46 },
      { ...project, id: "synthetic-c", name: "Northline Editions", status: "discovery", progress: 18 },
    ] : [project],
    approvals: scenario === "empty" ? [] : [{ id: "synthetic-approval", title: scenario === "long" ? "UnbrokenApprovalTitle".repeat(8) : "Review the homepage design", project_id: project.id, status: "pending", requested_at: "2026-10-01T12:00:00Z" }],
    leads: scenario === "populated" || (view.startsWith("lead") && scenario !== "empty") ? ["Cedar & Stone", "Mira Studio", "Northline Editions"].map((name, i) => ({
      id: `synthetic-lead-${i}`, business_name: scenario === "long" ? "UnbrokenBusinessName".repeat(9) : name, acquisition_type: "outbound",
      momentum_state: "Waiting on Me", status: "prospect", next_action_kind: "reply",
      score: 82 - i * 12, email: scenario === "long" ? "longemail".repeat(12) + "@example.invalid" : "hello@example.invalid", contact_name: "Jamie Morgan", website: "https://example.invalid",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })) : [], opportunities: [],
    activities: scenario === "populated" ? [
      { id: "synthetic-event-1", event_type: "design_shared", summary: "Homepage concept shared with Cedar & Stone", created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: "synthetic-event-2", event_type: "project_updated", summary: "Mira Studio moved into development", created_at: new Date(Date.now() - 7200000).toISOString() },
      { id: "synthetic-event-3", event_type: "notes_updated", summary: "Northline Editions discovery notes updated", created_at: new Date(Date.now() - 86400000).toISOString() },
    ] : [],
    tasks: [], milestones: [], launch_items: [], messages: [], documents: [],
    prospects: scenario === "empty" ? [] : [
      { id: "synthetic-no-site", business_name: scenario === "long" ? "UnbrokenBusinessName".repeat(8) : "Cedar & Stone", address: "Puyallup, WA", category: "bar", website: null, signals: { has_website: false, reachable: false, social_profiles: [{ platform: "facebook", url: "https://www.facebook.com/cedarandstone/", source: "listing", status: "unconfirmed", evidence: "Public profile unavailable; manual review required" }] }, opportunity_score: 35, outreach_status: "none", status: "new" },
      { id: "synthetic-rough-site", business_name: "Mira Studio", website: "https://example.com/", signals: { has_website: true, reachable: true, https: false, mobile_viewport: false, builder: "Wix", title_ok: false, description_ok: false }, opportunity_score: 65, outreach_status: "none", status: "new" },
    ],
    revision_rounds: [], change_orders: [], contracts: [], form_submissions: [], form_templates: [], templates: [],
    files: view === "project" && scenario === "populated" ? [{ id: "synthetic-image", filename: "Shared design.png", mime_type: "image/png", visibility: "client", size_bytes: 100, created_at: "2026-10-01T12:00:00Z", object_path: "synthetic.png" }] : [],
  };
  if (["pipeline", "client-detail"].includes(view) && scenario === "long") rows.projects[0].name = "UnbrokenProjectTitle".repeat(10);
  if (view === "clients" && scenario === "populated") rows.clients = ["Cedar & Stone", "Mira Studio", "Northline Editions"].map((name, i) => ({ ...rows.clients[0], id: i ? `synthetic-client-${i}` : "synthetic-client", name, status: i === 2 ? "archived" : "active", projects: Array.from({length: 3-i}, (_, j) => ({ id: `project-${i}-${j}` })) }));
  if (view === "pipeline" && scenario === "stages") rows.projects = ["discovery", "content", "design", "build", "review", "launch", "care", "on_hold", "legacy_phase"].map((status, i) => ({ ...project, id: `synthetic-stage-${i}`, name: `Sample ${status} project`, status, progress: i === 0 ? 120 : i * 10, due_date: "2020-01-01" }));
  const documentViews = { contracts: "contracts", "contract-detail": "contracts", forms: "forms", "form-detail": "forms", templates: "templates", "template-detail": "templates" };
  if (view in documentViews) {
    const title = scenario === "long" ? "UnbrokenStudioDocumentTitle".repeat(9) : "Website design agreement";
    const stamp = "2026-10-12T20:00:00Z";
    rows.contracts = scenario === "empty" ? [] : [{ id: "synthetic-contract", project_id: project.id, title, status: ["sent", "signed", "voided"].includes(scenario) ? scenario : "draft", body: scenario === "long" ? "UnbrokenContractTerms".repeat(35) : "A considered website for Cedar & Stone.\n\nScope, timeline and payment terms are recorded here.", created_at: stamp, sent_at: scenario === "sent" || scenario === "signed" ? stamp : null, signed_at: scenario === "signed" ? stamp : null, signer_name: "Jamie Morgan", signer_email: scenario === "long" ? "signer".repeat(30) + "@example.invalid" : "jamie@example.invalid", signer_ip: "192.0.2.1", signature_hash: "a".repeat(64) }];
    if (scenario === "opportunity") { rows.contracts[0].project_id = null; rows.contracts[0].opportunity_id = "synthetic-opportunity"; }
    rows.templates = scenario === "empty" ? [] : [{ id: "synthetic-template", name: scenario === "long" ? title : "Website project agreement", category: "contract", content: { body: scenario === "long" ? "UnbrokenTemplateBody".repeat(35) : "Project scope\n\nA useful starting point for each new website." }, active: scenario !== "archived", created_at: stamp, updated_at: stamp }];
    rows.form_templates = scenario === "empty" ? [] : [{ id: "synthetic-form", name: scenario === "long" ? title : "Website project intake", category: "document", description: scenario === "long" ? "UnbrokenDescription".repeat(20) : "The essentials for a considered first conversation.", active: !["archived", "imported", "source-error"].includes(scenario), fields: scenario === "no-fields" ? [] : [{ id: "field-name", label: scenario === "long" ? "UnbrokenFieldLabel".repeat(12) : "Business name", type: "text", required: true }, { id: "field-choice", label: "Project goals", type: "select", required: false, options: ["New website", "Redesign"], help: "Choose the closest fit." }], created_at: stamp, updated_at: stamp, source_file_path: ["imported", "source-error"].includes(scenario) ? "templates/synthetic-form/reference.pdf" : null, source_file_name: "Brand reference.pdf" }];
    rows.form_submissions = scenario === "empty" || scenario === "no-fields" ? [] : [{ id: "synthetic-submission", project_id: project.id, status: "submitted", submitted_at: stamp, signer_name: scenario === "long" ? "UnbrokenSignerName".repeat(15) : "Jamie Morgan", total_cents: 90000, created_at: stamp }];
    if (scenario === "populated") {
      rows.contracts.push({ ...rows.contracts[0], id: "synthetic-sent", title: "Mira Studio · Monthly care", status: "sent" }, { ...rows.contracts[0], id: "synthetic-signed", title: "Northline Editions · Website", status: "signed" });
      rows.templates.push({ ...rows.templates[0], id: "synthetic-document-template", name: "A welcome to the studio", category: "document" });
      rows.form_templates.push({ ...rows.form_templates[0], id: "synthetic-invoice", name: "Project invoice", category: "invoice" });
    }
  }
  if (view === "muse") {
    const stamp = new Date(Date.now() - 20 * 86400000).toISOString();
    if (scenario !== "empty") {
      rows.leads = [{ id: "synthetic-muse-lead", business_name: scenario === "long" ? "UnbrokenLeadName".repeat(15) : "Cedar & Stone", contact_name: "Jamie Morgan", acquisition_type: "outbound", momentum_state: "Waiting on Them", status: "contacted", last_activity_at: stamp, updated_at: stamp, created_at: stamp, last_outreach_at: stamp, next_action_kind: "follow_up", score: 82 }];
      rows.projects = [{ ...project, updated_at: new Date().toISOString() }];
      rows.muse_drafts = [{ id: "synthetic-draft", subject: scenario === "long" ? "UnbrokenDraftSubject".repeat(15) : "A considered next step for Cedar & Stone", body: scenario === "long" ? "UnbrokenDraftBody".repeat(40) : "Hi Jamie,\n\nA starting point for our next conversation.\n\nHailey", kind: "follow_up", created_at: new Date().toISOString(), status: "draft" }];
    }
    if (scenario === "risk-order") {
      rows.projects = [{ ...project, id: "watch-project", name: "Watch project", updated_at: new Date().toISOString() }, { ...project, id: "critical-project", name: "Critical project", updated_at: stamp }];
      rows.approvals = [{ id: "watch-approval", project_id: "watch-project", decided_at: null }];
      rows.milestones = [1,2].map(i => ({ title: `Overdue ${i}`, project_id: "critical-project", status: "in_progress", due_date: "2020-01-01" }));
    }
  }
  const supabase = { storage: { from: () => ({ createSignedUrl: async () => ({ data: scenario === "source-error" ? null : { signedUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=" } }) }) }, from(table) {
    if (!(table in rows)) throw new Error(`Unexpected preview table: ${table}`);
    const result = { data: rows[table], count: rows[table].length, error: (scenario === "error" && (table === "projects" || table === "leads")) || (scenario === "members-error" && table === "client_memberships") || (scenario === "client-choices-error" && table === "clients") || (scenario === "error" && view in documentViews && table === (view.startsWith("contract") ? "contracts" : view.startsWith("form") ? "form_templates" : "templates")) || (scenario === "projects-error" && table === "projects") || (scenario === "submissions-error" && table === "form_submissions") || (scenario === "template-choices-error" && table === "templates") || (view === "muse" && scenario === "error" && table === "opportunities") || (view === "muse" && scenario === "risk-error" && table === "milestones") || (view === "muse" && scenario === "drafts-error" && table === "muse_drafts") || (view === "settings" && scenario === "error" && table === "profiles") ? { message: "Synthetic read failure" } : null };
    const chain = { then: (ok, fail) => Promise.resolve(result).then(ok, fail) };
    for (const method of ["select", "eq", "neq", "not", "order", "limit", "in"]) chain[method] = () => chain;
    if (view === "muse" && ["tasks", "milestones", "approvals"].includes(table)) chain.eq = (key,value) => { result.data = rows[table].filter(row => row[key] === value); return chain; };
    chain.maybeSingle = () => { result.data = rows[table][0] ?? null; return chain; };
    return chain;
  } };
  const path = ["muse", "settings"].includes(view) ? `/${view}` : view in documentViews ? `/${documentViews[view]}${view.endsWith("-detail") ? "/synthetic-document" : ""}` : view === "clients" ? "/clients" : view === "client-detail" ? "/clients/synthetic-client" : view === "pipeline" ? "/projects" : view === "scanner" ? "/leads/discover" : view.startsWith("lead") ? (view === "leads" ? "/leads" : "/leads/synthetic-lead-0") : view === "project" ? (role === "admin" ? "/projects/synthetic-a" : "/portal/projects/synthetic-a") : role === "admin" ? "/" : "/portal";
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const code = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: file,
    }).outputText;
    const localRequire = (name) => {
      if (name === "next/cache") return { revalidatePath: () => { throw new Error("Preview mutations are disabled"); } };
      if (name === "@/lib/email") return { isEmailConfigured: () => scenario === "email-configured" };
      if (name === "@/lib/supabase/server") return { createClient: async () => supabase };
      if (name === "@/lib/auth") {
        const identity = async () => ({ user: { id: "synthetic-review-user" }, profile: { role, email: scenario === "long" ? "account".repeat(30) + "@example.invalid" : "alex@example.invalid", full_name: scenario === "long" ? "Alexandria" : "Alex" } });
        return { requireUser: identity, requireAdmin: identity };
      }
      if (name.endsWith("/actions")) return new Proxy({}, { get: () => async () => { throw new Error("Preview actions are disabled"); } });
      if (name === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
      if (name === "next/navigation") return { usePathname: () => path, redirect: () => { throw new Error("Unexpected preview redirect"); }, notFound: () => { throw new Error("Synthetic project not found"); } };
      if (name.startsWith("@/") || name.startsWith(".")) {
        const base = name.startsWith("@/") ? resolve(root, name.slice(2)) : resolve(dirname(file), name);
        const resolved = [base, base + ".tsx", base + ".ts"].find((candidate) => existsSync(candidate));
        if (!resolved) throw new Error(`Missing preview import: ${name}`);
        return load(resolved);
      }
      if (!["react", "react-dom", "react/jsx-runtime"].includes(name)) throw new Error(`Unapproved preview import: ${name}`);
      return require(name);
    };
    vm.runInNewContext(code, { require: localRequire, module, exports: module.exports, console, Date, URL, URLSearchParams }, { filename: file });
    return module.exports;
  }
  const { AppShell } = load(resolve(root, "components/AppShell.tsx"));
  const Page = ["muse", "settings"].includes(view) ? load(resolve(root, `app/(protected)/(admin)/${view}/page.tsx`)).default : view in documentViews ? load(resolve(root, `app/(protected)/(admin)/${documentViews[view]}/${view.endsWith("-detail") ? "[id]/" : ""}page.tsx`)).default : ["clients", "client-detail", "pipeline"].includes(view)
    ? load(resolve(root, { clients: "app/(protected)/(admin)/clients/page.tsx", "client-detail": "app/(protected)/(admin)/clients/[id]/page.tsx", pipeline: "app/(protected)/(admin)/projects/page.tsx" }[view])).default
    : view === "scanner"
    ? load(resolve(root, "app/(protected)/(admin)/leads/discover/page.tsx")).default
    : view.startsWith("lead")
    ? load(resolve(root, view === "leads" ? "app/(protected)/(admin)/leads/page.tsx" : "app/(protected)/(admin)/leads/[leadId]/page.tsx")).default
    : view === "project"
    ? load(resolve(root, role === "admin" ? "app/(protected)/(admin)/projects/[projectId]/page.tsx" : "app/(protected)/portal/projects/[projectId]/page.tsx")).default
    : role === "admin" ? load(resolve(root, "components/Dashboard.tsx")).Dashboard : load(resolve(root, "app/(protected)/portal/page.tsx")).default;
  const content = renderToStaticMarkup(await Page({ params: Promise.resolve({ projectId: project.id, leadId: "synthetic-lead-0", id: "synthetic-client" }), searchParams: Promise.resolve({ section, kind: ["preview", "long"].includes(scenario) && view === "muse" ? "follow_up" : undefined, target: view === "muse" ? scenario === "invalid-target" ? "lead:missing" : ["preview", "long"].includes(scenario) ? "lead:synthetic-muse-lead" : undefined : undefined, state: scenario === "archived" ? "archived" : undefined, category: scenario === "filtered" ? "contract" : undefined, client: scenario === "context" ? "synthetic-client" : undefined, error: scenario === "form-error" ? "Check the submitted fields and try again." : undefined }) }));
  const user = { name: "Synthetic Review Owner", email: "visual-review@example.invalid" };
  const html = renderToStaticMarkup(React.createElement(AppShell, { role, user }, React.createElement("div", { "data-preview-content": true, dangerouslySetInnerHTML: { __html: content } })));
  return { html, content, role, user, path };
}
