import { scoreOpportunity } from "@/app/(protected)/(admin)/opportunities/actions";
import { FIT_DIMENSIONS, fitVerdict, type FitBreakdown } from "@/lib/radar";

export function FitScorer({
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
  return (
    <section className="panel" aria-label="Fit scoring">
      <div className="panel-heading">
        <h3>Fit scoring</h3>
        {score !== null ? (
          <span className="pipeline-count">{score}/100 · {fitVerdict(score)}</span>
        ) : (
          <span className="pipeline-count">Unscored</span>
        )}
      </div>
      <form action={scoreOpportunity} style={{ padding: "14px 18px 18px" }}>
        <input type="hidden" name="opportunity_id" value={opportunityId} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 12 }}>
          {FIT_DIMENSIONS.map((dim) => (
            <label key={dim.key} className="field">
              <span title={dim.hint}>{dim.label} (0–20)</span>
              <input
                type="number"
                name={`fit_${dim.key}`}
                min={0}
                max={20}
                defaultValue={breakdown[dim.key] ?? 10}
              />
            </label>
          ))}
        </div>
        <label className="field" style={{ marginBottom: 12 }}>
          <span>Fit notes</span>
          <input
            type="text"
            name="fit"
            placeholder="Why this fits (or doesn't)…"
            defaultValue={fit ?? ""}
            maxLength={280}
          />
        </label>
        <button type="submit" className="mini-button go">Score it</button>
      </form>
    </section>
  );
}
