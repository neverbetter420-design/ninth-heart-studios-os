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
