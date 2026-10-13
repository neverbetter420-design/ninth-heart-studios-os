import type { AppRole } from "@/lib/supabase/types";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles: readonly AppRole[];
};

export const navItems: readonly NavItem[] = [
  { href: "/", label: "Command Center", icon: "◇", roles: ["admin"] },
  { href: "/leads", label: "Lead Intelligence", icon: "↗", roles: ["admin"] },
  { href: "/projects", label: "Project Pipeline", icon: "⌁", roles: ["admin"] },
  { href: "/clients", label: "Client Management", icon: "◎", roles: ["admin"] },
  { href: "/opportunities", label: "Opportunity Radar", icon: "✦", roles: ["admin"] },
  { href: "/muse", label: "Muse", icon: "✧", roles: ["admin"] },
  { href: "/templates", label: "Master Templates", icon: "▱", roles: ["admin"] },
  { href: "/settings", label: "System Settings", icon: "⚙", roles: ["admin"] },
  { href: "/portal", label: "My Project Portal", icon: "◇", roles: ["client"] },
] as const;
