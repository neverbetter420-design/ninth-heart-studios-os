import type { ReactNode } from "react";
import { MuseConcierge } from "./MuseConcierge";
import { RoomIdentity } from "./RoomIdentity";
import type { AppRole } from "@/lib/supabase/types";
import { RoomNavigation } from "./RoomNavigation";
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
    <div className={`app-shell nhs-open-plan ${role === "client" ? "nhs-theme-client" : "nhs-theme-admin"}`}>
      <a className="nhs-skip-link" href="#workspace-content">Skip to workspace</a>
      <div className="main-shell">
        <header className="nhs-context-bar" aria-label="Workspace account">
          <RoomNavigation role={role} />
          <div className="nhs-context-location">
            <span className="nhs-context-symbol" aria-hidden="true">✧</span>
            <WorkspaceBreadcrumbs role={role} />
            <RoomIdentity role={role} />
          </div>
          <div className="nhs-context-account">
            {role === "admin" && <MuseConcierge enabled={typeof process !== "undefined" && process.env.MUSE_AI_ENABLED === "true"} />}
            <span className="nhs-context-name" title={user.email}>{user.name}</span>
            <form action="/auth/sign-out" method="post">
              <button type="submit" className="nhs-sign-out">Sign out <span aria-hidden="true">↗</span></button>
            </form>
          </div>
        </header>
        <main id="workspace-content" tabIndex={-1}>{children}</main>
      </div>
      <ActionNotifications />
    </div>
  );
}
