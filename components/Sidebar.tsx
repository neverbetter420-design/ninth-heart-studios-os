"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">♥</div>
        <div>
          <p className="eyebrow">Ninth Heart Studios</p>
          <h1>NHS OS</h1>
        </div>
      </div>

      <div className="system-status">
        <span className="status-dot" />
        <div>
          <strong>System online</strong>
          <span>Development environment</span>
        </div>
      </div>

      <nav className="nav-stack" aria-label="Primary navigation">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`nav-link ${active ? "active" : ""}`}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="muse-chip">
          <span className="muse-orb" />
          <div>
            <strong>Muse</strong>
            <span>AI copilot · prototype</span>
          </div>
        </div>
        <p className="tiny-copy">Custom build · Phase 1</p>
      </div>
    </aside>
  );
}
