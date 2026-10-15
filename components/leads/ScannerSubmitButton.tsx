"use client";

import { useFormStatus } from "react-dom";

export function ScannerSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="primary-button" disabled={pending} aria-busy={pending}>
      {pending ? "Scanning up to 12 businesses…" : "Scan"}
    </button>
  );
}
