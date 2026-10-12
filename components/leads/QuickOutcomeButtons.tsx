import { logLeadOutcome } from "@/app/(protected)/(admin)/leads/actions";
import { QUICK_LOG_OUTCOMES } from "@/lib/flowkeep";

export function QuickOutcomeButtons({ leadId }: { leadId: string }) {
  return (
    <div className="quick-outcome-grid">
      {QUICK_LOG_OUTCOMES.map((outcome) => (
        <form action={logLeadOutcome} key={outcome}>
          <input type="hidden" name="lead_id" value={leadId} />
          <input type="hidden" name="outcome" value={outcome} />
          <button
            className={`outcome-button ${outcome === "Received Reply" ? "outcome-hot" : ""} ${outcome === "Not Interested" ? "outcome-muted" : ""}`}
            type="submit"
          >
            {outcome}
          </button>
        </form>
      ))}
    </div>
  );
}
