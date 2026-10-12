import { ModulePage } from "@/components/ModulePage";

export default function OpportunitiesPage() {
  return <ModulePage
    eyebrow="Opportunity Radar"
    title="Find work worth chasing."
    description="Score outside opportunities against NHS fit before spending time on a proposal that was doomed at birth."
    status="Scoring preview"
    items={[
      { title: "Opportunity feed", description: "Admin-only intake for approved sources with duplicate detection and source metadata." },
      { title: "Fit scoring", description: "Score project fit, budget, platform, niche, scope clarity, and likely effort." },
      { title: "Proposal draft workspace", description: "Turn qualified opportunities into structured drafts while keeping the final voice human." },
    ]}
  />;
}
