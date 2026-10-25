"use client";

import { useMemo, useState } from "react";

export type ConstellationProspect = {
  id: string;
  name: string;
  category: string | null;
  score: number | null;
  hasWebsite: boolean;
  socialListed: boolean;
  socialMatched: boolean;
  socialChecked: boolean;
};

type Filter = "all" | "high" | "social";

export function LeadConstellation({
  prospects,
  totalCount,
}: {
  prospects: ConstellationProspect[];
  totalCount: number;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState(prospects[0]?.id ?? "");
  const visible = useMemo(
    () =>
      prospects.filter(
        (prospect) =>
          filter === "all" ||
          (filter === "high" && (prospect.score ?? -1) >= 70) ||
          (filter === "social" && prospect.socialListed),
      ),
    [filter, prospects],
  );
  const selected = visible.find((prospect) => prospect.id === selectedId) ?? visible[0];
  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All signals" },
    { id: "high", label: "70+ score" },
    { id: "social", label: "Social listed" },
  ];

  return (
    <section className="nhs-lead-constellation" aria-labelledby="nhs-constellation-title">
      <header className="nhs-lead-constellation__header">
        <div>
          <p className="nhs-lead-constellation__eyebrow">INTELLIGENCE CHAMBER / SAVED PROSPECTS</p>
          <h3 id="nhs-constellation-title">Lead <em>constellation.</em></h3>
        </div>
        <span className="nhs-lead-constellation__count">
          Top {prospects.length} / {totalCount} saved
        </span>
      </header>

      <div className="nhs-lead-constellation__filters" role="group" aria-label="Filter constellation">
        {filters.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={filter === option.id}
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="nhs-lead-constellation__body">
        <div className="nhs-lead-constellation__sky" aria-label="Select a prospect signal">
          <svg className="nhs-lead-constellation__orbits" viewBox="0 0 360 340" aria-hidden="true">
            <circle cx="180" cy="170" r="59" />
            <circle cx="180" cy="170" r="104" strokeDasharray="3 9" />
            <circle cx="180" cy="170" r="146" />
            <ellipse cx="180" cy="170" rx="158" ry="91" transform="rotate(-28 180 170)" />
            <path d="M180 8V332 M13 170H347" />
          </svg>
          <div className="nhs-lead-constellation__core" aria-hidden="true">
            <strong>{visible.length.toString().padStart(2, "0")}</strong>
            <span>SIGNALS</span>
          </div>
          {visible.map((prospect) => {
            // Stable positions across filters so signals do not jump around.
            const index = prospects.findIndex((item) => item.id === prospect.id);
            const angle = ((index * 137.508 - 90) * Math.PI) / 180;
            const radius = index % 2 === 0 ? 35 : 42;
            const left = 50 + Math.cos(angle) * radius;
            const top = 50 + Math.sin(angle) * radius;
            return (
              <button
                key={prospect.id}
                type="button"
                className={"nhs-lead-constellation__node" +
                  (selected?.id === prospect.id ? " is-selected" : "")}
                style={{ left: left + "%", top: top + "%" }}
                onClick={() => setSelectedId(prospect.id)}
                aria-label={
                  "Select " + prospect.name +
                  ", opportunity score " + (prospect.score ?? "not scored")
                }
                aria-pressed={selected?.id === prospect.id}
                title={prospect.name}
              >
                <span aria-hidden="true" />
              </button>
            );
          })}
        </div>

        <div className="nhs-lead-constellation__selection" aria-live="polite">
          {selected ? (
            <>
              <p className="nhs-lead-constellation__eyebrow">SELECTED SIGNAL</p>
              <h4>{selected.name}</h4>
              <p className="nhs-lead-constellation__category">
                {selected.category || "Local business"}
              </p>
              <div className="nhs-lead-constellation__score">
                <strong>{selected.score ?? "—"}</strong>
                <span>OPPORTUNITY SCORE</span>
              </div>
              <div
                className="nhs-lead-constellation__track"
                aria-label={"Score: " + (selected.score ?? "not available") + " out of 100"}
              >
                <span style={{ width: Math.min(100, Math.max(0, selected.score ?? 0)) + "%" }} />
              </div>
              <div className="nhs-lead-constellation__verification">
                <span>{selected.hasWebsite ? "✓ Website listed" : "○ Website not confirmed"}</span>
                <span>
                  {selected.socialMatched
                    ? "✓ Social business match"
                    : selected.socialListed
                      ? "◇ Social profile needs review"
                      : selected.socialChecked
                        ? "○ No social match confirmed"
                        : "○ Socials not checked"}
                </span>
              </div>
              <a href={"#prospect-" + selected.id} className="nhs-lead-constellation__link">
                View saved prospect <span aria-hidden="true">↗</span>
              </a>
            </>
          ) : (
            <p className="nhs-lead-constellation__empty">
              No prospects match this filter.
            </p>
          )}
        </div>
      </div>
      <p className="nhs-lead-constellation__footnote">
        Visualization of saved records only. Source matches are not independent verification.
        Nothing is sent, imported, or rescanned here.
      </p>
    </section>
  );
}
