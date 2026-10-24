"use client";

import { usePathname } from "next/navigation";
import type { AppRole } from "@/lib/supabase/types";
import { resolveStudioRoom, STUDIO_ROOMS } from "@/lib/studio-rooms";

/** Visible orientation cue and narrowly scoped CSS marker; not an access control. */
export function RoomIdentity({ role }: { role: AppRole }) {
  const pathname = usePathname() || (role === "client" ? "/portal" : "/");
  const room = resolveStudioRoom(role, pathname);
  return (
    <span
      className="nhs-room-identity"
      data-room={room}
      aria-label={"Current studio room: " + STUDIO_ROOMS[room].title}
      title={STUDIO_ROOMS[room].description}
    >
      <span className="nhs-room-symbol" aria-hidden="true">✧</span>
      {STUDIO_ROOMS[room].title}
    </span>
  );
}
