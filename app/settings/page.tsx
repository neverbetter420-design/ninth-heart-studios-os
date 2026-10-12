import { ModulePage } from "@/components/ModulePage";

export default function SettingsPage() {
  return <ModulePage
    eyebrow="System Settings"
    title="Control the machine."
    description="Roles, integrations, business rules, automation safeguards, and brand settings live here."
    status="Locked for Phase 1"
    items={[
      { title: "Roles & permissions", description: "Admin and client access rules with row-level security planned at the database layer." },
      { title: "Integrations", description: "Supabase first, then carefully approved connections for email, files, accounting, and lead sources." },
      { title: "Automation controls", description: "Draft, test, approve, then activate. No mystery automations firing into the void." },
    ]}
  />;
}
