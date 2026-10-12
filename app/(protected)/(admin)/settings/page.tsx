import { ModulePage } from "@/components/ModulePage";

export default function SettingsPage() {
  return <ModulePage
    eyebrow="System Settings"
    title="Control the machine."
    description="Roles, integrations, business rules, automation safeguards, and brand settings live here."
    status="Phase 2 security code ready"
    items={[
      { title: "Roles & permissions", description: "Admin and client access rules now enforced with protected routes and Supabase row-level security." },
      { title: "Integrations", description: "Supabase authentication and database are wired first; other integrations remain deliberately isolated." },
      { title: "Automation controls", description: "Draft, test, approve, then activate. No mystery automations firing into the void." },
    ]}
  />;
}
