"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationContext } from "@/lib/nav";
import type { AppRole } from "@/lib/supabase/types";

export function WorkspaceBreadcrumbs({ role }: { role: AppRole }) {
  const { crumbs } = navigationContext(role, usePathname());
  return (
    <nav className="nhs-breadcrumbs" aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => (
        <Fragment key={crumb.href}>
          {index > 0 ? (
            <span className="nhs-breadcrumb-separator" aria-hidden="true">
              /
            </span>
          ) : null}
          {index === crumbs.length - 1 ? (
            <span aria-current="page">{crumb.label}</span>
          ) : (
            <Link href={crumb.href}>{crumb.label}</Link>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
