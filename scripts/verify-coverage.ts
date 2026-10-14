// Coverage verification: no stub pages left, nav resolves, every feature
// has a verify script. Structural — reads the repo, no database.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

// 1. No ModulePage stubs left anywhere in app/
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx") || p.endsWith(".ts")) out.push(p);
  }
  return out;
}
const stubUsers = walk(join(ROOT, "app")).filter((f) => readFileSync(f, "utf8").includes("ModulePage"));
assert.deepEqual(stubUsers, [], `stub pages remain: ${stubUsers.join(", ")}`);

// 2. Every nav href resolves to a route file
const nav = readFileSync(join(ROOT, "lib/nav.ts"), "utf8");
const hrefs = [...nav.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
assert.ok(hrefs.length > 10, "nav has entries");
for (const href of hrefs) {
  const seg = href.replace(/^\//, "");
  const candidates = [
    join(ROOT, "app/(protected)/(admin)", seg, "page.tsx"),
    join(ROOT, "app/(protected)", seg, "page.tsx"),
    join(ROOT, "app", seg, "page.tsx"),
  ];
  const found = candidates.some((c) => existsSync(c));
  // Dynamic routes: /leads/[id] style — check the parent dir has a [..] folder
  const dynamicOk =
    !found &&
    candidates.some((c) => {
      const dir = join(c, "..");
      return existsSync(dir) && readdirSync(dir).some((e) => e.startsWith("["));
    });
  assert.ok(found || dynamicOk, `nav href ${href} has no route`);
}

// 3. Every major feature has a verify script
const expected = [
  "verify:muse",
  "verify:automations",
  "verify:email",
  "verify:contracts",
  "verify:templates",
  "verify:forms",
  "verify:delivery",
  "verify:radar",
  "verify:coverage",
  "verify:flowkeep",
  "verify:security",
];
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
for (const name of expected) {
  assert.ok(pkg.scripts?.[name], `missing package script ${name}`);
  const file = name === "verify:security" ? "verify-security.mjs" : name.replace("verify:", "verify-") + ".ts";
  assert.ok(existsSync(join(ROOT, "scripts", file)), `missing script file ${file}`);
}
void statSync;

console.log("verify:coverage — all checks passed.");
