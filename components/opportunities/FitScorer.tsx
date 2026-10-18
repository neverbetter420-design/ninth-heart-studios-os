import { scoreOpportunity } from "@/app/(protected)/(admin)/opportunities/actions";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";
import { FIT_DIMENSIONS, type FitBreakdown } from "@/lib/radar";

export function FitScorer({
  opportunityId,
  fit,
  breakdown,
}: {
  opportunityId: string;
  score: number | null;
  fit: string | null;
  breakdown: Partial<FitBreakdown>;
}) {
  return (
    <form
      action={scoreOpportunity}
      className="radar-fit-form"
      aria-label="Fit scoring"
    >
      <input type="hidden" name="opportunity_id" value={opportunityId} />
      <fieldset>
        <legend className="management-help">
          Score each fit dimension from 0 to 20
        </legend>
        {FIT_DIMENSIONS.map((dim) => (
          <label key={dim.key} className="radar-dimension field">
            <span>
              <strong>{dim.label}</strong>
              <small>{dim.hint}</small>
            </span>
            <input
              type="number"
              name={`fit_${dim.key}`}
              aria-label={`${dim.label} (0–20)`}
              min={0}
              max={20}
              defaultValue={breakdown[dim.key] ?? 10}
            />
          </label>
        ))}
      </fieldset>
      <label className="field">
        <span>Fit notes</span>
        <input
          name="fit"
          aria-label="Fit notes"
          defaultValue={fit ?? ""}
          maxLength={280}
          placeholder="What makes this worth your time?"
        />
      </label>
      <div className="studio-actions">
        <PortalSubmitButton pendingLabel="Saving score…">
          Save fit score
        </PortalSubmitButton>
      </div>
    </form>
  );
}
