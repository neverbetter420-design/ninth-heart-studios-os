"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav";
import type { AppRole } from "@/lib/supabase/types";

export function Sidebar({
  role,
  user,
}: {
  role: AppRole;
  user: { name: string; email: string };
}) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => item.roles.includes(role));

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
          <strong>Secure session</strong>
          <span>{role === "admin" ? "NHS Admin" : "NHS Client"}</span>
        </div>
      </div>

      <nav className="nav-stack" aria-label="Primary navigation">
        {visibleItems.map((item) => {
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
        {role === "admin" ? (
          <Link className="muse-chip muse-chip-link" href="/muse">
            <span className="muse-orb" />
            <div>
              <strong>Muse</strong>
              <span>Studio intelligence</span>
            </div>
          </Link>
        ) : null}

        <div className="user-chip">
          <div className="user-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</div>
          <div className="user-copy">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
        </div>

        <form action="/auth/sign-out" method="post">
          <button className="ghost-button wide sign-out-button" type="submit">Sign out</button>
        </form>
        <p className="tiny-copy">Custom build · Phase 2 security</p>
      </div>
    </aside>
  );
}
