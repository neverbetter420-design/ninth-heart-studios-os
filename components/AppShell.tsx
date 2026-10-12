import type { ReactNode } from "react";
import type { AppRole } from "@/lib/supabase/types";
import { Sidebar } from "./Sidebar";

export function AppShell({
  children,
  role,
  user,
}: {
  children: ReactNode;
  role: AppRole;
  user: { name: string; email: string };
}) {
  return (
    <div className="app-shell">
      <Sidebar role={role} user={user} />
      <main className="main-shell">{children}</main>
    </div>
  );
}
