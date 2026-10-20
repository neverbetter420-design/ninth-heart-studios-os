"use client";

import { useEffect, useState } from "react";

/** Keep confirmed feedback visible after an affected row disappears or moves. */
export function ActionNotifications() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const onSuccess = (event: Event) => setMessage((event as CustomEvent<string>).detail);
    window.addEventListener("nhs-action-success", onSuccess);
    return () => window.removeEventListener("nhs-action-success", onSuccess);
  }, []);

  return message ? (
    <div className="action-notification">
      <p role="status" aria-live="polite">{message}</p>
      <button type="button" className="mini-button" onClick={() => setMessage("")} aria-label="Dismiss confirmation">Dismiss</button>
    </div>
  ) : null;
}
