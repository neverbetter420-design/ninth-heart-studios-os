import type { AppRole } from "@/lib/supabase/types";

export type StudioRoom = "observatory" | "electric" | "rose" | "artist" | "archive" | "velvet" | "private";

export const STUDIO_ROOMS: Record<StudioRoom, { title: string; section: string; description: string }> = {
  observatory: { title: "Midnight Observatory", section: "Command Center", description: "A clear view of your whole studio" },
  electric: { title: "Electric Conservatory", section: "Lead Intelligence", description: "Where new opportunities come into focus" },
  rose: { title: "Rose Salon", section: "Client Relationships", description: "Every relationship gets its own care" },
  artist: { title: "Artist's Atelier", section: "Project Delivery", description: "A purposeful space for the work" },
  archive: { title: "Private Archive", section: "Documents & Forms", description: "Beautiful order behind every agreement" },
  velvet: { title: "Velvet Room", section: "Muse", description: "A quieter place to think and create" },
  private: { title: "Private Atelier", section: "Client Portal", description: "Your welcoming private creative home" },
};

/** Pure route mapper, never used to grant or change access permissions. */
export function resolveStudioRoom(role: AppRole, path: string): StudioRoom {
  if (role === "client") return "private";
  if (path === "/" || path === "/settings" || path.startsWith("/settings/") || path.startsWith("/automations")) return "observatory";
  if (path === "/leads" || path.startsWith("/leads/") || path === "/opportunities" || path.startsWith("/opportunities/")) return "electric";
  if (path === "/clients" || path.startsWith("/clients/")) return "rose";
  if (path === "/projects" || path.startsWith("/projects/")) return "artist";
  if (path === "/forms" || path.startsWith("/forms/") || path === "/templates" || path.startsWith("/templates/") || path === "/contracts" || path.startsWith("/contracts/")) return "archive";
  if (path === "/muse" || path.startsWith("/muse/")) return "velvet";
  return "observatory";
}
