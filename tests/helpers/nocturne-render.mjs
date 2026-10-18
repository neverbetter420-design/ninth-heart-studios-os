import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = resolve(import.meta.dirname, "../..");
const require = createRequire(import.meta.url);
const styles = ["globals", "phase2", "phase3", "phase4", "phase7", "scanner", "navigation", "nocturne", "nocturne-phase3"];
export const previewCSS = styles.map((name) => readFileSync(resolve(root, `app/${name}.css`), "utf8"))
  .join("\n").replace('@import "tailwindcss";', "");

// Render the actual draft components with in-memory synthetic reads. No hosted
// SDK, credentials, server actions, database, or network connection is loaded.
export async function renderNocturne(role, scenario = "normal") {
  const longTitle = "Alexandria's extraordinarily detailed studio website and international collection";
  const project = { id: "synthetic-a", client_id: "synthetic-client", name: scenario === "long" ? longTitle : "Synthetic Studio Website", status: "design", progress: 100, due_date: null };
  const rows = {
    projects: scenario === "empty" ? [] : [project],
    approvals: scenario === "empty" ? [] : [{ id: "synthetic-approval", title: scenario === "long" ? "UnbrokenApprovalTitle".repeat(8) : "Review the homepage design", project_id: project.id }],
    leads: scenario === "populated" ? ["Cedar & Stone", "Mira Studio", "Northline Editions"].map((name, i) => ({
      id: `synthetic-lead-${i}`, business_name: name, acquisition_type: "outbound",
      momentum_state: "Waiting on Me", status: "prospect", next_action_kind: "reply",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })) : [], opportunities: [], activities: [],
  };
  const supabase = { from(table) {
    if (!(table in rows)) throw new Error(`Unexpected preview table: ${table}`);
    const result = { data: rows[table], count: rows[table].length, error: scenario === "error" && table === "projects" ? { message: "Synthetic read failure" } : null };
    const chain = { then: (ok, fail) => Promise.resolve(result).then(ok, fail) };
    for (const method of ["select", "eq", "neq", "not", "order", "limit"]) chain[method] = () => chain;
    return chain;
  } };
  const path = role === "admin" ? "/" : "/portal";
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
      if (name === "@/lib/auth") return { requireUser: async () => ({ profile: { role, full_name: scenario === "long" ? "Alexandria" : "Alex" } }) };
      if (name === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
      if (name === "next/navigation") return { usePathname: () => path, redirect: () => { throw new Error("Unexpected preview redirect"); } };
      if (name.startsWith("@/") || name.startsWith(".")) {
        const base = name.startsWith("@/") ? resolve(root, name.slice(2)) : resolve(dirname(file), name);
        const resolved = [base, base + ".tsx", base + ".ts"].find((candidate) => existsSync(candidate));
        if (!resolved) throw new Error(`Missing preview import: ${name}`);
        return load(resolved);
      }
      if (!["react", "react/jsx-runtime"].includes(name)) throw new Error(`Unapproved preview import: ${name}`);
      return require(name);
    };
    vm.runInNewContext(code, { require: localRequire, module, exports: module.exports, console, Date, URL }, { filename: file });
    return module.exports;
  }
  const { AppShell } = load(resolve(root, "components/AppShell.tsx"));
  const Page = role === "admin" ? load(resolve(root, "components/Dashboard.tsx")).Dashboard : load(resolve(root, "app/(protected)/portal/page.tsx")).default;
  const content = renderToStaticMarkup(await Page());
  const user = { name: "Synthetic Review Owner", email: "visual-review@example.invalid" };
  const html = renderToStaticMarkup(React.createElement(AppShell, { role, user }, React.createElement("div", { "data-preview-content": true, dangerouslySetInnerHTML: { __html: content } })));
  return { html, content, role, user, path };
}
