import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Review screenshots come ONLY from the disposable localhost Supabase CI.
// No hosted data, credentials, session cookies or live app endpoints are read.
const directory = "design-preview";
const names = readdirSync(directory)
  .filter((name) => /^[a-z0-9-]+-(desktop|mobile)\.png$/.test(name));
const screens = new Map();
for (const filename of names) {
  if (statSync(join(directory, filename)).size < 1000) {
    throw new Error("Empty visual capture: " + filename);
  }
  const match = /^([a-z0-9-]+)-(desktop|mobile)\.png$/.exec(filename);
  const id = match[1];
  const viewport = match[2];
  if (!screens.has(id)) {
    screens.set(id, {
      id,
      role: id.startsWith("atelier-") ? "client" : "admin",
      title: id.replace(/^(atelier-|nocturne-)/, "")
        .replace(/-/g, " ").replace(/\b\w/g, (v) => v.toUpperCase()),
    });
  }
  screens.get(id)[viewport] = filename;
}
if (screens.size !== 28 || names.length !== 56) {
  throw new Error("Expected 28 paired synthetic screens / 56 captures; got " +
    screens.size + " screens and " + names.length + " captures.");
}
for (const screen of screens.values()) {
  if (!screen.desktop || !screen.mobile) {
    throw new Error("Missing desktop or mobile screenshot for " + screen.id);
  }
}
const gallery = [...screens.values()].sort((a, b) =>
  a.role.localeCompare(b.role) ||
  (a.id.includes("home") ? -1 : b.id.includes("home") ? 1 : a.title.localeCompare(b.title)));
