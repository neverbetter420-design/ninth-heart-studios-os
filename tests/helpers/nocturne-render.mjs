import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = resolve(import.meta.dirname, "../..");
const require = createRequire(import.meta.url);
const styles = ["globals", "phase2", "phase3", "phase4", "phase7", "scanner", "navigation", "nocturne", "nocturne-phase3", "nocturne-command", "atelier-studio", "nocturne-leads"];
export const previewCSS = styles.map((name) => readFileSync(resolve(root, `app/${name}.css`), "utf8"))
  .join("\n").replace('@import "tailwindcss";', "");

// Render the actual draft components with in-memory synthetic reads. No hosted
// SDK, credentials, server actions, database, or network connection is loaded.
export async function renderNocturne(role, scenario = "normal", view = "home", section = "") {
  const longTitle = "Alexandria's extraordinarily detailed studio website and international collection";
  const project = { id: "synthetic-a", client_id: "synthetic-client", name: scenario === "long" ? longTitle : "Synthetic Studio Website", status: "design", progress: 100, due_date: null, internal_notes: null, clients: { name: "Synthetic Studio" } };
  const rows = {
    projects: scenario === "empty" ? [] : scenario === "populated" ? [
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
  const supabase = { storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=" } }) }) }, from(table) {
    if (!(table in rows)) throw new Error(`Unexpected preview table: ${table}`);
    const result = { data: rows[table], count: rows[table].length, error: scenario === "error" && (table === "projects" || table === "leads") ? { message: "Synthetic read failure" } : null };
    const chain = { then: (ok, fail) => Promise.resolve(result).then(ok, fail) };
    for (const method of ["select", "eq", "neq", "not", "order", "limit", "in"]) chain[method] = () => chain;
    chain.maybeSingle = () => { result.data = rows[table][0] ?? null; return chain; };
    return chain;
  } };
  const path = view === "scanner" ? "/leads/discover" : view.startsWith("lead") ? (view === "leads" ? "/leads" : "/leads/synthetic-lead-0") : view === "project" ? (role === "admin" ? "/projects/synthetic-a" : "/portal/projects/synthetic-a") : role === "admin" ? "/" : "/portal";
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
      if (name === "@/lib/supabase/server") return { createClient: async () => supabase };
      if (name === "@/lib/auth") {
        const identity = async () => ({ user: { id: "synthetic-review-user" }, profile: { role, full_name: scenario === "long" ? "Alexandria" : "Alex" } });
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
    vm.runInNewContext(code, { require: localRequire, module, exports: module.exports, console, Date, URL }, { filename: file });
    return module.exports;
  }
  const { AppShell } = load(resolve(root, "components/AppShell.tsx"));
  const Page = view === "scanner"
    ? load(resolve(root, "app/(protected)/(admin)/leads/discover/page.tsx")).default
    : view.startsWith("lead")
    ? load(resolve(root, view === "leads" ? "app/(protected)/(admin)/leads/page.tsx" : "app/(protected)/(admin)/leads/[leadId]/page.tsx")).default
    : view === "project"
    ? load(resolve(root, role === "admin" ? "app/(protected)/(admin)/projects/[projectId]/page.tsx" : "app/(protected)/portal/projects/[projectId]/page.tsx")).default
    : role === "admin" ? load(resolve(root, "components/Dashboard.tsx")).Dashboard : load(resolve(root, "app/(protected)/portal/page.tsx")).default;
  const content = renderToStaticMarkup(await Page({ params: Promise.resolve({ projectId: project.id, leadId: "synthetic-lead-0" }), searchParams: Promise.resolve({ section, error: scenario === "form-error" ? "Check the website URL and try again." : undefined }) }));
  const user = { name: "Synthetic Review Owner", email: "visual-review@example.invalid" };
  const html = renderToStaticMarkup(React.createElement(AppShell, { role, user }, React.createElement("div", { "data-preview-content": true, dangerouslySetInnerHTML: { __html: content } })));
  return { html, content, role, user, path };
}
