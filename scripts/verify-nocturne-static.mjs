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
assert.ok(index.includes("f.srcdoc="), "Iframe must use self-contained srcdoc, not local file URLs");
assert.ok(!index.includes('f.src="frames/"'), "Preview must not load local frames");
assert.ok(index.includes('sandbox=""'), "Frame must keep scripts and navigation sandboxed");
const screenMatch = index.match(/<script type="application\/json" id="nhs-screen-data">([\s\S]*?)<\/script>/);
const styleMatch = index.match(/<script type="application\/json" id="nhs-style-data">([\s\S]*?)<\/script>/);
assert.ok(screenMatch && styleMatch, "All screen markup and style must be embedded in index.html");
const screens = JSON.parse(screenMatch[1]);
const styles = JSON.parse(styleMatch[1]);
assert.deepEqual(Object.keys(screens).sort(), frames.map(name => name.slice(0, -5)).sort());
assert.equal(styles, readFileSync(join(root, "visual.css"), "utf8"));
for (const [key, markup] of Object.entries(screens)) {
  assert.ok(markup.includes("app-shell"), "Rendered shell missing from " + key);
  assert.ok(!/<script\b/i.test(markup), "Executable script found in " + key);
  assert.ok(!/rquscwgdrqkzwjukiqtk|sb_secret_|service_role|app\.ninthheartstudios\.com/i.test(markup), "Production identifier in " + key);
}
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
