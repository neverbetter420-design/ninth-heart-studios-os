"use client";

import { useEffect, useState } from "react";

type Notice = { message: string; kind: "success" | "error" };

/** Accessible, dismissible confirmations that remain visible after a row updates. */
export function ActionNotifications() {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const onSuccess = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (typeof detail === "string" && detail.trim()) setNotice({ message: detail, kind: "success" });
    };
    const onError = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (typeof detail === "string" && detail.trim()) setNotice({ message: detail, kind: "error" });
    };
    window.addEventListener("nhs-action-success", onSuccess);
    window.addEventListener("nhs-action-error", onError);
    return () => {
      window.removeEventListener("nhs-action-success", onSuccess);
      window.removeEventListener("nhs-action-error", onError);
    };
  }, []);

  return notice ? (
    <div className="action-notification nhs-soft-notice" data-tone={notice.kind}>
      <span className="nhs-notice-icon" aria-hidden="true">{notice.kind === "success" ? "✓" : "!"}</span>
      <p role={notice.kind === "error" ? "alert" : "status"}>{notice.message}</p>
      <button type="button" className="mini-button" onClick={() => setNotice(null)} aria-label="Dismiss confirmation">Dismiss</button>
    </div>
  ) : null;
}
