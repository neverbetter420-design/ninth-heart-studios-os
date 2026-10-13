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
