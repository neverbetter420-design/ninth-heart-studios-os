// Execute the real server action modules against an isolated Supabase double.
// This suite never loads credentials, opens a network connection, or changes data.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const ids = {
  client: "11111111-1111-4111-8111-111111111111",
  profile: "22222222-2222-4222-8222-222222222222",
  project: "33333333-3333-4333-8333-333333333333",
  record: "44444444-4444-4444-8444-444444444444",
  other: "55555555-5555-4555-8555-555555555555",
};
const denied = { code: "42501", message: "permission denied" };
const missing = { data: null, error: null };
const failed = { data: null, error: denied };
const initial = { status: "idle", message: "" };
const normalized = (value) => JSON.parse(JSON.stringify(value));
const form = (values) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
};
const row = (extra = {}) => ({ id: ids.record, project_id: ids.project, ...extra });
const response = (data) => ({ data, error: null });
const query = (table, operation, result, options = {}) => ({ table, operation, result, ...options });

function harness(file, expectations = [], options = {}) {
  const pending = [...expectations];
  const calls = [];
  const revalidated = [];
  const harnessErrors = [];
  let authCalls = 0;
  const supabase = {
    storage: {
      from(bucket) {
        assert.equal(bucket, "project-files", "unexpected storage bucket");
        return {
          async remove(paths) {
            const call = { table: "storage", operation: "remove", paths };
            calls.push(call);
            const expected = pending.shift();
            try {
              assert.ok(expected, "unexpected storage removal");
              assert.equal(expected.table, "storage");
              assert.equal(expected.operation, "remove");
              if (expected.paths) assert.deepEqual(paths, expected.paths);
            } catch (error) {
              harnessErrors.push(error);
              throw error;
            }
            if (expected.throws) throw new Error(expected.throws);
            return expected.result;
          },
        };
      },
    },
    from(table) {
      const call = { table, operation: "select", filters: [], columns: null, terminal: null };
      const chain = {};
      for (const method of ["insert", "update", "delete"]) {
        chain[method] = (values) => { call.operation = method; call.values = values; return chain; };
      }
      chain.select = (columns) => { call.columns = columns; return chain; };
      for (const method of ["eq", "in", "is", "neq"]) {
        chain[method] = (column, value) => { call.filters.push([method, column, value]); return chain; };
      }
      for (const method of ["order", "limit"]) chain[method] = () => chain;
      for (const method of ["single", "maybeSingle"]) {
        chain[method] = () => { call.terminal = method; return chain; };
      }
      chain.then = (success, failure) => Promise.resolve().then(() => {
        calls.push(call);
        const expected = pending.shift();
        try {
          assert.ok(expected, `unexpected ${table}.${call.operation}`);
          assert.equal(table, expected.table, "wrong table queried");
          assert.equal(call.operation, expected.operation, "wrong database operation");
          for (const [column, value] of Object.entries(expected.eq ?? {})) {
            assert.ok(call.filters.some(([op, key, actual]) => op === "eq" && key === column && actual === value),
              `missing scope ${table}.${column}=${value}`);
          }
          if (expected.confirmed) {
            assert.ok(call.columns, "a write must request the saved/deleted row");
            assert.ok(call.terminal, "a write must require a returned row");
          }
          for (const [key, value] of Object.entries(expected.values ?? {})) {
            assert.deepEqual(normalized(call.values[key]), normalized(value), `unexpected saved ${key}`);
          }
        } catch (error) {
          harnessErrors.push(error);
          throw error;
        }
        if (expected.throws) throw new Error(expected.throws);
        return expected.result;
      }).then(success, failure);
      return chain;
    },
  };
  const imports = {
    "next/cache": { revalidatePath: (path) => revalidated.push(path) },
    "next/navigation": { redirect: (path) => { throw new Error(`redirect:${path}`); } },
    "@/lib/auth": { requireAdmin: async () => {
      authCalls += 1;
      if (options.noAdmin) throw new Error("redirect:/auth/sign-in");
      return { user: { id: ids.profile }, profile: { role: "admin", active: true } };
    } },
    "@/lib/supabase/server": { createClient: async () => supabase },
    "@/lib/delivery": { ON_HOLD_STAGE: "on_hold", PIPELINE_STAGES: [], stageLabel: (stage) => stage },
    "@/lib/templates": { templateBody: (content) => content?.body ?? "" },
    "@/lib/files": { MAX_UPLOAD_BYTES: 25 * 1024 * 1024, PROJECT_FILES_BUCKET: "project-files" },
  };
  const compiled = ts.transpileModule(readFileSync(resolve(root, file), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    fileName: file,
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    exports: module.exports, module, FormData, File, URL, console,
    require(name) {
      assert.ok(Object.hasOwn(imports, name), `unmocked dependency ${name}; refusing to load it`);
      return imports[name];
    },
  }, { filename: file, timeout: 5_000 });
  return {
    actions: module.exports,
    calls,
    revalidated,
    assertComplete() {
      if (harnessErrors.length) throw harnessErrors[0];
      assert.equal(pending.length, 0, "expected database query was not executed");
      assert.ok(authCalls > 0, "admin action must authenticate");
    },
  };
}

