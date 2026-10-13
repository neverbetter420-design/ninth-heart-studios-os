import Link from "next/link";
import { OPPORTUNITY_STATUSES, opportunityStatusLabel } from "@/lib/radar";
import type { Opportunity } from "@/lib/supabase/types";

function scoreClass(score: number | null) {
  if (score === null) return "delivery-pill";
  if (score >= 80) return "delivery-pill done";
  if (score >= 60) return "delivery-pill progress";
  if (score >= 40) return "delivery-pill visible";
  return "delivery-pill blocked";
}

export function OpportunityTable({
  opportunities,
  activeFilter,
}: {
  opportunities: Opportunity[];
  activeFilter: string | null;
}) {
  return (
    <section className="panel" aria-label="Opportunities">
      <div className="panel-heading">
        <h3>Tracked opportunities</h3>
        <div className="delivery-actions">
          <Link
            href="/opportunities"
            className={`mini-button${!activeFilter ? " go" : ""}`}
          >
            All
          </Link>
          {OPPORTUNITY_STATUSES.map((s) => (
            <Link
              key={s.key}
              href={`/opportunities?status=${s.key}`}
              className={`mini-button${activeFilter === s.key ? " go" : ""}`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>
      <ul className="delivery-list">
        {opportunities.length === 0 ? (
          <li className="delivery-row">
            <p className="pipeline-empty">
              Radar&apos;s quiet. Track something worth chasing above.
            </p>
          </li>
        ) : (
          opportunities.map((o) => (
            <li key={o.id} className="delivery-row">
              <div className="delivery-row-main">
                <p className="delivery-row-title">
                  <Link
                    href={`/opportunities/${o.id}`}
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    {o.title}
                  </Link>
                </p>
                <p className="delivery-row-sub">
                  {o.source}
                  {o.url ? (
                    <>
                      {" · "}
                      <a href={o.url} target="_blank" rel="noopener noreferrer">
                        View listing
                      </a>
                    </>
                  ) : null}
                </p>
              </div>
              <span className={scoreClass(o.score)}>
                {o.score !== null ? `${o.score}/100` : "Unscored"}
              </span>
              <span className="delivery-pill">{opportunityStatusLabel(o.status)}</span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