const pieces = [
  "<!doctype html><html lang='en'><head><meta charset='utf-8'>",
  "<meta name='viewport' content='width=device-width,initial-scale=1'>",
  "<meta name='referrer' content='no-referrer'>",
  "<title>NHS Nocturne Atelier · Visual Review</title><style>",
  ":root{color-scheme:dark;--bg:#130f19;--muted:#d1bcd0;--border:#5a435c}",
  "*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 90% 0%,#36213b,var(--bg) 55%);font:14px/1.55 system-ui,Arial,sans-serif;color:#fff5e9}",
  "header{padding:32px clamp(18px,4vw,60px);border-bottom:1px solid var(--border)}",
  ".eyebrow{font-size:10px;letter-spacing:.2em;color:#e2c7b4;text-transform:uppercase}",
  "h1,h2{font:400 clamp(29px,4vw,54px)/1.12 Georgia,serif;margin:12px 0;letter-spacing:-.035em}",
  "header p{max-width:860px;color:var(--muted)}.controls{padding:16px clamp(18px,4vw,60px);display:flex;flex-wrap:wrap;gap:12px;align-items:end;background:#211828;border-bottom:1px solid var(--border)}",
  "label{display:grid;gap:6px;font-size:12px;color:#dbc6d8}select,button{background:#39263d;border:1px solid #806181;color:#fff5e9;border-radius:8px;padding:10px 12px;min-height:44px;font:inherit}button{cursor:pointer}button[aria-pressed=true]{background:#ddc0af;color:#231423;font-weight:700}",
  ":is(button,select,a,img):focus-visible{outline:3px solid #efd2ac;outline-offset:3px}",
  "main{padding:30px clamp(18px,4vw,60px);max-width:1760px;margin:auto}.views{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(270px,.65fr);gap:22px;align-items:start}.views.single{grid-template-columns:1fr;max-width:1250px}",
  "figure{min-width:0;border:1px solid var(--border);padding:12px;border-radius:12px;background:#211927;margin:0}figcaption{display:flex;justify-content:space-between;gap:10px;padding:0 0 12px;text-transform:uppercase;letter-spacing:.12em;font-size:11px}figure img{width:100%;height:auto;display:block;border-radius:5px;cursor:zoom-in;background:#fff}a{color:#e7c9b2;text-transform:none;letter-spacing:0}",
  "dialog{border:1px solid var(--border);border-radius:12px;background:#130f19;color:#fff5e9;max-width:97vw;max-height:96vh}dialog img{max-width:92vw;max-height:80vh;object-fit:contain}dialog .bar{display:flex;justify-content:space-between;gap:20px;padding-bottom:12px}dialog::backdrop{background:#070509d9}",
  "footer{padding:26px clamp(18px,4vw,60px);border-top:1px solid var(--border);color:var(--muted)}@media(max-width:860px){.views{grid-template-columns:1fr}}",
  "</style></head><body><header><div class='eyebrow'>Ninth Heart Studios · Pre-launch design review</div>",
  "<h1>Nocturne: Atelier Edition</h1><p>28 screens, 56 real desktop/mobile captures, generated from the draft application with synthetic users in disposable local Supabase. <strong>Visual-only:</strong> this is not a signed-in app, no controls are functional and no live client data is included.</p></header>",
  "<div class='controls'><div role='group' aria-label='Portal role'><button data-role='admin' aria-pressed='true'>Admin Nocturne</button> <button data-role='client' aria-pressed='false'>Client Atelier</button></div>",
  "<label>Screen<select id='screens'></select></label><label>View<select id='mode'><option value='both'>Desktop and mobile</option><option value='desktop'>Desktop</option><option value='mobile'>Mobile</option></select></label><span id='count'></span></div>",
  "<main><h2 id='title'></h2><div id='views' class='views'></div></main><footer>Synthetic CI design screenshots · This review does not authorize production merges, migrations or deployment.</footer>",
  "<dialog id='zoom'><div class='bar'><strong id='zoomTitle'>Enlarged screen</strong><button id='close'>Close</button></div><img id='zoomImage' alt='Enlarged design screenshot'></dialog>",
  "<script id='data' type='application/json'>",
  JSON.stringify(gallery).replace(/</g, "\\u003c"),
  "</script><script>",
  "const data=JSON.parse(document.getElementById('data').textContent);const el=id=>document.getElementById(id);let role='admin',chosen='',mode='both';",
  "const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/'/g,'&#39;');",
  "const choices=()=>data.filter(x=>x.role===role);",
  "function draw(){const arr=choices(),s=arr.find(x=>x.id===chosen)||arr[0];if(!s)return;chosen=s.id;el('title').textContent=s.title;el('count').textContent=(arr.indexOf(s)+1)+' of '+arr.length+' screens';const types=mode==='both'?['desktop','mobile']:[mode];el('views').className='views'+(types.length===1?' single':'');el('views').innerHTML=types.map(v=>'<figure><figcaption><b>'+v+'</b><a href=\"'+esc(s[v])+'\" download>Original PNG</a></figcaption><img tabindex=\"0\" data-image=\"'+esc(s[v])+'\" alt=\"'+esc(s.title+' '+v)+'\" src=\"'+esc(s[v])+'\"></figure>').join('');for(const img of el('views').querySelectorAll('[data-image]')){const zoom=()=>{el('zoomImage').src=img.dataset.image;el('zoomTitle').textContent=s.title;el('zoom').showModal()};img.addEventListener('click',zoom);img.addEventListener('keydown',e=>{if(e.key==='Enter')zoom()})}}",
  "function changeRole(next){role=next;document.querySelectorAll('[data-role]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.role===next)));el('screens').innerHTML=choices().map(s=>'<option value=\"'+esc(s.id)+'\">'+esc(s.title)+'</option>').join('');chosen=choices()[0]?.id||'';el('screens').value=chosen;draw()}",
  "document.querySelectorAll('[data-role]').forEach(b=>b.addEventListener('click',()=>changeRole(b.dataset.role)));el('screens').addEventListener('change',e=>{chosen=e.target.value;draw()});el('mode').addEventListener('change',e=>{mode=e.target.value;draw()});el('close').addEventListener('click',()=>el('zoom').close());el('zoom').addEventListener('click',e=>{if(e.target===el('zoom'))el('zoom').close()});changeRole('admin');",
  "</script></body></html>",
];
const rendered = pieces.join("\n");
writeFileSync(join(directory, "Open_This_Review.html"), rendered, "utf8");
writeFileSync(join(directory, "index.html"), rendered, "utf8");
writeFileSync(join(directory, "_headers"), [
  "/*",
  "  X-Content-Type-Options: nosniff",
  "  Referrer-Policy: no-referrer",
  "  X-Frame-Options: DENY",
  "  Permissions-Policy: camera=(), microphone=(), geolocation=()",
  "  Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "",
].join("\n"), "utf8");
console.log("Generated isolated, browsable screenshot gallery for " + gallery.length + " screens.");
