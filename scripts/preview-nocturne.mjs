import { createServer } from "node:http";
import { previewCSS, previewTypography, renderNocturne } from "../tests/helpers/nocturne-render.mjs";

// This is a local source-rendered design review, not a Next.js server. The
// fixture supplies synthetic reads and refuses server actions and hosted SDKs.
const host = "127.0.0.1";
const rawPort = process.env.NHS_VISUAL_PORT ?? "4173";
if (!/^[0-9]{1,5}$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) {
  throw new Error("NHS_VISUAL_PORT must be an integer between 1 and 65535.");
}
const port = Number(rawPort);
const origin = `http://${host}:${port}`;
const views = {
  admin: [
    ["home", "Studio overview"], ["project", "Project workspace"],
    ["clients", "Clients"], ["client-detail", "Client details"],
    ["pipeline", "Project pipeline"], ["leads", "Leads"],
    ["lead-detail", "Lead details"], ["scanner", "Lead discovery"],
    ["contracts", "Contracts"], ["contract-detail", "Contract details"],
    ["forms", "Forms"], ["form-detail", "Form details"],
    ["templates", "Templates"], ["template-detail", "Template details"],
    ["muse", "Muse"], ["settings", "Settings"],
    ["opportunities", "Opportunities"], ["opportunity-detail", "Opportunity details"],
    ["automations", "Automations"], ["controls", "Interface controls"],
  ],
  client: [
    ["home", "Client overview"], ["project", "Project workspace"],
    ["portal-projects", "Projects"], ["portal-documents", "Documents"],
    ["portal-messages", "Messages"], ["portal-files", "Files"],
    ["portal-approvals", "Approvals"], ["portal-contracts", "Contracts"],
    ["portal-forms", "Forms"], ["controls", "Interface controls"],
  ],
};
const scenarios = ["populated", "normal", "empty", "long", "error"];
const viewportWidths = { responsive: "100%", desktop: "1440px", tablet: "768px", mobile: "390px" };
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const decodeAttribute = (value) => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#(?:39|x27);/gi, "'");

function selection(url) {
  const role = url.searchParams.get("role") === "client" ? "client" : "admin";
  const requestedView = url.searchParams.get("view");
  const view = views[role].some(([value]) => value === requestedView) ? requestedView : "home";
  const scenario = scenarios.includes(url.searchParams.get("scenario")) ? url.searchParams.get("scenario") : "populated";
  const viewport = Object.hasOwn(viewportWidths, url.searchParams.get("viewport")) ? url.searchParams.get("viewport") : "responsive";
  const requestedSection = url.searchParams.get("section") ?? "";
  const section = /^[a-z-]{1,40}$/.test(requestedSection) ? requestedSection : "";
  return { role, view, scenario, viewport, section };
}

function reviewURL(path, selected, overrides = {}) {
  const params = new URLSearchParams({ ...selected, ...overrides });
  if (!params.get("section")) params.delete("section");
  return `${path}?${params}`;
}

