"use client";

import { useState } from "react";
import Link from "next/link";

export type HaloAction = {
  id: string;
  title: string;
  businessName: string;
  meta: string;
  priority: "critical" | "high" | "normal";
};

export function PriorityHalo({ actions }: { actions: HaloAction[] }) {
  const [selectedId, setSelectedId] = useState(actions[0]?.id ?? "");
  if (!actions.length) return null;

  const selected = actions.find((item) => item.id === selectedId) ?? actions[0];
  return (
    <div className="nhs-priority-halo" aria-label="Your three highest-priority lead actions">
      <div className="nhs-priority-halo__orbit">
        <svg viewBox="0 0 260 260" aria-hidden="true">
          <circle className="nhs-priority-halo__outer" cx="130" cy="130" r="105" />
          <circle className="nhs-priority-halo__inner" cx="130" cy="130" r="76" />
          <circle className="nhs-priority-halo__core-ring" cx="130" cy="130" r="43" />
          <path className="nhs-priority-halo__flourish" d="M24 130 Q32 54 97 30 M163 230 Q225 218 237 136"/>
        </svg>
        <div className="nhs-priority-halo__core" aria-hidden="true">
          <span>♡</span>
          <small>{actions.length} NEXT</small>
        </div>
        {actions.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={
              "nhs-priority-halo__node nhs-priority-halo__node--" + index +
              " nhs-priority-halo__node--" + item.priority +
              (item.id === selected.id ? " is-selected" : "")
            }
            aria-pressed={item.id === selected.id}
            aria-label={"Priority " + (index + 1) + ": " + item.title + " for " + item.businessName}
            onClick={() => setSelectedId(item.id)}
          >
            {index + 1}
          </button>
        ))}
      </div>

      <div className="nhs-priority-halo__detail" aria-live="polite">
        <p className="nhs-priority-halo__overline">
          YOUR NEXT MOVE <span aria-hidden="true">✧</span>
        </p>
        <h4>{selected.title}</h4>
        <strong>{selected.businessName}</strong>
        {selected.meta && <p className="nhs-priority-halo__meta">{selected.meta}</p>}
        <Link href={"/leads/" + selected.id} className="nhs-priority-halo__open">
          Open lead <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </div>
  );
}
