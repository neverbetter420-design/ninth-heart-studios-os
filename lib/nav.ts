import type { AppRole } from "@/lib/supabase/types";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  section: string;
  roles: readonly AppRole[];
};

export const navItems: readonly NavItem[] = [
  {
    href: "/",
    label: "Command Center",
    icon: "◇",
    section: "Overview",
    roles: ["admin"],
  },
  {
    href: "/leads",
    label: "Lead Intelligence",
    icon: "↗",
    section: "Growth",
    roles: ["admin"],
  },
  {
    href: "/leads/discover",
    label: "Lead Scanner",
    icon: "⌖",
    section: "Growth",
    roles: ["admin"],
  },
  {
    href: "/opportunities",
    label: "Opportunity Radar",
    icon: "✦",
    section: "Growth",
    roles: ["admin"],
  },
  {
    href: "/projects",
    label: "Project Pipeline",
    icon: "⌁",
    section: "Delivery",
    roles: ["admin"],
  },
  {
    href: "/clients",
    label: "Client Management",
    icon: "◎",
    section: "Delivery",
    roles: ["admin"],
  },
  {
    href: "/contracts",
    label: "Contracts",
    icon: "✒",
    section: "Workspace",
    roles: ["admin"],
  },
  {
    href: "/templates",
    label: "Text templates",
    icon: "▱",
    section: "Workspace",
    roles: ["admin"],
  },
  {
    href: "/forms",
    label: "Fillable Forms",
    icon: "▤",
    section: "Workspace",
    roles: ["admin"],
  },
  {
    href: "/muse",
    label: "Muse",
    icon: "✧",
    section: "Studio",
    roles: ["admin"],
  },
  {
    href: "/automations",
    label: "Automations",
    icon: "⚡",
    section: "Studio",
    roles: ["admin"],
  },
  {
    href: "/settings",
    label: "Settings",
    icon: "⚙",
    section: "Studio",
    roles: ["admin"],
  },
  {
    href: "/portal",
    label: "Home",
    icon: "◇",
    section: "My workspace",
    roles: ["client"],
  },
  {
    href: "/portal/projects",
    label: "My Projects",
    icon: "⌁",
    section: "My workspace",
    roles: ["client"],
  },
  {
    href: "/portal/messages",
    label: "Messages",
    icon: "✉",
    section: "Communication",
    roles: ["client"],
  },
  {
    href: "/portal/files",
    label: "Files",
    icon: "▤",
    section: "Communication",
    roles: ["client"],
  },
  {
    href: "/portal/approvals",
    label: "Approvals",
    icon: "✓",
    section: "Decisions & documents",
    roles: ["client"],
  },
  {
    href: "/portal/documents",
    label: "Documents",
    icon: "▱",
    section: "Decisions & documents",
    roles: ["client"],
  },
] as const;

export type WorkspaceCrumb = { href: string; label: string };

const workspaceLabels: Record<string, string> = {
  "/projects": "Project workspace",
  "/portal/projects": "Project workspace",
  "/clients": "Client workspace",
  "/leads": "Lead workspace",
  "/opportunities": "Opportunity workspace",
  "/templates": "Template workspace",
  "/contracts": "Contract workspace",
  "/forms": "Form workspace",
};

/** One route context keeps menu selection and return paths in agreement. */
export function navigationContext(role: AppRole, pathname: string) {
  const home = role === "admin" ? "/" : "/portal";
  const homeLabel = role === "admin" ? "Command Center" : "Home";
  const homeCrumb = { href: home, label: homeLabel };
  if (pathname === home) return { activeHref: home, crumbs: [homeCrumb] };

  if (
    role === "client" &&
    ["/portal/contracts", "/portal/forms"].includes(pathname)
  ) {
    return {
      activeHref: "/portal/documents",
      crumbs: [
        homeCrumb,
        { href: "/portal/documents", label: "Documents" },
        {
          href: pathname,
          label: pathname === "/portal/contracts" ? "Contracts" : "Forms",
        },
      ],
    };
  }

  const parent = navItems
    .filter((item) => item.roles.includes(role) && item.href !== home)
    .filter(
      (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (!parent)
    return {
      activeHref: undefined,
      crumbs: [homeCrumb, { href: pathname, label: "Workspace" }],
    };
  const crumbs: WorkspaceCrumb[] = [
    homeCrumb,
    { href: parent.href, label: parent.label },
  ];
  if (pathname !== parent.href)
    crumbs.push({
      href: pathname,
      label: workspaceLabels[parent.href] ?? "Workspace",
    });
  return { activeHref: parent.href, crumbs };
}
