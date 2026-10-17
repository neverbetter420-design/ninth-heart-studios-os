import { createClient } from "@supabase/supabase-js";

// This is a tightly scoped cleanup for an explicitly authorized QA run.
// NEVER use a service-role key, unscoped deletion or real customer names.
const projectId = "fdb531db-bf9c-47ee-bc6a-458b626665a2";
const approval = "I_APPROVE_ISOLATED_QA_WRITES";
const runId = process.env.GITHUB_RUN_ID;
const expectedProject = "Client A Test Co. Website";
const expectedClient = "Client A Test Co.";
const bucket = "project-files";

function requireEnv(name) {
  if (!process.env[name]) throw new Error("Missing required QA environment: " + name);
  return process.env[name];
}

if (
  process.env.NHS_QA_WRITE_APPROVAL !== approval ||
  process.env.NHS_QA_TEST_PROJECT_ID !== projectId ||
  process.env.GITHUB_ACTOR !== "neverbetter420-design" ||
  process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
  !/^\d+$/.test(runId || "")
) {
  throw new Error("Not an owner-approved manual test-project run. Refusing reconciliation.");
}
const prefix = "NHS-WRITE-QA-" + runId + "-";
const supabase = createClient(
  requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const { error: authError } = await supabase.auth.signInWithPassword({
  email: requireEnv("E2E_ADMIN_EMAIL"),
  password: requireEnv("E2E_ADMIN_PASSWORD"),
});
if (authError) throw new Error("Cannot authenticate scoped QA cleanup: " + authError.message);

function unwrap({ data, error }, operation) {
  if (error) throw new Error(operation + ": " + error.message);
  return data;
}

const project = unwrap(
  await supabase.from("projects").select("id, name, client_id, clients(name)")
    .eq("id", projectId).single(), "Read QA project");
const clientName = Array.isArray(project.clients) ? project.clients[0]?.name : project.clients?.name;
if (project.name !== expectedProject || clientName !== expectedClient || !project.client_id) {
  throw new Error("Project identity does not match the exact approved test fixture.");
}

const resources = [
  { table: "tasks", field: "title" },
  { table: "milestones", field: "title" },
  { table: "documents", field: "title" },
  { table: "files", field: "filename" },
];

async function rowsFor({ table, field }) {
  const data = unwrap(await supabase.from(table)
    .select(table === "files" ? "id, filename, object_path" : "id, " + field)
    .eq("project_id", projectId)
    .like(field, prefix + "%"), "Read " + table);
  for (const row of data) {
    if (!row[field]?.startsWith(prefix)) throw new Error("Unexpected non-QA row in " + table);
  }
  return data;
}

const dirs = ["client", "internal"];
async function qaStoragePaths() {
  const found = [];
  for (const visibility of dirs) {
    const dir = [project.client_id, projectId, visibility].join("/");
    // A QA file path is <client>/<project>/<visibility>/<timestamp>_NHS-WRITE-QA-<run>-...
    for (let offset = 0; offset <= 9900; offset += 100) {
      const items = unwrap(await supabase.storage.from(bucket).list(dir, {
        limit: 100, offset, sortBy: { column: "name", order: "asc" },
      }), "List private test storage in " + dir);
      for (const item of items) {
        if (item.name.includes(prefix) && item.name.endsWith("-upload.txt")) {
          found.push(dir + "/" + item.name);
        }
      }
      if (items.length < 100) break;
      if (offset === 9900) throw new Error("Storage directory pagination exceeded safe limit.");
    }
  }
  return found;
}

const snapshot = {};
for (const resource of resources) snapshot[resource.table] = await rowsFor(resource);
snapshot.storage = await qaStoragePaths();
const leftovers = Object.entries(snapshot).reduce((n, [, items]) => n + items.length, 0);
console.log("QA cleanup preflight:", JSON.stringify({
  runId,
  project: expectedProject,
  found: Object.fromEntries(Object.entries(snapshot).map(([key, items]) => [key, items.length])),
}));

// Explicitly fail the run after cleanup if browser actions left records. This
// prevents apparently green UI tests from hiding an incomplete deletion.
if (snapshot.storage.length) {
  const { error, data } = await supabase.storage.from(bucket).remove(snapshot.storage);
  if (error || !Array.isArray(data)) throw new Error("Storage QA cleanup unconfirmed: " + (error?.message || "no result"));
}
for (const resource of resources) {
  for (const row of snapshot[resource.table]) {
    const removed = unwrap(await supabase.from(resource.table)
      .delete()
      .eq("project_id", projectId)
      .eq("id", row.id)
      .eq(resource.field, row[resource.field])
      .select("id"), "Delete exact QA row in " + resource.table);
    if (removed.length !== 1 || removed[0].id !== row.id) {
      throw new Error("QA cleanup delete did not confirm one exact row in " + resource.table);
    }
  }
}
const remaining = {};
for (const resource of resources) remaining[resource.table] = await rowsFor(resource);
remaining.storage = await qaStoragePaths();
const count = Object.values(remaining).reduce((n, items) => n + items.length, 0);
console.log("QA cleanup verified:", JSON.stringify(Object.fromEntries(
  Object.entries(remaining).map(([name, items]) => [name, items.length])
)));
if (count !== 0) throw new Error("QA cleanup left " + count + " matching records/objects.");
if (leftovers !== 0) throw new Error("Browser QA left " + leftovers + " orphaned test records/objects; exact scoped cleanup succeeded but the test run must remain FAILED.");
console.log("QA artifacts absent in authenticated database and private storage.");
