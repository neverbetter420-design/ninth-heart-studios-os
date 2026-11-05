"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, navigationContext } from "@/lib/nav";
import type { AppRole } from "@/lib/supabase/types";

/** The room directory is summoned, never a permanent column in the workspace.
 * Native auto-popover provides Escape, light dismissal and focus restoration,
 * including before hydration. Authorization remains in the route/data layers. */
export function RoomNavigation({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const directory = useRef<HTMLElement>(null);
  const visible = navItems.filter(item => item.roles.includes(role));
  const sections = [...new Set(visible.map(item => item.section))];
  const { activeHref } = navigationContext(role, pathname);
  const close = () => directory.current?.hidePopover();
  useEffect(close, [pathname]);

  return (
    <div className="nhs-room-launcher">
      <Link href={role === "admin" ? "/" : "/portal"} className="nhs-room-brand" aria-label="NHS OS home">
        <img src="/brand/nhs-original-logo.webp" alt="" width={44} height={44} className="nhs-brand-logo" />
        <span>Ninth Heart<span>Studios OS</span></span>
      </Link>
      <button type="button" className="nhs-rooms-trigger" popoverTarget="nhs-room-directory" aria-label="Open navigation">
        <span aria-hidden="true">✧</span> Rooms <span aria-hidden="true">⌄</span>
      </button>
      <nav id="nhs-room-directory" ref={directory} popover="auto" className="nhs-room-directory" aria-label="Primary navigation">
        <div className="nhs-directory-heading">
          <div><p className="eyebrow">{role === "admin" ? "The studio" : "Your private atelier"}</p><h2>Where to next?</h2></div>
          <button type="button" popoverTarget="nhs-room-directory" popoverTargetAction="hide" aria-label="Close navigation">Close <span aria-hidden="true">×</span></button>
        </div>
        <div className="nhs-directory-grid">
          {sections.map((section, index) => (
            <section key={section} aria-labelledby={`nhs-directory-section-${index}`}>
              <h3 id={`nhs-directory-section-${index}`}>{section}</h3>
              {visible.filter(item => item.section === section).map(item => (
                <Link key={item.href} href={item.href} prefetch={false} onClick={close} aria-current={item.href === activeHref ? "page" : undefined} className="nhs-room-link">
                  <span aria-hidden="true">{item.icon}</span><span>{item.label}</span><span aria-hidden="true">↗</span>
                </Link>
              ))}
            </section>
          ))}
        </div>
        <a className="nhs-directory-studio" href="https://www.ninthheartstudios.com" target="_blank" rel="noopener noreferrer">Visit Ninth Heart Studios <span aria-hidden="true">↗</span></a>
      </nav>
    </div>
  );
}
