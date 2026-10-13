export type AppRole = "admin" | "client";

export type Profile = {
  id: string;
  role: AppRole;
  full_name: string | null;
  email: string | null;
  active: boolean;
};

export type ClientProject = {
  id: string;
  name: string;
  status: string;
  progress: number;
  due_date: string | null;
  client_id: string;
};

export type ProjectWithClient = ClientProject & {
  client_name: string | null;
};

export type Milestone = {
  id: string;
  project_id: string;
  title: string;
  due_date: string | null;
  status: string;
  position: number;
};

export type LaunchItem = {
  id: string;
  project_id: string;
  label: string;
  kind: "payment" | "checklist" | "followup";
  due_at: string | null;
  done: boolean;
  done_at: string | null;
};

export type ProjectTask = {
  id: string;
  project_id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  client_visible: boolean;
};

export type ProjectMessage = {
  id: string;
  project_id: string;
  sender_id: string | null;
  body: string;
  created_at: string;
};

export type ProjectDocument = {
  id: string;
  project_id: string;
  title: string;
  kind: "contract" | "proposal" | "invoice" | "handoff" | "other";
  file_id: string | null;
  external_url: string | null;
  notes: string | null;
  created_at: string;
};

export type Opportunity = {
  id: string;
  source: string;
  external_id: string | null;
  title: string;
  url: string | null;
  score: number | null;
  fit: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Proposal = {
  id: string;
  opportunity_id: string;
  title: string;
  content: string;
  status: "draft" | "sent";
  created_at: string;
  updated_at: string;
};

export type Automation = {
  id: string;
  key: string;
  name: string;
  description: string;
  kind: "internal" | "email" | "calendar" | "payments" | "lead_source";
  enabled: boolean;
  config: Record<string, unknown>;
  last_run_at: string | null;
  last_status: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationRun = {
  id: string;
  automation_id: string;
  started_at: string;
  finished_at: string | null;
  status: "ok" | "error" | "skipped";
  summary: string;
  details: Record<string, unknown>;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  kind: "info" | "warning" | "action";
  read: boolean;
  created_at: string;
};

export type SentEmail = {
  id: string;
  to_address: string;
  subject: string;
  created_at: string;
};

export type Contract = {
  id: string;
  project_id: string | null;
  opportunity_id: string | null;
  template_id: string | null;
  title: string;
  body: string;
  status: "draft" | "sent" | "signed" | "voided";
  sent_at: string | null;
  signed_at: string | null;
  signer_name: string | null;
  signer_email: string | null;
  signature_hash: string | null;
  signer_ip: string | null;
  created_at: string;
  updated_at: string;
};

export type RevisionRound = {
  id: string;
  project_id: string;
  round_number: number;
  status: "open" | "closed";
  included_rounds: number;
  started_at: string;
  closed_at: string | null;
  created_at: string;
};

export type FeedbackPin = {
  id: string;
  round_id: string;
  page_url: string;
  x: number;
  y: number;
  comment: string;
  resolved: boolean;
  resolved_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type ChangeOrder = {
  id: string;
  project_id: string;
  source_pin_id: string | null;
  description: string;
  fee_impact: number | null;
  timeline_impact: string | null;
  status: "draft" | "proposed" | "approved" | "declined";
  proposed_at: string | null;
  decided_at: string | null;
  created_at: string;
};
