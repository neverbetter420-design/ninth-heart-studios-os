import { ON_HOLD_STAGE, PIPELINE_STAGES, stageLabel } from "@/lib/delivery";

const phaseGuides: Record<string, string> = {
  discovery: "We define your goals, audience, and the structure your website needs.",
  content: "We organize the words, images, and brand assets for your project.",
  design: "We explore the visual direction and gather focused design feedback.",
  build: "Your approved direction becomes a working, responsive website.",
  review: "We check details, collect revisions, and prepare for final approval.",
  launch: "We verify the launch checklist and prepare your website to go live.",
  care: "We discuss optional ongoing support and post-launch follow-ups.",
};

/** Workflow position only. Earlier phases are not automatically proof of completed milestones. */
export function ProjectJourney({ status }: { status: string }) {
  const current = PIPELINE_STAGES.findIndex((stage) => stage.key === status);
  return (
    <section className="studio-journey" aria-label="Project journey">
      <div className="studio-journey-heading">
        <p className="studio-overline">Your creative journey</p>
        <span>{status === ON_HOLD_STAGE ? "Your project is on hold" : "Current phase · " + stageLabel(status)}</span>
      </div>
      <p className="nhs-journey-intro">Explore what each phase involves. Your milestones and approvals show what has actually been completed.</p>
      <ol className="studio-journey-stages">
        {PIPELINE_STAGES.map((stage, index) => (
          <li key={stage.key} className={index === current ? "is-current" : current >= 0 && index < current ? "is-earlier" : ""} aria-current={index === current ? "step" : undefined}>
            <span className="studio-journey-point" aria-hidden="true" />
            <details className="nhs-phase-detail">
              <summary>
                <span className="studio-journey-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <span>{stage.label}</span>
                <span className="nhs-phase-more" aria-hidden="true">+</span>
              </summary>
              <p>{phaseGuides[stage.key]}</p>
              <small>{index === current ? "Current phase" : current >= 0 && index < current ? "Earlier phase" : "Upcoming phase"}</small>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
