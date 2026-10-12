import { createClient } from "@supabase/supabase-js";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TEST_ADMIN_EMAIL",
  "TEST_ADMIN_PASSWORD",
  "TEST_CLIENT_EMAIL",
  "TEST_CLIENT_PASSWORD",
];

for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing ${key} in .env.local`);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email) {
  let page = 1;
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 100) break;
    page += 1;
  }
  return null;
}

async function ensureUser({ email, password, role, fullName }) {
  let user = await findUserByEmail(email);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      app_metadata: { ...user.app_metadata, role },
      user_metadata: { ...user.user_metadata, full_name: fullName },
    });
    if (error) throw error;
    user = data.user;
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: user.id,
    role,
    full_name: fullName,
    email,
    active: true,
  });
  if (profileError) throw profileError;
  return user;
}

async function ensureClientAccount({ userId, name, email }) {
  const { data: existingMembership, error: membershipLookupError } = await admin
    .from("client_memberships")
    .select("client_id")
    .eq("profile_id", userId)
    .maybeSingle();
  if (membershipLookupError) throw membershipLookupError;

  let clientId = existingMembership?.client_id;
  if (!clientId) {
    const { data: client, error: clientError } = await admin
      .from("clients")
      .insert({ name, primary_email: email, status: "active" })
      .select("id")
      .single();
    if (clientError) throw clientError;
    clientId = client.id;

    const { error: membershipError } = await admin.from("client_memberships").insert({
      client_id: clientId,
      profile_id: userId,
      member_role: "client",
    });
    if (membershipError) throw membershipError;
  }

  let { data: project, error: projectLookupError } = await admin
    .from("projects")
    .select("id")
    .eq("client_id", clientId)
    .eq("name", `${name} Website`)
    .maybeSingle();
  if (projectLookupError) throw projectLookupError;

  if (!project) {
    const { data: createdProject, error: projectError } = await admin
      .from("projects")
      .insert({ client_id: clientId, name: `${name} Website`, status: "design", progress: 42 })
      .select("id")
      .single();
    if (projectError) throw projectError;
    project = createdProject;

    const { error: taskError } = await admin.from("tasks").insert([
      { project_id: project.id, title: "Review homepage direction", status: "in_progress", client_visible: true },
      { project_id: project.id, title: "Internal conversion audit", status: "not_started", client_visible: false },
    ]);
    if (taskError) throw taskError;

    const { error: approvalError } = await admin.from("approvals").insert({
      project_id: project.id,
      title: "Homepage direction",
      status: "pending",
    });
    if (approvalError) throw approvalError;
  }

  return { clientId, projectId: project.id };
}

const adminUser = await ensureUser({
  email: process.env.TEST_ADMIN_EMAIL,
  password: process.env.TEST_ADMIN_PASSWORD,
  role: "admin",
  fullName: "NHS Admin Test",
});

const clientAUser = await ensureUser({
  email: process.env.TEST_CLIENT_EMAIL,
  password: process.env.TEST_CLIENT_PASSWORD,
  role: "client",
  fullName: "NHS Client A",
});

const clientBEmail = process.env.TEST_CLIENT_B_EMAIL || "client-b@example.com";
const clientBPassword = process.env.TEST_CLIENT_B_PASSWORD || process.env.TEST_CLIENT_PASSWORD;
const clientBUser = await ensureUser({
  email: clientBEmail,
  password: clientBPassword,
  role: "client",
  fullName: "NHS Client B",
});

const clientA = await ensureClientAccount({ userId: clientAUser.id, name: "Client A Test Co.", email: process.env.TEST_CLIENT_EMAIL });
const clientB = await ensureClientAccount({ userId: clientBUser.id, name: "Client B Test Co.", email: clientBEmail });

console.log("Phase 2 test data ready.");
console.table([
  { role: "admin", email: process.env.TEST_ADMIN_EMAIL, user_id: adminUser.id },
  { role: "client-a", email: process.env.TEST_CLIENT_EMAIL, user_id: clientAUser.id, project_id: clientA.projectId },
  { role: "client-b", email: clientBEmail, user_id: clientBUser.id, project_id: clientB.projectId },
]);
