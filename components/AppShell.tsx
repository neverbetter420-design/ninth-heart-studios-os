import type { ReactNode } from "react";
import Link from "next/link";
import type { AppRole } from "@/lib/supabase/types";
import { Sidebar } from "./Sidebar";
import { WorkspaceBreadcrumbs } from "./WorkspaceBreadcrumbs";
import { ActionNotifications } from "./ActionNotifications";

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
    <div className={`app-shell ${role === "client" ? "nhs-theme-client" : "nhs-theme-admin"}`}>
      <Sidebar role={role} user={user} />
      <main className="main-shell">
        <header className="nhs-context-bar" aria-label="Workspace account">
          <div className="nhs-context-location">
            <span className="nhs-context-symbol" aria-hidden="true">✧</span>
            <WorkspaceBreadcrumbs role={role} />
          </div>
          <div className="nhs-context-account">
            {role === "admin" && <Link className="nhs-muse-shortcut" href="/muse" aria-label="Open Muse studio assistant"><span aria-hidden="true">✧</span> Muse</Link>}
            <span className="nhs-context-name" title={user.email}>{user.name}</span>
            <form action="/auth/sign-out" method="post">
              <button type="submit" className="nhs-sign-out">Sign out <span aria-hidden="true">↗</span></button>
            </form>
          </div>
        </header>
        {children}
      </main>
      <ActionNotifications />
    </div>
  );
}
