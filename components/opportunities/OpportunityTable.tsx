import Link from "next/link";
import { OPPORTUNITY_STATUSES, opportunityStatusLabel } from "@/lib/radar";
import type { Opportunity } from "@/lib/supabase/types";

export function listingUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function OpportunityTable({
  opportunities,
  activeFilter,
  unavailable = false,
}: {
  opportunities: Opportunity[];
  activeFilter: string | null;
  unavailable?: boolean;
}) {
  const visible = activeFilter
    ? opportunities.filter((o) => o.status === activeFilter)
    : opportunities;
  return (
    <>
      <nav className="paperwork-filters" aria-label="Bid stage filter">
        <Link
          href="/opportunities#radar-queue"
          aria-current={!activeFilter ? "page" : undefined}
        >
          All
        </Link>
        {OPPORTUNITY_STATUSES.map((s) => (
          <Link
            key={s.key}
            href={`/opportunities?status=${s.key}#radar-queue`}
            aria-current={activeFilter === s.key ? "page" : undefined}
          >
            {s.label}
          </Link>
        ))}
      </nav>
      {!unavailable && (
        <p className="management-help">
          {visible.length}{" "}
          {visible.length === 1 ? "opportunity" : "opportunities"} in this view
        </p>
      )}
      {!unavailable &&
        (visible.length ? (
          <ol className="radar-directory">
            {visible.map((o, index) => (
              <li key={o.id} className="radar-row">
                <span className="radar-index" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="radar-row-copy">
                  <h4>
                    <Link
                      href={`/opportunities/${o.id}`}
                      aria-label={`Open opportunity: ${o.title}`}
                    >
                      {o.title}
                      <span aria-hidden="true">↗</span>
                    </Link>
                  </h4>
                  <p>
                    {o.source}
                    {listingUrl(o.url) ? (
                      <>
                        {" "}
                        ·{" "}
                        <a
                          href={listingUrl(o.url)!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View listing
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="radar-score">
                  <strong>{o.score === null ? "—" : o.score}</strong>
                  <small>{o.score === null ? "Unscored" : "Fit /100"}</small>
                </div>
                <span className="studio-status">
                  {opportunityStatusLabel(o.status)}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="management-empty">
            <h4>
              {activeFilter
                ? "Nothing in this stage."
                : "Room for the right work."}
            </h4>
            <p>
              {activeFilter
                ? "Choose another bid stage or review the full shortlist."
                : "Track a listing above, then score its fit before writing a proposal."}
            </p>
          </div>
        ))}
    </>
  );
}
