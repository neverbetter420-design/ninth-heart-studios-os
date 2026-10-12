import { ModulePage } from "@/components/ModulePage";

export default function ClientsPage() {
  return <ModulePage
    eyebrow="Client Management"
    title="Control access without exposing the studio machinery."
    description="Manage client accounts and memberships while the separate client portal stays scoped by database policy."
    items={[
      { title: "Client accounts", description: "Create client records and connect approved user profiles through explicit memberships." },
      { title: "Secure access", description: "Project records and files are isolated by client membership and row-level security." },
      { title: "Approvals", description: "Structured approvals for design, content, launch, and final deliverables." },
    ]}
  />;
}
