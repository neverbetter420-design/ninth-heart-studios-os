import { ON_HOLD_STAGE, PIPELINE_STAGES, stageLabel } from "@/lib/delivery";

/** Current workflow position, not a claim that previous work was completed. */
export function ProjectJourney({ status }: { status: string }) {
  const current = PIPELINE_STAGES.findIndex((stage) => stage.key === status);
  return (
    <section className="studio-journey" aria-label="Project journey">
      <div className="studio-journey-heading">
        <p className="studio-overline">The project journey</p>
        <span>{status === ON_HOLD_STAGE ? "Your project is on hold" : `Current phase · ${stageLabel(status)}`}</span>
      </div>
      <ol className="studio-journey-stages">
        {PIPELINE_STAGES.map((stage, index) => (
          <li key={stage.key} className={index === current ? "is-current" : current >= 0 && index < current ? "is-earlier" : ""} aria-current={index === current ? "step" : undefined}>
            <span className="studio-journey-point" aria-hidden="true" />
            <span className="studio-journey-number" aria-hidden="true">0{index + 1}</span>
            <span>{stage.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
