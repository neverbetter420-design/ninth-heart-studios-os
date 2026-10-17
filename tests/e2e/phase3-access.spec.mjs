import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Phase 3 has NO insert/update/delete/upload paths. These checks use the same
// authenticated publishable-key/Data API permissions as client sessions.
// Run against only the two explicitly identified disposable test fixtures.
const fixtures = {
  A: {
    projectId: "fdb531db-bf9c-47ee-bc6a-458b626665a2",
    clientId: "90d03d98-4e1d-4240-8f01-aba182e041ce",
    projectName: "Client A Test Co. Website",
    clientName: "Client A Test Co.",
    email: process.env.E2E_CLIENT_A_EMAIL,
    password: process.env.E2E_CLIENT_A_PASSWORD,
  },
  B: {
    projectId: "ec3c2fb4-8e10-423b-8199-eaa7e6f8259d",
    clientId: "5a3164bf-e300-4948-bda6-8ffed74448b7",
    projectName: "Client B Test Co. Website",
    clientName: "Client B Test Co.",
    email: process.env.E2E_CLIENT_B_EMAIL,
    password: process.env.E2E_CLIENT_B_PASSWORD,
  },
};
const admin = {
  email: process.env.E2E_ADMIN_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD,
};
const canRun = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
  Object.values(fixtures).every((f) => f.email && f.password) &&
  admin.email && admin.password,
);

function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function signInApi(email, password) {
  const api = publicClient();
  const { data, error } = await api.auth.signInWithPassword({ email, password });
  expect(error, "Dedicated test account must authenticate").toBeNull();
  expect(data?.user?.id, "Expected authenticated test user ID").toBeTruthy();
  return { api, user: data.user };
}
async function read(query, label) {
  const { data, error } = await query;
  expect(error, "RLS query must succeed without exposing " + label).toBeNull();
  expect(Array.isArray(data), label + " returns an array").toBe(true);
  return data;
}
async function signInBrowser(page, credential) {
  await page.goto("/auth/sign-in");
  await page.locator('input[name="email"]').fill(credential.email);
  await page.locator('input[name="password"]').fill(credential.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".navigation-shell")).toBeVisible({ timeout: 25_000 });
}

test.describe("Phase 3 read-only client isolation", () => {
  test.skip(!canRun, "Requires 6 dedicated GitHub QA login secrets and publishable Supabase configuration.");
  for (const key of ["A", "B"]) {
    const own = fixtures[key];
    const other = fixtures[key === "A" ? "B" : "A"];
    test("Client " + key + ": direct API and portal isolation (no writes)", async ({ page }) => {
      const { api, user } = await signInApi(own.email, own.password);
      const ownProjects = await read(
        api.from("projects").select("id,client_id,name").eq("id",own.projectId),
        "own project",
      );
      expect(ownProjects).toEqual([{ id: own.projectId, client_id: own.clientId, name: own.projectName }]);

      const ownClient = await read(api.from("clients").select("id,name").eq("id",own.clientId), "own client");
      expect(ownClient).toEqual([{ id: own.clientId, name: own.clientName }]);

      const memberships = await read(
        api.from("client_memberships").select("client_id,profile_id"),
        "client memberships",
      );
      expect(memberships.length).toBeGreaterThan(0);
      expect(memberships.every((m) => m.profile_id === user.id)).toBe(true);
      expect(memberships.some((m) => m.client_id === own.clientId)).toBe(true);
      expect(memberships.some((m) => m.client_id === other.clientId)).toBe(false);

      // Negative lookups prove RLS isolation, not just absence of links.
      expect(await read(api.from("projects").select("id").eq("id",other.projectId), "other project")).toEqual([]);
      expect(await read(api.from("clients").select("id").eq("id",other.clientId), "other client")).toEqual([]);
      const tables = ["tasks", "milestones", "approvals", "documents", "files", "messages"];
      for (const table of tables) {
        const otherRows = await read(
          api.from(table).select("id").eq("project_id",other.projectId),
          "other client's " + table,
        );
        expect(otherRows, "Client " + key + " must not see cross-client " + table).toEqual([]);
      }

      const approvals = await read(
        api.from("approvals").select("id,project_id,status").eq("project_id",own.projectId),
        "own approvals",
      );
      expect(approvals.length, "Pre-existing test approval is the read isolation fixture").toBeGreaterThan(0);
      expect(approvals.every((a) => a.project_id === own.projectId)).toBe(true);

      const tasks = await read(
        api.from("tasks").select("id,project_id,client_visible").eq("project_id",own.projectId),
        "own visible tasks",
      );
      expect(tasks.length, "Seeded client-visible task required").toBeGreaterThan(0);
      expect(tasks.every((task) => task.client_visible === true)).toBe(true);

      const leads = await read(api.from("leads").select("id").limit(2), "admin-only leads");
      expect(leads).toEqual([]);
      const profiles = await read(api.from("profiles").select("id"), "other profiles");
      expect(profiles.every((profile) => profile.id === user.id)).toBe(true);

      await signInBrowser(page, own);
      await page.goto("/portal/projects/" + own.projectId);
      await expect(page.getByRole("heading", { name: own.projectName, exact: true })).toBeVisible();
      await page.goto("/portal/projects/" + other.projectId);
      await expect(page.getByRole("heading", { name: "That page isn't available.", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: other.projectName, exact: true })).toHaveCount(0);
    });
  }

  test("NHS test admin can read both isolated fixtures (no writes)", async () => {
    const { api } = await signInApi(admin.email, admin.password);
    const projects = await read(
      api.from("projects").select("id").in("id",[fixtures.A.projectId,fixtures.B.projectId]),
      "two disposable project fixtures",
    );
    expect(new Set(projects.map((p) => p.id))).toEqual(new Set([fixtures.A.projectId,fixtures.B.projectId]));
    const approvals = await read(
      api.from("approvals").select("project_id").in("project_id",[fixtures.A.projectId,fixtures.B.projectId]),
      "two disposable approval fixtures",
    );
    expect(new Set(approvals.map((a) => a.project_id))).toEqual(new Set([fixtures.A.projectId,fixtures.B.projectId]));
  });
});
