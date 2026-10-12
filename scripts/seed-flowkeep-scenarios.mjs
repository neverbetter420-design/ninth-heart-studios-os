import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.TEST_ADMIN_EMAIL;
if (!url || !serviceKey || !adminEmail) throw new Error("Missing Supabase or TEST_ADMIN_EMAIL environment variables.");

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: users, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 100 });
if (usersError) throw usersError;
const owner = users.users.find((user) => user.email?.toLowerCase() === adminEmail.toLowerCase());
if (!owner) throw new Error(`Admin test account ${adminEmail} not found. Run npm run seed:test-users first.`);

const now = new Date();
const inThreeHours = new Date(now.getTime() + 3 * 60 * 60 * 1000);
const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
const fortyTwoMinutesAgo = new Date(now.getTime() - 42 * 60 * 1000);

const scenarios = [
  {
    business_name: "Flowkeep — Human Reply",
    email: "reply@example.com",
    acquisition_type: "outbound",
    momentum_state: "Waiting on Me",
    status: "engaged",
    owner_id: owner.id,
    next_action: "Reply to lead",
    next_action_kind: "reply",
    next_action_due: fortyTwoMinutesAgo.toISOString(),
    last_reply_at: fortyTwoMinutesAgo.toISOString(),
    last_activity_at: fortyTwoMinutesAgo.toISOString(),
    last_outcome: "Received Reply",
    score: 91,
  },
  {
    business_name: "Flowkeep — Consultation",
    email: "consult@example.com",
    acquisition_type: "outbound",
    momentum_state: "Scheduled Consultation",
    status: "consultation_scheduled",
    owner_id: owner.id,
    next_action: "Prepare for consultation",
    next_action_kind: "consultation",
    next_action_due: tomorrow.toISOString(),
    consultation_at: tomorrow.toISOString(),
    last_activity_at: now.toISOString(),
    score: 84,
  },
  {
    business_name: "Flowkeep — New Inbound",
    email: "inbound@example.com",
    acquisition_type: "inbound",
    momentum_state: "New Inbound",
    status: "new",
    owner_id: owner.id,
    next_action: "Respond to new lead",
    next_action_kind: "new_inbound",
    original_inquiry_at: now.toISOString(),
    next_action_due: inThreeHours.toISOString(),
    last_activity_at: now.toISOString(),
    score: 76,
  },
  {
    business_name: "Flowkeep — First Outreach",
    email: "outreach@example.com",
    acquisition_type: "outbound",
    momentum_state: "Waiting on Me",
    status: "prospect",
    owner_id: owner.id,
    next_action: "Send first outreach",
    next_action_kind: "first_outreach",
    last_activity_at: now.toISOString(),
    score: 68,
  },
  {
    business_name: "Flowkeep — Research",
    acquisition_type: "outbound",
    momentum_state: "Waiting on Me",
    status: "prospect",
    owner_id: owner.id,
    next_action: "Find contact method",
    next_action_kind: "research",
    last_activity_at: now.toISOString(),
    score: 55,
  },
];

for (const scenario of scenarios) {
  const { data: existing, error: lookupError } = await supabase
    .from("leads")
    .select("id")
    .eq("business_name", scenario.business_name)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) {
    const { error } = await supabase.from("leads").update(scenario).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("leads").insert(scenario);
    if (error) throw error;
  }
}

console.log("Five Flowkeep validation scenarios are seeded.");
