import { signContract } from "@/app/(protected)/portal/contracts/actions";
import type { Contract } from "@/lib/supabase/types";

export function ContractSign({ contracts }: { contracts: Contract[] }) {
  if (contracts.length === 0) return null;

  return (
    <article className="panel detail-panel" aria-label="Contracts">
      <h3>Contracts</h3>
      {contracts.map((c) => (
        <details key={c.id} className="panel" style={{ margin: "10px 0", borderRadius: 12 }}>
          <summary className="panel-heading" style={{ cursor: "pointer" }}>
            <h3 style={{ fontSize: 14 }}>{c.title}</h3>
            <span
              className={`delivery-pill ${c.status === "signed" ? "done" : c.status === "sent" ? "progress" : "blocked"}`}
            >
              {c.status === "signed" ? "Signed" : c.status === "sent" ? "Needs signature" : c.status}
            </span>
          </summary>
          <div style={{ padding: "0 18px 18px" }}>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13, marginBottom: 14, maxHeight: 300, overflowY: "auto" }}>
              {c.body || <span className="muted-copy">No terms provided.</span>}
            </div>
            {c.status === "sent" ? (
              <form action={signContract} className="muse-send-form">
                <input type="hidden" name="contract_id" value={c.id} />
                <label className="field">
                  <span>Your full name</span>
                  <input type="text" name="signer_name" placeholder="Jane Smith" required maxLength={120} autoComplete="name" />
                </label>
                <label className="field">
                  <span>Your email</span>
                  <input type="email" name="signer_email" placeholder="you@example.com" required maxLength={160} autoComplete="email" />
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
                  <input type="checkbox" name="agreed" required style={{ marginTop: 3 }} />
                  <span>I have read these terms and agree to them.</span>
                </label>
                <button type="submit" className="mini-button go">Sign contract</button>
                <p className="muted small">Your name, email, timestamp, and IP are recorded as your signature.</p>
              </form>
            ) : c.status === "signed" ? (
              <p className="muted-copy" style={{ fontSize: 13 }}>
                Signed by {c.signer_name} on{" "}
                {c.signed_at
                  ? new Date(c.signed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "—"}
                .
              </p>
            ) : null}
          </div>
        </details>
      ))}
    </article>
  );
}
