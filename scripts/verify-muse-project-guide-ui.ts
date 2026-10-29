import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MUSE_DEMO_PLAN } from "../lib/muse-project-guide-demo.ts";
import { readyTaskIds, validateMuseProjectPlan } from "../lib/muse-project-guide.ts";

const phases = MUSE_DEMO_PLAN.phases;
const tasks = phases.flatMap(p => p.tasks);
assert.deepEqual(phases.map(p => p.tasks.length), [4, 5, 7, 5]);
assert.equal(tasks.length, 21);
assert.equal(tasks.flatMap(t => t.subtasks).length, 42);
assert.equal(validateMuseProjectPlan(MUSE_DEMO_PLAN).ok, true);
assert.deepEqual(readyTaskIds(MUSE_DEMO_PLAN, new Set()), ["task-1"]);
assert.deepEqual(readyTaskIds(MUSE_DEMO_PLAN, new Set(["task-1"])), ["task-2"]);

const route = readFileSync("app/(protected)/(admin)/muse/project-guide/page.tsx", "utf8");
const component = readFileSync("components/muse/MuseProjectGuidePreview.tsx", "utf8");
const css = readFileSync("app/muse-project-guide.css", "utf8");
const muse = readFileSync("app/(protected)/(admin)/muse/page.tsx", "utf8");
const workspace = readFileSync("app/(protected)/(admin)/projects/[projectId]/page.tsx", "utf8");

assert.match(route, /await requireAdmin\(\)/, "Preview must require admin");
assert.match(route, /MuseProjectGuidePreview/);
assert.match(component, /^"use client";/, "Interaction must be client-only");
assert.match(component, /Sample data only/, "Synthetic nature must be clear");
assert.match(component, /aria-label="Project Guide views"/);
assert.match(component, /aria-label="Sample project progress"/);
assert.match(component, /disabled aria-disabled="true"/, "Approval must be disabled in preview");
assert.doesNotMatch(component, /createClient|\.rpc\(|fetch\(|sendEmail|\.from\(/,
  "Preview must not perform network, database or messaging actions");
assert.match(component, /readyTaskIds/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /focus-visible/);
assert.match(muse, /href="\/muse\/project-guide"/);
assert.match(workspace, /muse\/project-guide\?mode=connected&project=/, "Connected mode should deep-link to its own project");
assert.match(workspace, /projectGuideEnabled\(\)/, "Connected link must be feature gated");
console.log("verify:muse-project-guide-ui — 4 phases, 21 tasks, 42 steps, admin-only inert preview and a11y hooks verified.");
