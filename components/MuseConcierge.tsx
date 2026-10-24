"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/** Admin-only shortcut panel. The existing Muse workspace owns all draft actions and authorization. */
export function MuseConcierge() {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onPointer); };
  }, [open]);

  return (
    <div className="nhs-muse-area" ref={wrapper}>
      <button ref={trigger} type="button" className="nhs-muse-shortcut" aria-expanded={open} aria-controls="nhs-muse-concierge" onClick={() => setOpen(!open)}>
        <span aria-hidden="true">✧</span> Muse
      </button>
      {open ? (
        <section id="nhs-muse-concierge" className="nhs-muse-popover" aria-label="Muse studio concierge">
          <p className="nhs-muse-overline">YOUR STUDIO CONCIERGE</p>
          <h3>What shall we create?</h3>
          <p>Start a draft in Muse. Nothing is sent automatically.</p>
          <div className="nhs-muse-actions">
            <Link href="/muse?kind=follow_up" onClick={() => setOpen(false)}>Draft a follow-up <span aria-hidden="true">↗</span></Link>
            <Link href="/muse?kind=proposal" onClick={() => setOpen(false)}>Prepare a proposal <span aria-hidden="true">↗</span></Link>
            <Link href="/muse?kind=check_in" onClick={() => setOpen(false)}>Write a client check-in <span aria-hidden="true">↗</span></Link>
          </div>
          <Link className="nhs-muse-all" href="/muse" onClick={() => setOpen(false)}>Open the Muse workspace →</Link>
        </section>
      ) : null}
    </div>
  );
}
