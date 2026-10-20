"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

/** Reopen the native disclosure even when this URL is already current/cached. */
export function ProjectSectionLink({ href, children }: { href: string; children: ReactNode }) {
  function reveal(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = href.split("#")[1];
    if (!anchor) return;
    const disclosure = document.getElementById(anchor)?.closest("details");
    if (disclosure instanceof HTMLDetailsElement) disclosure.open = true;
  }
  return <Link href={href} onClick={reveal}>{children}</Link>;
}
