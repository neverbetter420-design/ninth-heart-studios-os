import { ModulePage } from "@/components/ModulePage";

export default function ProjectsPage() {
  return <ModulePage
    eyebrow="Project Pipeline"
    title="Delivery without the scavenger hunt."
    description="A single studio view for discovery, content, design, build, approvals, launch, and care-plan work."
    items={[
      { title: "Visual pipeline", description: "Custom project stages with owner, due date, risk, and progress signals." },
      { title: "Project workspace", description: "Files, milestones, approvals, notes, and client-visible updates in one place." },
      { title: "Launch sequence", description: "Final payment, launch checklist, handoff, review request, and post-launch follow-ups." },
    ]}
  />;
}