function mapSourceHref(href, selected, sourcePath) {
  if (/^#[a-z0-9_-]*$/i.test(href)) return href;
  if (!(href.startsWith("/") || href.startsWith("?")) || href.startsWith("//")) return null;
  const target = new URL(href, origin + sourcePath);
  const path = target.pathname;
  let view;
  if (selected.role === "client") {
    view = path === "/portal" ? "home"
      : /^\/portal\/projects\/[^/]+$/.test(path) ? "project"
      : ({ "/portal/projects": "portal-projects", "/portal/documents": "portal-documents", "/portal/messages": "portal-messages", "/portal/files": "portal-files", "/portal/approvals": "portal-approvals", "/portal/contracts": "portal-contracts", "/portal/forms": "portal-forms" })[path];
  } else {
    view = ({ "/": "home", "/projects": "pipeline", "/clients": "clients", "/leads": "leads", "/leads/discover": "scanner", "/contracts": "contracts", "/forms": "forms", "/templates": "templates", "/muse": "muse", "/settings": "settings", "/opportunities": "opportunities", "/automations": "automations" })[path];
    if (!view) {
      for (const [prefix, detail] of [["projects", "project"], ["clients", "client-detail"], ["leads", "lead-detail"], ["contracts", "contract-detail"], ["forms", "form-detail"], ["templates", "template-detail"], ["opportunities", "opportunity-detail"]]) {
        if (new RegExp(`^/${prefix}/[^/]+$`).test(path)) { view = detail; break; }
      }
    }
  }
  if (!view) return null;
  const section = target.searchParams.get("section") ?? "";
  return reviewURL("/screen", selected, { view, section: /^[a-z-]{1,40}$/.test(section) ? section : "" }) + (/^#[a-z0-9_-]*$/i.test(target.hash) ? target.hash : "");
}

function readOnlyMarkup(html, selected, sourcePath) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<form\b([^>]*)>/gi, (_, attrs) => `<form${attrs.replace(/\s(?:action|method|target)=("[^"]*"|'[^']*')/gi, "")} action="#" aria-disabled="true">`)
    .replace(/<button\b([^>]*)>/gi, (tag, attrs) => /\btype=["']button["']/i.test(attrs) || /\bdisabled(?:\s|=|$)/i.test(attrs) ? tag : `<button${attrs} disabled aria-disabled="true">`)
    .replace(/<input\b([^>]*)>/gi, (tag, attrs) => /\btype=["'](?:submit|image|reset)["']/i.test(attrs) && !/\bdisabled(?:\s|=|$)/i.test(attrs) ? `<input${attrs} disabled aria-disabled="true">` : tag)
    .replace(/<a\b([^>]*)>/gi, (tag, attrs) => {
      const match = attrs.match(/\bhref=("([^"]*)"|'([^']*)')/i);
      if (!match) return tag;
      const href = mapSourceHref(decodeAttribute(match[2] ?? match[3]), selected, sourcePath);
      const remaining = attrs.replace(/\s(?:href|target|download)=("[^"]*"|'[^']*')/gi, "").replace(/\sdownload(?=\s|$)/gi, "");
      return href === null
        ? `<a${remaining} aria-disabled="true" tabindex="-1" title="Link unavailable in this local design review">`
        : `<a${remaining} href="${escapeHTML(href)}">`;
    });
}

function toolbarPage(selected) {
  const title = views[selected.role].find(([value]) => value === selected.view)[1];
  const option = (value, label, current) => `<option value="${escapeHTML(value)}"${current === value ? " selected" : ""}>${escapeHTML(label)}</option>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(title)} · NHS OS design review</title><style>
    *{box-sizing:border-box}body{margin:0;background:#17121b;color:#f7efe4;font:14px/1.45 system-ui,sans-serif}header{padding:14px 20px;border-bottom:1px solid #514050;background:#221a28}h1{font-size:16px;margin:0 0 5px;color:#f1dfc6}p{margin:4px 0;color:#c4b7c5}.roles{display:flex;gap:8px;margin:12px 0}a{color:#f1dfc6}a[aria-current=page]{background:#62465e}.roles a,.screens a{border:1px solid #66505e;border-radius:6px;padding:6px 10px;text-decoration:none}.roles a:focus-visible,.screens a:focus-visible,select:focus-visible,button:focus-visible{outline:3px solid #d8b783;outline-offset:2px}form{display:flex;flex-wrap:wrap;align-items:end;gap:12px}label{display:grid;gap:4px;font-size:12px}select,button{font:inherit;padding:7px 10px;border:1px solid #796070;border-radius:5px;background:#302535;color:#fff4e6}button{cursor:pointer;background:#6d4f61}.screens{display:flex;flex-wrap:wrap;gap:8px;padding-top:10px}.screens a{font-size:12px}summary{cursor:pointer;margin-top:12px}main{overflow:auto;padding:16px 0}iframe{display:block;border:0;background:#211a29;height:calc(100dvh - 285px);min-height:540px;margin:0 auto;box-shadow:0 0 0 1px #65505e}@media(max-width:600px){header{padding:12px}form{gap:8px}label{flex:1;min-width:130px}select{width:100%}iframe{height:70dvh}main{padding-top:12px}}
  </style></head><body><header><h1>Design review · Synthetic data · Actions disabled</h1><p>Actual source-rendered NHS OS screens. This is a local visual fixture, not a signed-in session or the live app.</p><nav class="roles" aria-label="Review role">${["admin", "client"].map((role) => `<a href="${escapeHTML(reviewURL("/", selected, { role, view: "home", section: "" }))}"${role === selected.role ? ' aria-current="page"' : ""}>${role === "admin" ? "Admin studio" : "Client atelier"}</a>`).join("")}</nav><form method="get" action="/"><input type="hidden" name="role" value="${selected.role}"><label>Screen<select name="view">${views[selected.role].map(([value, label]) => option(value, label, selected.view)).join("")}</select></label><label>Viewport<select name="viewport">${[["responsive", "Responsive"], ["desktop", "Desktop · 1440px"], ["tablet", "Tablet · 768px"], ["mobile", "Mobile · 390px"]].map(([value, label]) => option(value, label, selected.viewport)).join("")}</select></label><label>Synthetic scenario<select name="scenario">${scenarios.map((value) => option(value, value, selected.scenario)).join("")}</select></label><button type="submit">Review screen</button></form><p>Use this screen selector on mobile; the source navigation drawer is not hydrated. Local section links and details remain available.</p><details><summary>All ${selected.role} review screens</summary><nav class="screens" aria-label="Review screens">${views[selected.role].map(([view, label]) => `<a href="${escapeHTML(reviewURL("/", selected, { view, section: "" }))}"${view === selected.view ? ' aria-current="page"' : ""}>${escapeHTML(label)}</a>`).join("")}</nav></details></header><main><iframe title="${escapeHTML(title)} — source-rendered visual fixture" sandbox="allow-same-origin" src="${escapeHTML(reviewURL("/screen", selected))}" style="width:${viewportWidths[selected.viewport]}"></iframe></main></body></html>`;
}

const server = createServer(async (request, response) => {
  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'",
  };
  const send = (status, body, extra = {}) => {
    response.writeHead(status, { ...headers, ...extra });
    response.end(request.method === "HEAD" ? undefined : body);
  };
  if (!["GET", "HEAD"].includes(request.method ?? "")) {
    request.resume();
    send(405, "<!doctype html><p>Actions are disabled in this local design review.</p>", { Allow: "GET, HEAD" });
    return;
  }
  // Refuse alternate hostnames as well as binding exclusively to loopback.
  if (request.headers.host !== new URL(origin).host) {
    send(403, "<!doctype html><p>This review is available only through its local loopback address.</p>");
    return;
  }
  let url;
  try { url = new URL(request.url ?? "/", origin); }
  catch { send(400, "<!doctype html><p>Invalid review URL.</p>"); return; }
  if (url.origin !== origin || !["/", "/screen"].includes(url.pathname)) {
    send(404, "<!doctype html><p>Review screen not found.</p>");
    return;
  }
  const selected = selection(url);
  if (url.pathname === "/") { send(200, toolbarPage(selected)); return; }
  try {
    const result = await renderNocturne(selected.role, selected.scenario, selected.view, selected.section);
    const html = readOnlyMarkup(result.html, selected, result.path);
    send(200, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NHS OS · Source-rendered review</title><style>${previewCSS.replace(/<\/style/gi, "<\\/style")}</style></head><body>${html}</body></html>`, {
      "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; sandbox allow-same-origin`,
    });
  } catch {
    console.error("A source-rendered review screen could not be rendered.");
    send(500, "<!doctype html><p>This review screen could not be rendered. Select another screen from the review toolbar.</p>");
  }
});
server.on("error", (error) => {
  console.error(error.code === "EADDRINUSE" ? `Port ${port} is already in use. Set NHS_VISUAL_PORT to another local port.` : "The local design review could not start.");
  process.exitCode = 1;
});
server.listen(port, host, () => {
  console.log(`NHS OS local design review: ${origin}`);
  console.log("Design review · Synthetic data · Actions disabled. Source-rendered; not signed in or live.");
  console.log(previewTypography);
});
