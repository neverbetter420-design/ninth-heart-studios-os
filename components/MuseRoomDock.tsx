"use client";

import { useEffect, useState } from "react";
import { AtelierSymbol, type AtelierSymbolName } from "./AtelierSymbol";

// Decorative navigation only. All destinations are sections on the existing
// Admin Muse page. No AI request, storage operation, or draft mutation occurs.
const destinations: readonly { id: string; label: string; symbol: AtelierSymbolName }[] = [
  { id: "muse-focus", label: "Studio focus", symbol: "spark" },
  { id: "muse-compose", label: "Write a draft", symbol: "rose" },
  { id: "muse-saved", label: "Saved drafts", symbol: "key" },
];

export function MuseRoomDock() {
  const [current, setCurrent] = useState("muse-focus");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sections = destinations
      .map(({ id }) => document.getElementById(id))
      .filter((node): node is HTMLElement => node !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length) setCurrent(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -58% 0px", threshold: 0 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="nhs-muse-room-dock" aria-label="Muse destinations">
      <span className="nhs-muse-room-dock__beacon" aria-hidden="true">
        <AtelierSymbol name="spark" size={18} />
      </span>
      <div className="nhs-muse-room-dock__links">
        {destinations.map(({ id, label, symbol }) => (
          <a
            key={id}
            className="nhs-muse-room-dock__link"
            href={`#${id}`}
            aria-current={current === id ? "location" : undefined}
            onClick={() => setCurrent(id)}
          >
            <AtelierSymbol name={symbol} size={19} />
            <span>{label}</span>
          </a>
        ))}
      </div>
      <span className="nhs-muse-room-dock__endmark" aria-hidden="true">
        NHS · MUSE
      </span>
    </nav>
  );
}
