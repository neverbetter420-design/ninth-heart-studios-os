import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Static synthetic design previews cannot contain server functions or production connections.
const root = "nocturne-static-preview";
const config = JSON.parse(readFileSync("wrangler.nocturne-static.jsonc","utf8"));
assert.equal(config.name,"nhs-nocturne-html-preview");
assert.deepEqual(config.routes,[]);
assert.equal(config.keep_vars,false);
assert.equal(config.workers_dev,true);
assert.deepEqual(config.assets,{directory:"./nocturne-static-preview"});
assert.equal(Object.hasOwn(config,"main"),false);
assert.equal(Object.hasOwn(config,"vars"),false);
const frames=[];
for(const role of ["admin","client"]){
  for(const name of readdirSync(join(root,"frames",role))){
    assert.match(name,/^[a-z-]+\.html$/);
    const html=readFileSync(join(root,"frames",role,name),"utf8");
    assert.ok(html.includes("href=\"../../visual.css\""));
    assert.ok(!/<script\b/i.test(html),"No scripts are allowed in a screenshot frame");
    assert.ok(!/\shref=(["'])https?:\/\//i.test(html));
    assert.ok(!/\ssrc=(["'])https?:\/\//i.test(html));
    assert.ok(!/rquscwgdrqkzwjukiqtk|sb_secret_|service_role|app\.ninthheartstudios\.com/i.test(html));
    frames.push(role+"/"+name);
  }
}
assert.equal(frames.length,30);
assert.ok(frames.includes("admin/home.html")&&frames.includes("client/home.html"));
const index=readFileSync(join(root,"index.html"),"utf8");
assert.ok(index.includes("synthetic data"));
assert.ok(index.includes('<main id="preview" aria-label="NHS synthetic screen preview">'), "Default screen must be visible in HTML");
assert.ok(!/<iframe\b/i.test(index), "Preview must not contain a frame");
assert.ok(index.includes("surface.replaceChildren(selected.content.cloneNode(true))"),"Screen switching must clone templates in-page");
assert.ok(index.includes("<style>"+css+"</style>"), "CSS must be embedded in index");
const templates=[...index.matchAll(/<template data-nhs-screen="([^"]+)">([\s\S]*?)<\/template>/g)];
assert.equal(templates.length,frames.length,"Exactly 30 embedded templates expected");
assert.deepEqual(templates.map(t=>t[1]).sort(),frames.map(n=>n.slice(0,-5)).sort());
for(const [,key,markup] of templates){
 assert.ok(markup.includes("app-shell"),"Missing rendered app shell in "+key);
 assert.ok(!/<script\b/i.test(markup),"Scripts forbidden in "+key);
 assert.ok(!/rquscwgdrqkzwjukiqtk|sb_secret_|service_role|app\.ninthheartstudios\.com/i.test(markup),"Production identifier in "+key);
}
const initial=index.slice(index.indexOf('<main id="preview"'),index.indexOf("</main>",index.indexOf('<main id="preview"')));
assert.ok(initial.includes("nhs-theme-admin")&&initial.includes("app-shell"),"Default HTML must show Admin before JavaScript");
assert.ok(initial.includes("Command Center"),"Default HTML must show meaningful content");
assert.ok(index.includes("Extract All"), "A compressed ZIP warning must be present");
assert.ok(index.includes("visual preview only"));
assert.ok(!/NEXT_PUBLIC_SUPABASE|rquscwgdrqkzwjukiqtk/i.test(index));
const css=readFileSync(join(root,"visual.css"),"utf8");
assert.ok(css.length>1000);
assert.ok(!/https?:\/\//i.test(css),"Visual CSS must make no remote fetches");
const headers=readFileSync(join(root,"_headers"),"utf8");
assert.ok(headers.includes("connect-src 'none'"));
assert.ok(headers.includes("form-action 'none'"));
assert.ok(headers.includes("frame-ancestors 'self'"));
assert.equal(readdirSync(root).sort().join(","),["_headers","frames","index.html","visual.css","OPEN_PREVIEW_FIRST.txt"].sort().join(","));
assert.ok(statSync(join(root,"index.html")).size>100000, "Single-file preview must contain rendered screens and CSS");
console.log("NHS HTML visual preview verified: 30 actual source-rendered synthetic screens, no remote calls.");
