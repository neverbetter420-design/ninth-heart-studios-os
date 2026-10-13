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
  if (score === null) return null;
  const explanation = explainFitScore({ opportunityId, score, fitNotes: fit, breakdown });

  return (
    <section className="panel muse-explanation" aria-label="Why this score" style={{ marginBottom: 14 }}>
      <div className="panel-heading">
        <h3>Why {score}/100</h3>
        <span className="pipeline-count">{explanation.verdict}</span>
      </div>
      <div style={{ padding: "14px 18px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        {explanation.strengths.length > 0 ? (
          <div>
            <p className="delivery-row-sub" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontSize: 9, marginBottom: 4 }}>
              Working for it
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {explanation.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {explanation.concerns.length > 0 ? (
          <div>
            <p className="delivery-row-sub" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontSize: 9, marginBottom: 4 }}>
              Working against it
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {explanation.concerns.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {explanation.notes ? (
          <div>
            <p className="delivery-row-sub" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontSize: 9, marginBottom: 4 }}>
              Your notes
            </p>
            <p style={{ margin: 0, fontSize: 13, fontStyle: "italic" }}>“{explanation.notes}”</p>
          </div>
        ) : null}
        {explanation.nudge ? (
          <p style={{ margin: 0, fontSize: 13 }}>
            <strong>Muse:</strong> {explanation.nudge}
          </p>
        ) : null}
      </div>
    </section>
  );
}