let checks = 0;
async function check(name, file, action, values, expectations, status, options = {}) {
  const run = harness(file, expectations, options);
  try {
    assert.equal(typeof run.actions[action], "function", `missing ${action}`);
    const result = await run.actions[action](initial, form(values));
    assert.equal(result.status, status, name);
    assert.ok(result.message, "outcomes need actionable feedback");
    run.assertComplete();
    if (status === "error") assert.equal(run.revalidated.length, 0, "rejected writes must not refresh as successful");
    if (status === "success") assert.ok(run.revalidated.length > 0, "confirmed writes must refresh the affected view");
    checks += 1;
  } catch (error) {
    throw new Error(`${name}: ${error.message}`, { cause: error });
  }
}

const clients = "app/(protected)/(admin)/clients/actions.ts";
const projects = "app/(protected)/(admin)/projects/actions.ts";
const member = { client_id: ids.client, profile_id: ids.profile, member_role: "client" };
const profile = () => query("profiles", "select", response({ id: ids.profile, email: "test@example.com" }), { eq: { email: "test@example.com" } });

await check("member add confirms the exact account and client", clients, "addClientMemberWithFeedback",
  { client_id: ids.client, email: "  TEST@example.com " }, [profile(), query("client_memberships", "insert", response(member), {
    confirmed: true, values: member,
  })], "success");
for (const [label, result] of [["permission error", failed], ["zero rows", missing], ["wrong client", response({ ...member, client_id: ids.other })]]) {
  await check(`member add rejects ${label}`, clients, "addClientMemberWithFeedback",
    { client_id: ids.client, email: "test@example.com" }, [profile(), query("client_memberships", "insert", result, { confirmed: true })], "error");
}
await check("unknown email never grants access", clients, "addClientMemberWithFeedback",
  { client_id: ids.client, email: "test@example.com" }, [query("profiles", "select", missing)], "error");
await check("lookup failures are not treated as missing accounts", clients, "addClientMemberWithFeedback",
  { client_id: ids.client, email: "test@example.com" }, [query("profiles", "select", failed)], "error");
await check("invalid email performs no writes", clients, "addClientMemberWithFeedback",
  { client_id: ids.client, email: "not-an-email" }, [], "error");
for (const [label, result, status] of [["confirmed", response(member), "success"], ["rejected", failed, "error"], ["already removed", missing, "error"], ["wrong profile", response({ ...member, profile_id: ids.other }), "error"]]) {
  await check(`member removal ${label}`, clients, "removeClientMemberWithFeedback",
    { client_id: ids.client, profile_id: ids.profile }, [query("client_memberships", "delete", result, {
      confirmed: true, eq: { client_id: ids.client, profile_id: ids.profile },
    })], status);
}

const taskInput = { project_id: ids.project, title: "Prepare handoff", due_at: "2026-11-02", priority: "high", client_visible: "on" };
const taskRow = row({ title: taskInput.title, client_visible: true });
for (const [label, result, status] of [["confirmed", response(taskRow), "success"], ["rejected", failed, "error"], ["zero rows", missing, "error"], ["wrong visibility", response({ ...taskRow, client_visible: false }), "error"]]) {
  await check(`task creation ${label}`, projects, "createTaskWithFeedback", taskInput,
    [query("tasks", "insert", result, { confirmed: true, values: {
      project_id: ids.project, title: taskInput.title, due_at: "2026-11-02T00:00:00Z", priority: "high", client_visible: true,
    } })], status);
}
for (const invalid of [{ title: " " }, { title: "x".repeat(161) }, { due_at: "2026-02-30" }, { priority: "urgent" }]) {
  await check(`invalid task ${Object.keys(invalid)[0]} performs no writes`, projects, "createTaskWithFeedback",
    { ...taskInput, ...invalid }, [], "error");
}
for (const [table, action, field] of [["tasks", "deleteTaskWithFeedback", "task_id"], ["milestones", "deleteMilestoneWithFeedback", "milestone_id"]]) {
  for (const [label, result, status] of [["confirmed", response(row()), "success"], ["rejected", failed, "error"], ["already removed", missing, "error"], ["wrong record", response(row({ id: ids.other })), "error"]]) {
    await check(`${table} deletion ${label}`, projects, action, { [field]: ids.record },
      [query(table, "delete", result, { confirmed: true, eq: { id: ids.record } })], status);
  }
  await check(`${table} missing selection performs no writes`, projects, action, {}, [], "error");
}

