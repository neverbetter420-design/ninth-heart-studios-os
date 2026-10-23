import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { previewCSS, renderNocturne } from "../tests/helpers/nocturne-render.mjs";

// Output is synthetic HTML generated from the actual draft React components.
// It never initializes a hosted Supabase client or sends external requests.
const root = "nocturne-static-preview";
const screenMarkup = Object.create(null);
const safeJSON = value => JSON.stringify(value)
  .replace(/</g, "\\u003c")
  .replace(/>/g, "\\u003e")
  .replace(/&/g, "\\u0026");
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
const visualStyles = previewCSS + "\nbutton[disabled]{cursor:not-allowed!important}a[aria-disabled]{pointer-events:none!important}";
writeFileSync(join(root,"visual.css"), visualStyles);
for(const [role,views] of Object.entries(routes)){
  for(const view of views){
    const result=await renderNocturne(role,"populated",view);
    const html=stripActions(result.html);
    screenMarkup[role + "/" + view] = html;
    const frame='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NHS OS synthetic visual review</title><link rel="stylesheet" href="../../visual.css"></head><body>'+html+'</body></html>';
    if(/rquscwgdrqkzwjukiqtk|app\.ninthheartstudios\.com|sb_secret_|service_role/i.test(frame))throw new Error("Production identifier in "+role+"/"+view);
    writeFileSync(join(root,"frames",role,view+".html"),frame);
  }
}

