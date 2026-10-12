import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const { user, profile } = await requireUser();

  return (
    <AppShell
      role={profile.role}
      user={{
        email: user.email ?? profile.email ?? "Signed in",
        name: profile.full_name ?? user.email?.split("@")[0] ?? "NHS user",
      }}
    >
      {children}
    </AppShell>
  );
}
