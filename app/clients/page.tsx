import { ModulePage } from "@/components/ModulePage";

export default function ClientsPage() {
  return <ModulePage
    eyebrow="Client Portal"
    title="Polished on the outside. Controlled underneath."
    description="Clients see only their own project, documents, approvals, and uploads. Admin-only machinery stays admin-only."
    items={[
      { title: "Client dashboard", description: "Project status, next milestone, outstanding approvals, and clean communication." },
      { title: "Secure uploads", description: "Client-specific file upload areas tied to the correct project and permissions." },
      { title: "Approvals", description: "Structured approvals for design, content, launch, and final deliverables." },
    ]}
  />;
}