if (!screenMarkup["admin/home"]?.includes("app-shell")) throw new Error("Default admin page missing");
if (/<\/style\b/i.test(visualStyles)) throw new Error("Unsafe CSS close tag");
const templates = Object.entries(screenMarkup).map(([key,markup]) => {
  if (/<\/template\b/i.test(markup)) throw new Error("Unsafe markup: "+key);
  return '<template data-nhs-screen="'+escape(key)+'">'+markup+'</template>';
}).join("\n");
const chromeCSS = [
  "*{box-sizing:border-box}",
  "html,body{margin:0;min-height:100%;background:#100b16;color:#f7eaf1;font-family:Arial,sans-serif}",
  ".nhs-preview-header{padding:24px clamp(16px,4vw,54px);background:linear-gradient(110deg,#150e1b,#422c42);border-bottom:1px solid #8a6b83}",
  ".nhs-preview-header h1{color:#fff4f1;font:400 clamp(28px,3.5vw,43px)/1.2 Georgia,serif;margin:10px 0}",
  ".nhs-preview-header p{color:#e9d7e5;max-width:950px;line-height:1.65}",
  ".nhs-preview-eyebrow{color:#ecd0c9!important;font-size:11px;letter-spacing:.14em;text-transform:uppercase}",
  ".nhs-preview-controls{display:flex;flex-wrap:wrap;align-items:end;gap:14px;margin-top:18px}",
  ".nhs-preview-controls label{display:grid;gap:6px;color:#fff0f4;font-size:13px}",
  ".nhs-preview-controls select{min-width:160px;min-height:46px;border:1px solid #ac8ba8;background:#31233b;color:white;padding:11px;border-radius:9px;font:inherit}",
  ".nhs-preview-note{font-size:12px;color:#f2dfeb!important}",
  ".nhs-preview-note a{color:#ffdce9;text-decoration:underline}",
  "#nhs-preview-stage{padding:24px 16px 40px;display:flex;justify-content:center}",
  "#preview{display:block;width:100%;max-width:100%;min-height:570px;background:#100d15;border:1px solid #8d7188;border-radius:17px;overflow:auto;box-shadow:0 20px 65px #04010880}",
  "#preview>.app-shell{min-height:650px}",
  ".nhs-preview-file-warning{padding:12px;background:#633c55;color:white;border:1px solid #c79bb2;border-radius:9px}",
  ".nhs-preview-file-warning[hidden]{display:none}",
  "@media(max-width:600px){.nhs-preview-header{padding:16px}.nhs-preview-controls select{min-width:125px}#nhs-preview-stage{padding:16px 8px}}"
].join("\n");
const controller=[
  '(function(){',
  'const r=document.getElementById("role"),v=document.getElementById("view"),w=document.getElementById("width");',
  'const surface=document.getElementById("preview"),standalone=document.getElementById("standalone-link");',
  'const templates=new Map(Array.from(document.querySelectorAll("template[data-nhs-screen]")).map(node=>[node.getAttribute("data-nhs-screen"),node]));',
  'function render(){const selected=templates.get(r.value+"/"+v.value);if(!selected)return;',
  'surface.replaceChildren(selected.content.cloneNode(true));',
  'surface.style.width=w.value==="mobile"?"390px":w.value==="tablet"?"768px":"100%";',
  'standalone.setAttribute("href","frames/"+r.value+"/"+v.value+".html");',
  'if(location.protocol==="http:"||location.protocol==="https:"){const url=new URL(location.href);url.searchParams.set("role",r.value);url.searchParams.set("view",v.value);history.replaceState(null,"",url);}}',
  'function populate(){const prior=v.value;v.replaceChildren(...routes[r.value].map(key=>{const option=document.createElement("option");option.value=key;option.textContent=key.replace(/^portal-/,"").replace(/-/g," ");return option;}));v.value=routes[r.value].includes(prior)?prior:"home";render();}',
  'r.addEventListener("change",populate);v.addEventListener("change",render);w.addEventListener("change",render);',
  'const params=new URLSearchParams(location.search);if(params.get("role")==="client")r.value="client";populate();if(routes[r.value].includes(params.get("view"))){v.value=params.get("view");render();}',
  'document.getElementById("file-warning").hidden=!/\\.zip(?:\\.cf\\d+)?\\//i.test(decodeURI(location.pathname));',
  '})();'
].join("\n");
const html=[
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NHS Nocturne Atelier · Visual Preview</title>',
  "<style>"+visualStyles+"</style>","<style>"+chromeCSS+"</style></head>",
  '<body><header class="nhs-preview-header">',
  '<p class="nhs-preview-eyebrow">Ninth Heart Studios · Nocturne: Atelier Edition</p><h1>Interactive layout review</h1>',
  '<p>Actual draft components with synthetic data. Choose Admin or Client, screen, and viewport. This is a <strong>visual preview only</strong>: sign-in, forms, messages, file access and payments are disabled. Production data is not connected.</p>',
  '<div class="nhs-preview-controls"><label>Environment<select id="role"><option value="admin">Admin Nocturne</option><option value="client">Client Atelier</option></select></label>',
  '<label>Screen<select id="view"><option value="home">home</option></select></label>',
  '<label>Viewport<select id="width"><option value="desktop">Responsive desktop</option><option value="tablet">Tablet (768px)</option><option value="mobile">Mobile (390px)</option></select></label></div>',
  '<p class="nhs-preview-note">Production NHS OS is separate and unchanged. <a id="standalone-link" href="frames/admin/home.html">Open current screen separately ↗</a></p>',
  '<p id="file-warning" class="nhs-preview-file-warning" role="alert" hidden>For best results, choose <strong>Extract All</strong> on the ZIP, then open the extracted index.html.</p>',
  '</header><div id="nhs-preview-stage"><main id="preview" aria-label="NHS synthetic screen preview">'+screenMarkup["admin/home"]+'</main></div>',
  '<div id="nhs-screen-templates" hidden>'+templates+'</div>',
  '<script>const routes='+JSON.stringify(routes)+';'+controller+'</script></body></html>'
].join("\n");
writeFileSync(join(root,"index.html"),html);
writeFileSync(join(root,"OPEN_PREVIEW_FIRST.txt"),[
  "NHS NOCTURNE ATELIER — LOCAL VISUAL PREVIEW",
  "",
  "1. In Downloads, right-click nhs-nocturne-html-preview.zip and choose Extract All.",
  "2. Open the extracted folder. Open index.html in Chrome or Edge.",
  "3. index.html now includes all 30 screens and styles. It works without a server or separate files.",
  "4. Choose Admin Nocturne or Client Atelier, screen, and viewport from the top controls.",
  "",
  "This is a visual demonstration with synthetic data, not the production app.",
  "Links, actions, sign-in and payments do not operate in this preview.",
].join("\n")+"\n");
writeFileSync(join(root,"_headers"),[
"/*",
"  X-Content-Type-Options: nosniff",
"  Referrer-Policy: no-referrer",
"  X-Frame-Options: SAMEORIGIN",
"  Permissions-Policy: camera=(), microphone=(), geolocation=()",
"  Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src data:; font-src data:; frame-src 'self' about:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
""].join("\n"));
console.log("Generated "+Object.values(routes).reduce((sum,a)=>sum+a.length,0)+" synthetic source-rendered visual pages.");