for (const [table, action, field] of [["tasks", "setTaskStatusWithFeedback", "task_id"], ["milestones", "setMilestoneStatusWithFeedback", "milestone_id"]]) {
  const current = row({ title: "Prepare handoff", status: "not_started" });
  for (const [label, result, status] of [["confirmed", response(row({ status: "in_progress" })), "success"], ["rejected", failed, "error"], ["zero rows", missing, "error"], ["wrong status", response(row({ status: "complete" })), "error"]]) {
    await check(`${table} status ${label}`, projects, action, { [field]: ids.record, status: "in_progress" }, [
      query(table, "select", response(current), { eq: { id: ids.record } }),
      query(table, "update", result, { confirmed: true, eq: { id: ids.record, project_id: ids.project }, values: { status: "in_progress" } }),
    ], status);
  }
  await check(`${table} missing lookup prevents a write`, projects, action, { [field]: ids.record, status: "in_progress" },
    [query(table, "select", missing)], "error");
  await check(`${table} invalid status performs no writes`, projects, action, { [field]: ids.record, status: "bogus" }, [], "error");
}

const milestoneInput = { project_id: ids.project, title: "Approve final design", due_date: "2026-11-02" };
const position = () => query("milestones", "select", response({ position: 3 }), { eq: { project_id: ids.project } });
for (const [label, result, status] of [["confirmed", response(row({ title: milestoneInput.title })), "success"], ["rejected", failed, "error"], ["zero rows", missing, "error"]]) {
  await check(`milestone creation ${label}`, projects, "createMilestoneWithFeedback", milestoneInput, [position(),
    query("milestones", "insert", result, { confirmed: true, values: { project_id: ids.project, title: milestoneInput.title, due_date: "2026-11-02", position: 4 } }),
  ], status);
}
await check("failed milestone ordering read never inserts", projects, "createMilestoneWithFeedback", milestoneInput,
  [query("milestones", "select", failed)], "error");
await check("invalid milestone date performs no writes", projects, "createMilestoneWithFeedback",
  { ...milestoneInput, due_date: "2026-02-30" }, [], "error");
await check("audit transport failure cannot undo a confirmed milestone", projects, "setMilestoneStatusWithFeedback",
  { milestone_id: ids.record, status: "complete" }, [
    query("milestones", "select", response(row({ title: "Approve final design", status: "in_progress" }))),
    query("milestones", "update", response(row({ status: "complete" })), { confirmed: true, eq: { id: ids.record, project_id: ids.project } }),
    query("activities", "insert", failed, { throws: "audit transport unavailable" }),
  ], "success");
await check("repeated milestone completion does not duplicate client activity", projects, "setMilestoneStatusWithFeedback",
  { milestone_id: ids.record, status: "complete" }, [
    query("milestones", "select", response(row({ title: "Approve final design", status: "complete" }))),
    query("milestones", "update", response(row({ status: "complete" })), { confirmed: true }),
  ], "success");

for (const [label, result, status] of [["confirmed", response(row({ client_visible: true })), "success"], ["stale concurrent update", missing, "error"], ["denied", failed, "error"], ["wrong visibility", response(row({ client_visible: false })), "error"]]) {
  await check(`task visibility ${label}`, projects, "toggleTaskVisibilityWithFeedback", { task_id: ids.record, client_visible: "true" }, [
    query("tasks", "select", response(row({ client_visible: false }))),
    query("tasks", "update", result, { confirmed: true, eq: { id: ids.record, project_id: ids.project, client_visible: false }, values: { client_visible: true } }),
  ], status);
}
await check("task visibility requires an explicit valid choice", projects, "toggleTaskVisibilityWithFeedback",
  { task_id: ids.record, client_visible: "maybe" }, [], "error");

const documentInput = { project_id: ids.project, title: "Handoff", kind: "handoff", external_url: "https://example.com/handoff", notes: "Final reference" };
for (const [label, result, status] of [["confirmed", response(row()), "success"], ["rejected", failed, "error"], ["zero rows", missing, "error"], ["wrong project", response(row({ project_id: ids.other })), "error"]]) {
  const expectations = [query("documents", "insert", result, { confirmed: true, values: {
    project_id: ids.project, title: documentInput.title, kind: "handoff", external_url: documentInput.external_url, notes: documentInput.notes, created_by: ids.profile,
  } })];
  if (status === "success") expectations.push(query("activities", "insert", response(null)));
  await check(`document creation ${label}`, projects, "createDocumentWithFeedback", documentInput, expectations, status);
}
for (const invalid of [{ external_url: "javascript:alert(1)" }, { external_url: "not a URL" }, { notes: "x".repeat(281) }, { title: "x".repeat(161) }, { kind: "bogus" }]) {
  await check(`invalid document ${Object.keys(invalid)[0]} performs no writes`, projects, "createDocumentWithFeedback",
    { ...documentInput, ...invalid }, [], "error");
}
await check("unavailable document template never inserts", projects, "createDocumentWithFeedback",
  { ...documentInput, notes: "", template_id: ids.record }, [query("templates", "select", missing, { eq: { id: ids.record, category: "document", active: true } })], "error");
