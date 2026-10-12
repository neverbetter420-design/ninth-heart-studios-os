import { ModulePage } from "@/components/ModulePage";

export default function LeadsPage() {
  return <ModulePage
    eyebrow="Lead Intelligence"
    title="Momentum before clutter."
    description="Capture leads fast, rank the real next action, and stop letting good prospects fossilize in a task list."
    items={[
      { title: "Smart lead inbox", description: "Inbound and outbound leads with deterministic momentum states and SLA awareness." },
      { title: "Website opportunity score", description: "Structured scoring for website quality, mobile experience, conversion issues, and brand opportunity." },
      { title: "Quick-log outcomes", description: "Email, call, DM, reply, in-person conversation, and not-interested outcomes without CRM ceremony." },
    ]}
  />;
}
