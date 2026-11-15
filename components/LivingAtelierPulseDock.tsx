"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AtelierSymbol, type AtelierSymbolName } from "./AtelierSymbol";

// Navigation only: the anchors point at existing, live Dashboard sections.
// No new server queries, AI execution, data writes, or fake studio metrics.
const destinations: readonly { id: string; label: string; symbol: AtelierSymbolName }[] = [
  { id: "nhs-observatory", label: "Overview", symbol: "rose" },
  { id: "nocturne-actions-title", label: "Priorities", symbol: "spark" },
  { id: "nocturne-projects-title", label: "Projects", symbol: "key" },
  { id: "nocturne-activity-title", label: "Activity", symbol: "skull" },
];

export function LivingAtelierPulseDock() {
  const [activeId, setActiveId] = useState("nhs-observatory");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const targets = destinations
      .map((destination) => document.getElementById(destination.id))
      .filter((element): element is HTMLElement => element !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-10% 0px -65% 0px", threshold: 0 },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="nhs-pulse-dock" aria-label="Ninth Pulse: Command Center shortcuts">
      <span className="nhs-pulse-dock__signature" aria-hidden="true">
        <span className="nhs-pulse-dock__heartbeat" />
      </span>
      <span className="nhs-pulse-dock__name" aria-hidden="true">PULSE</span>
      <div className="nhs-pulse-dock__destinations">
        {destinations.map(({ id, label, symbol }) => (
          <a
            key={id}
            href={`#${id}`}
            className="nhs-pulse-dock__destination"
            aria-label={`Jump to ${label.toLowerCase()}`}
            aria-current={activeId === id ? "location" : undefined}
            onClick={() => setActiveId(id)}
          >
            <span className="nhs-pulse-dock__glyph" aria-hidden="true">
              <AtelierSymbol name={symbol} size={17} />
            </span>
            <span className="nhs-pulse-dock__label">{label}</span>
          </a>
        ))}
      </div>
      <span className="nhs-pulse-dock__divider" aria-hidden="true" />
      <Link
        href="/leads#quick-capture"
        className="nhs-pulse-dock__capture"
        aria-label="Capture a new lead"
      >
        <span aria-hidden="true">＋</span>
        <span>Lead</span>
      </Link>
    </nav>
  );
}
