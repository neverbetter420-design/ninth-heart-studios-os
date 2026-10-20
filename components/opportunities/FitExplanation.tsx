import { explainFitScore } from "@/lib/muse";
import type { FitBreakdown } from "@/lib/radar";

export function FitExplanation({
  opportunityId,
  score,
  fit,
  breakdown,
}: {
  opportunityId: string;
  score: number | null;
  fit: string | null;
  breakdown: Partial<FitBreakdown>;
}) {
  if (score === null)
    return (
      <aside className="radar-fit-reading" aria-label="Why this score">
        <p className="eyebrow">Before the proposal</p>
        <h4>
          Fit first.
          <br />
          Effort second.
        </h4>
        <p>
          Give each dimension a score from 0 to 20. The total reflects your
          judgment of the work, not a promise of winning it.
        </p>
        <p>
          New dimensions start at 10 as an editable midpoint. Nothing is scored
          until you save.
        </p>
      </aside>
    );
  const explanation = explainFitScore({
    opportunityId,
    score,
    fitNotes: fit,
    breakdown,
  });
  return (
    <aside className="radar-fit-reading" aria-label="Why this score">
      <p className="eyebrow">Your recorded assessment</p>
      <h4>
        {score}
        <small>/100</small>
      </h4>
      <p className="radar-verdict">{explanation.verdict}</p>
      {explanation.strengths.length ? (
        <div>
          <h5>Working for it</h5>
          <ul>
            {explanation.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {explanation.concerns.length ? (
        <div>
          <h5>Worth a closer look</h5>
          <ul>
            {explanation.concerns.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {explanation.notes ? (
        <div>
          <h5>Your notes</h5>
          <p>{explanation.notes}</p>
        </div>
      ) : null}
      {explanation.nudge ? (
        <p>
          <strong>Muse:</strong> {explanation.nudge}
        </p>
      ) : null}
    </aside>
  );
}
