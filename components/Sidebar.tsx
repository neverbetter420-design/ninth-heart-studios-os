"use client";

import { useEffect, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const visibleItems = navItems.filter((item) => item.roles.includes(role));
  const sections = [...new Set(visibleItems.map((item) => item.section))];
  const home = role === "admin" ? "/" : "/portal";

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open]);

  return (
    <div className="navigation-shell">
      <header className="mobile-topbar">
        <button
          type="button"
          className="navigation-toggle"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="nhs-sidebar"
          onClick={() => setOpen(!open)}
        >
          <span aria-hidden="true">{open ? "✕" : "☰"}</span>
          <span>Menu</span>
        </button>
        <Link href={home} className="mobile-brand" onClick={() => setOpen(false)}>
          <span aria-hidden="true">♥</span> NHS OS
        </Link>
        <span className="mobile-role">{role === "admin" ? "Admin" : "Client"}</span>
      </header>

      {open && (
        <button
          type="button"
          className="navigation-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}

      <aside id="nhs-sidebar" className={"sidebar nhs-sidebar" + (open ? " is-open" : "")}>
        <div className="brand-lockup">
          <Link className="brand-mark" href={home} onClick={() => setOpen(false)} aria-label="NHS OS home">♥</Link>
          <div>
            <p className="eyebrow">Ninth Heart Studios</p>
            <h1>NHS OS</h1>
          </div>
          <button type="button" className="navigation-close" onClick={() => setOpen(false)} aria-label="Close navigation">✕</button>
        </div>

        <div className="system-status">
          <span className="status-dot" />
          <div>
            <strong>Secure session</strong>
            <span>{role === "admin" ? "NHS Admin" : "NHS Client"}</span>
          </div>
        </div>

        <nav className="nav-stack" aria-label="Primary navigation">
          {sections.map((section) => (
            <div className="nav-section" key={section}>
              <p className="nav-section-heading">{section}</p>
              <div className="nav-section-links">
                {visibleItems.filter((item) => item.section === section).map((item) => {
                  const active = item.href === "/" || item.href === "/portal"
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={"nav-link" + (active ? " active" : "")}
                      onClick={() => setOpen(false)}
                    >
                      <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <a className="nav-link" href="https://www.ninthheartstudios.com" target="_blank" rel="noopener noreferrer">
            <span className="nav-icon" aria-hidden="true">↗</span><span>Studio Website</span>
          </a>
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
          <p className="tiny-copy">Ninth Heart Studios · Private workspace</p>
        </div>
      </aside>
    </div>
  );
}
