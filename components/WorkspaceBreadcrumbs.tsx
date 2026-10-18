"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav";
import type { AppRole } from "@/lib/supabase/types";

const detailLabels: Record<string, string> = {
  "/projects": "Project workspace",
  "/portal/projects": "Project workspace",
  "/clients": "Client profile",
  "/leads": "Lead details",
  "/opportunities": "Opportunity details",
  "/templates": "Template details",
  "/contracts": "Contract details",
  "/forms": "Form details",
};

export function WorkspaceBreadcrumbs({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const home = role === "admin" ? "/" : "/portal";
  const homeLabel = role === "admin" ? "Command Center" : "Atelier Home";
  const matches = navItems
    .filter((item) => item.roles.includes(role))
    .filter((item) => pathname === item.href || (
      item.href !== "/" && pathname.startsWith(item.href + "/")
    ))
    .sort((a, b) => b.href.length - a.href.length);
  const parent = matches[0];
  const detail = parent && pathname !== parent.href;
  const detailLabel = detail ? detailLabels[parent.href] ?? "Details" : "";
  const hereLabel = detail ? detailLabel : parent?.label ?? "Workspace";

  return (
    <nav className="nhs-breadcrumbs" aria-label="Breadcrumb">
      {pathname === home ? (
        <span aria-current="page">{homeLabel}</span>
      ) : (
        <>
          <Link href={home}>{homeLabel}</Link>
          <span className="nhs-breadcrumb-separator" aria-hidden="true">/</span>
          {detail && parent ? (
            <>
              <Link href={parent.href}>{parent.label}</Link>
              <span className="nhs-breadcrumb-separator" aria-hidden="true">/</span>
              <span aria-current="page">{hereLabel}</span>
            </>
          ) : (
            <span aria-current="page">{hereLabel}</span>
          )}
        </>
      )}
    </nav>
  );
}
