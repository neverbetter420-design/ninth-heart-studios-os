import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !publishableKey || !serviceKey) throw new Error("Supabase environment variables are missing.");

const service = createClient(url, serviceKey, { auth: { persistSession: false } });

async function signedIn(email, password) {
  const client = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;
const clientAEmail = process.env.TEST_CLIENT_EMAIL;
const clientAPassword = process.env.TEST_CLIENT_PASSWORD;
const clientBEmail = process.env.TEST_CLIENT_B_EMAIL || "client-b@example.com";
const clientBPassword = process.env.TEST_CLIENT_B_PASSWORD || clientAPassword;

if (!adminEmail || !adminPassword || !clientAEmail || !clientAPassword) {
  throw new Error("Test account environment variables are missing.");
}

const { data: memberships, error: membershipError } = await service
  .from("client_memberships")
  .select("profile_id, client_id, clients(id, name, projects(id, name))");
if (membershipError) throw membershipError;

const { data: usersData, error: usersError } = await service.auth.admin.listUsers({ perPage: 100 });
if (usersError) throw usersError;

function userId(email) {
  const user = usersData.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`Seed user ${email} not found.`);
  return user.id;
}

const memberA = memberships.find((item) => item.profile_id === userId(clientAEmail));
const memberB = memberships.find((item) => item.profile_id === userId(clientBEmail));
if (!memberA || !memberB) throw new Error("Client memberships are missing. Run npm run seed:test-users first.");

const projectA = memberA.clients?.projects?.[0];
const projectB = memberB.clients?.projects?.[0];
if (!projectA || !projectB) throw new Error("Seed projects are missing.");

const [adminClient, clientA, clientB] = await Promise.all([
  signedIn(adminEmail, adminPassword),
  signedIn(clientAEmail, clientAPassword),
  signedIn(clientBEmail, clientBPassword),
]);

const checks = [];
async function check(name, fn) {
  try {
    await fn();
    checks.push({ check: name, result: "PASS" });
  } catch (error) {
    checks.push({ check: name, result: `FAIL: ${error.message}` });
  }
}

await check("Admin can read all seed projects", async () => {
  const { data, error } = await adminClient.from("projects").select("id");
  if (error || !data || data.length < 2) throw error || new Error("Expected at least two projects.");
});

await check("Client A cannot read Client B project", async () => {
  const { data, error } = await clientA.from("projects").select("id").eq("id", projectB.id);
  if (error) throw error;
  if (data.length !== 0) throw new Error("Cross-client project leakage detected.");
});

await check("Client B cannot read Client A project", async () => {
  const { data, error } = await clientB.from("projects").select("id").eq("id", projectA.id);
  if (error) throw error;
  if (data.length !== 0) throw new Error("Cross-client project leakage detected.");
});

await check("Clients cannot read admin-only leads", async () => {
  const { data, error } = await clientA.from("leads").select("id");
  if (error) throw error;
  if (data.length !== 0) throw new Error("Client received lead records.");
});

await check("Client sees only client-visible tasks", async () => {
  const { data, error } = await clientA.from("tasks").select("client_visible").eq("project_id", projectA.id);
  if (error) throw error;
  if (!data.length || data.some((task) => task.client_visible !== true)) throw new Error("Task visibility policy failed.");
});

await check("Client cannot modify a project", async () => {
  const { data, error } = await clientA.from("projects").update({ name: "Unauthorized Rename" }).eq("id", projectA.id).select("id");
  if (error) return; // An RLS rejection is an acceptable denial.
  if (data.length !== 0) throw new Error("Client update unexpectedly succeeded.");
});

console.table(checks);
if (checks.some((item) => item.result !== "PASS")) process.exitCode = 1;
