import { ModulePage } from "@/components/ModulePage";

export default function TemplatesPage() {
  return <ModulePage
    eyebrow="Master Templates"
    title="Reusable without looking recycled."
    description="One controlled library for contracts, proposals, receipts, forms, client packets, and studio documents."
    items={[
      { title: "Proposal templates", description: "Offer-specific proposal structures with reusable clauses and project variables." },
      { title: "Client documents", description: "Welcome packet, intake, approvals, receipts, and handoff documents." },
      { title: "Internal playbooks", description: "Checklists and SOPs for repeatable delivery without turning the studio into a bureaucracy museum." },
    ]}
  />;
}