await check("audit transport failure cannot undo a confirmed document", projects, "createDocumentWithFeedback", documentInput, [
  query("documents", "insert", response(row()), { confirmed: true }),
  query("activities", "insert", failed, { throws: "audit transport unavailable" }),
], "success");
for (const [label, result, status] of [["confirmed", response(row()), "success"], ["rejected", failed, "error"], ["zero rows", missing, "error"], ["wrong project", response(row({ project_id: ids.other })), "error"]]) {
  await check(`document deletion ${label}`, projects, "deleteDocumentWithFeedback", { document_id: ids.record, project_id: ids.project }, [
    query("documents", "delete", result, { confirmed: true, eq: { id: ids.record, project_id: ids.project } }),
  ], status);
}
await check("document deletion needs a project scope", projects, "deleteDocumentWithFeedback", { document_id: ids.record }, [], "error");


const projectFile = { id: ids.record, project_id: ids.project, object_path: `${ids.client}/${ids.project}/client/file.pdf`, filename: "file.pdf" };
const fileLookup = (result = response(projectFile)) => query("files", "select", result, { eq: { id: ids.record } });
const fileDelete = (result = response(projectFile)) => query("files", "delete", result, {
  confirmed: true, eq: { id: ids.record, project_id: ids.project },
});
const storageRemove = (result = response([{ name: projectFile.object_path }])) =>
  query("storage", "remove", result, { paths: [projectFile.object_path] });
await check("file deletion confirms metadata and storage before reporting success", projects, "deleteProjectFileWithFeedback",
  { file_id: ids.record }, [fileLookup(), fileDelete(), storageRemove(), query("activities", "insert", response(null))], "success");
await check("file deletion never touches storage after a denied database write", projects, "deleteProjectFileWithFeedback",
  { file_id: ids.record }, [fileLookup(), fileDelete(failed)], "error");
await check("file deletion never touches storage after an unconfirmed database write", projects, "deleteProjectFileWithFeedback",
  { file_id: ids.record }, [fileLookup(), fileDelete(missing)], "error");
await check("file deletion does not mutate when lookup is denied", projects, "deleteProjectFileWithFeedback",
  { file_id: ids.record }, [fileLookup(failed)], "error");
await check("file deletion rejects missing IDs", projects, "deleteProjectFileWithFeedback", {}, [], "error");
for (const removal of [storageRemove(failed), storageRemove(response(null))]) {
  const run = harness(projects, [fileLookup(), fileDelete(), removal]);
  const result = await run.actions.deleteProjectFileWithFeedback(initial, form({ file_id: ids.record }));
  assert.equal(result.status, "error");
  assert.match(result.message, /storage cleanup failed/i);
  assert.ok(run.revalidated.includes(`/projects/${ids.project}`), "confirmed metadata removal must refresh despite cleanup failure");
  run.assertComplete();
  checks += 1;
}

for (const [file, action] of [[clients, "addClientMemberWithFeedback"], [clients, "removeClientMemberWithFeedback"],
  ...["createTaskWithFeedback", "deleteTaskWithFeedback", "setTaskStatusWithFeedback", "toggleTaskVisibilityWithFeedback",
    "createMilestoneWithFeedback", "setMilestoneStatusWithFeedback", "deleteMilestoneWithFeedback", "createDocumentWithFeedback", "deleteDocumentWithFeedback", "deleteProjectFileWithFeedback"].map((action) => [projects, action])]) {
  const run = harness(file, [], { noAdmin: true });
  try {
    const result = await run.actions[action](initial, form({ ...taskInput, ...documentInput, client_id: ids.client, profile_id: ids.profile, email: "test@example.com", task_id: ids.record, milestone_id: ids.record, document_id: ids.record }));
    assert.equal(result.status, "error", `${action} must reject unauthenticated calls`);
  } catch (error) {
    assert.match(error.message, /redirect:\/auth\/sign-in/);
  }
  run.assertComplete();
  assert.equal(run.calls.length, 0, `${action} must authenticate before accessing data`);
  assert.equal(run.revalidated.length, 0);
  checks += 1;
}

console.log(`verify:admin-actions — ${checks} isolated server action outcomes passed (confirmed writes, failures, validation, scoped deletion, authentication).`);
