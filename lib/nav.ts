import type { AppRole } from "@/lib/supabase/types";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  section: string;
  roles: readonly AppRole[];
};

export const navItems: readonly NavItem[] = [
  { href: "/", label: "Command Center", icon: "◇", section: "Overview", roles: ["admin"] },
  { href: "/leads", label: "Lead Intelligence", icon: "↗", section: "Growth", roles: ["admin"] },
  { href: "/leads/discover", label: "Lead Scanner", icon: "⌖", section: "Growth", roles: ["admin"] },
  { href: "/opportunities", label: "Opportunity Radar", icon: "✦", section: "Growth", roles: ["admin"] },
  { href: "/projects", label: "Project Pipeline", icon: "⌁", section: "Delivery", roles: ["admin"] },
  { href: "/clients", label: "Client Management", icon: "◎", section: "Delivery", roles: ["admin"] },
  { href: "/contracts", label: "Contracts", icon: "✒", section: "Workspace", roles: ["admin"] },
  { href: "/templates", label: "Master Templates", icon: "▱", section: "Workspace", roles: ["admin"] },
  { href: "/forms", label: "Fillable Forms", icon: "▤", section: "Workspace", roles: ["admin"] },
  { href: "/muse", label: "Muse", icon: "✧", section: "Studio", roles: ["admin"] },
  { href: "/automations", label: "Automations", icon: "⚡", section: "Studio", roles: ["admin"] },
  { href: "/settings", label: "System Settings", icon: "⚙", section: "Studio", roles: ["admin"] },
  { href: "/portal", label: "Home", icon: "◇", section: "My workspace", roles: ["client"] },
  { href: "/portal/projects", label: "My Projects", icon: "⌁", section: "My workspace", roles: ["client"] },
  { href: "/portal/messages", label: "Messages", icon: "✉", section: "Communication", roles: ["client"] },
  { href: "/portal/files", label: "Files", icon: "▤", section: "Communication", roles: ["client"] },
  { href: "/portal/approvals", label: "Approvals", icon: "✓", section: "Decisions & documents", roles: ["client"] },
  { href: "/portal/contracts", label: "Contracts", icon: "✒", section: "Decisions & documents", roles: ["client"] },
  { href: "/portal/forms", label: "Forms", icon: "▱", section: "Decisions & documents", roles: ["client"] },
] as const;
