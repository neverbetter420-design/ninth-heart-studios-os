import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { previewCSS, renderNocturne } from "../tests/helpers/nocturne-render.mjs";

// Output is synthetic HTML generated from the actual draft React components.
// It never initializes a hosted Supabase client or sends external requests.
const root = "nocturne-static-preview";
const routes = {
  admin: ["home","project","clients","client-detail","pipeline","leads","lead-detail","scanner","contracts","contract-detail","forms","form-detail","templates","template-detail","muse","settings","opportunities","opportunity-detail","automations","controls"],
  client: ["home","project","portal-projects","portal-documents","portal-messages","portal-files","portal-approvals","portal-contracts","portal-forms","controls"]
};
const escape = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const stripActions = html => html
 .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
 .replace(/<link\b[^>]*>/gi,"")
 .replace(/<form\b([^>]*)>/gi,(_,a)=>"<form"+a.replace(/\s(?:action|method|target)=(["']).*?\1/gi,"")+" action=\"#\" aria-disabled=\"true\">")
 .replace(/<button\b([^>]*)>/gi,(_,a)=>"<button"+a+" disabled aria-disabled=\"true\">")
 .replace(/<input\b([^>]*)>/gi,(tag,a)=>/\btype=['"](?:submit|reset|image)['"]/i.test(a)?"<input"+a+" disabled aria-disabled=\"true\">":tag)
 .replace(/<a\b([^>]*)>/gi,(_,a)=>{
   const match=/\shref=(["'])(.*?)\1/i.exec(a);
   const hash=/^#[a-zA-Z0-9_-]+$/.test(match?.[2]||"");
   const rest=a.replace(/\s(?:href|target|download)=(["']).*?\1/gi,"").replace(/\sdownload\b/gi,"");
   return "<a"+rest+(hash?' href="'+escape(match[2])+'"':' aria-disabled="true" tabindex="-1"')+">";
 })
 .replace(/<(?:iframe|object|embed)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed)>/gi,"")
 .replace(/<(?:iframe|object|embed)\b[^>]*\/?>/gi,"")
 .replace(/\s(?:src|poster)=(["'])https?:\/\/.*?\1/gi,"")
 .replace(/\s(?:srcset|ping|formaction)=(["']).*?\1/gi,"");
for (const role of Object.keys(routes)) mkdirSync(join(root,"frames",role),{recursive:true});
writeFileSync(join(root,"visual.css"),previewCSS+"\nbutton[disabled]{cursor:not-allowed!important}a[aria-disabled]{pointer-events:none!important}");
for(const [role,views] of Object.entries(routes)){
  for(const view of views){
    const result=await renderNocturne(role,"populated",view);
    const html=stripActions(result.html);
    const frame='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NHS OS synthetic visual review</title><link rel="stylesheet" href="/visual.css"></head><body>'+html+'</body></html>';
    if(/rquscwgdrqkzwjukiqtk|app\.ninthheartstudios\.com|sb_secret_|service_role/i.test(frame))throw new Error("Production identifier in "+role+"/"+view);
    writeFileSync(join(root,"frames",role,view+".html"),frame);
  }
}
const html=[
'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NHS Nocturne Atelier · Visual Preview</title>',
'<style>*{box-sizing:border-box}body{margin:0;background:#150e1b;color:#fbf0e7;font:14px/1.5 system-ui,sans-serif}header{padding:22px clamp(18px,4vw,56px);border-bottom:1px solid #604660;background:linear-gradient(110deg,#160e1b,#38243d)}h1{font:400 clamp(27px,4vw,44px)/1.15 Georgia,serif;margin:10px 0}p{color:#e0cee0;max-width:900px}.eyebrow{font-size:10px;letter-spacing:.18em;color:#eed5c1;text-transform:uppercase}.toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:end}.toolbar label{display:grid;gap:5px;color:#f0d8e7;font-size:12px}select{border:1px solid #95748e;border-radius:7px;min-height:44px;min-width:165px;padding:9px;background:#32233b;color:#fff;font:inherit}.frame{display:block;margin:22px auto 38px;border:1px solid #755479;border-radius:8px;background:#fff;box-shadow:0 18px 58px #0704099c;width:calc(100% - 32px);min-height:600px;height:72vh}.note{font-size:12px;color:#e9cdbf}@media(max-width:600px){header{padding:16px}.frame{height:73dvh}}</style></head>',
'<body><header><div class="eyebrow">Ninth Heart Studios · Nocturne: Atelier Edition</div><h1>Interactive layout review</h1>',
'<p>Real draft components with synthetic data, rendered as static HTML. Select Admin or Client, a screen, and a viewport. This is a <strong>visual preview only</strong>: links, forms, messages, sign-in, file access and payments are disabled. No production data or services are connected.</p>',
'<div class="toolbar"><label>Environment<select id="role"><option value="admin">Admin Nocturne</option><option value="client">Client Atelier</option></select></label>',
'<label>Screen<select id="view"></select></label><label>Viewport<select id="width"><option value="desktop">Responsive desktop</option><option value="tablet">Tablet (768px)</option><option value="mobile">Mobile (390px)</option></select></label></div>',
'<p class="note">Production NHS OS is separate and remains unchanged.</p></header>',
'<iframe id="preview" class="frame" title="Source-rendered Nocturne screen" sandbox="allow-same-origin" referrerpolicy="no-referrer"></iframe>',
'<script>const routes='+JSON.stringify(routes)+';const r=document.getElementById("role"),v=document.getElementById("view"),w=document.getElementById("width"),f=document.getElementById("preview");',
'function show(){if(!routes[r.value].includes(v.value))return;f.src="/frames/"+r.value+"/"+v.value+".html";f.style.width=w.value==="mobile"?"390px":w.value==="tablet"?"768px":"calc(100% - 32px)";f.style.maxWidth="calc(100% - 24px)";const u=new URL(location.href);u.searchParams.set("role",r.value);u.searchParams.set("view",v.value);history.replaceState(null,"",u);}',
'function populate(){const prior=v.value;v.replaceChildren(...routes[r.value].map(x=>{const o=document.createElement("option");o.value=x;o.textContent=x.replace(/^portal-/,"").replace(/-/g," ");return o}));v.value=routes[r.value].includes(prior)?prior:"home";show()}',
'r.addEventListener("change",populate);v.addEventListener("change",show);w.addEventListener("change",show);const q=new URLSearchParams(location.search);if(q.get("role")==="client")r.value="client";populate();if(routes[r.value].includes(q.get("view"))){v.value=q.get("view");show()}</script></body></html>'
].join("\n");
writeFileSync(join(root,"index.html"),html);
writeFileSync(join(root,"_headers"),[
"/*",
"  X-Content-Type-Options: nosniff",
"  Referrer-Policy: no-referrer",
"  X-Frame-Options: SAMEORIGIN",
"  Permissions-Policy: camera=(), microphone=(), geolocation=()",
"  Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src data:; font-src data:; frame-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
""].join("\n"));
console.log("Generated "+Object.values(routes).reduce((sum,a)=>sum+a.length,0)+" synthetic source-rendered visual pages.");
