/** Familiar, functional route symbols. Decorative only: each action keeps a text label. */
export type PortalIconName = "messages" | "files" | "documents" | "approvals" | "journey" | "connect" | "next";

export function PortalIcon({ name, size = 25 }: { name: PortalIconName; size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {name === "messages" && <><path d="M6 6.5h20v14H14l-5.5 5v-5H6z"/><path d="M10.5 12h11m-11 4h7"/></>}
      {name === "files" && <><path d="M3.8 9V6h10l3 3H27v17H4V9z"/><path d="M4 12h24M10 17h11m-11 4h7"/></>}
      {name === "documents" && <><path d="M9 3h10l5 5v21H9z"/><path d="M19 3v6h5M13 15h8m-8 5h8m-8 5h5"/></>}
      {name === "approvals" && <><path d="M16 3.5 27 8v8c0 6.5-4 10.6-11 13-7-2.4-11-6.5-11-13V8z"/><path d="m10.5 16 3.5 3.5 7.5-8"/></>}
      {name === "journey" && <><circle cx="16" cy="16" r="11"/><path d="M16 5v4m0 14v4M5 16h4m14 0h4m-15-5 7 7-4.5 4"/></>}
      {name === "connect" && <><path d="M5 12a6 6 0 0 1 6-6h10a6 6 0 0 1 6 6v9H15l-6 5v-5H5z"/><path d="M11 13h10m-10 4h6"/></>}
      {name === "next" && <><circle cx="16" cy="16" r="11"/><path d="m13 11 5 5-5 5m-6-5h11"/></>}
    </svg>
  );
}
