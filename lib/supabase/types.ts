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
