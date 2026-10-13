import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteContract, sendContract, updateContractBody, voidContract } from "../actions";
import { createClient } from "@/lib/supabase/server";
import type { Contract } from "@/lib/supabase/types";

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: raw } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!raw) notFound();
  const contract = raw as Contract;
  const editable = contract.status === "draft";

  return (
    <div className="content-wrap">
      <div className="lead-detail-backline" style={{ marginBottom: 10 }}>
        <Link href="/contracts" className="text-button">← Contracts</Link>
      </div>

      <header className="page-header">
        <div>
          <p className="eyebrow electric">Contract · {contract.status}</p>
          <h2>{contract.title}</h2>
        </div>
        <div className="delivery-actions">
          {contract.status === "draft" ? (
            <form action={sendContract}>
              <input type="hidden" name="contract_id" value={contract.id} />
              <button type="submit" className="mini-button go">Send for signature</button>
            </form>
          ) : null}
          {["draft", "sent"].includes(contract.status) ? (
            <form action={voidContract}>
              <input type="hidden" name="contract_id" value={contract.id} />
              <button type="submit" className="mini-button danger">Void</button>
            </form>
          ) : null}
          {contract.status === "draft" ? (
            <form action={deleteContract}>
              <input type="hidden" name="contract_id" value={contract.id} />
              <button type="submit" className="mini-button danger">Delete</button>
            </form>
          ) : null}
        </div>
      </header>

      {contract.status === "signed" ? (
        <section className="panel" aria-label="Signature audit" style={{ marginBottom: 14 }}>
          <div className="panel-heading">
            <h3>Signature audit</h3>
            <span className="delivery-pill done">Signed</span>
          </div>
          <div style={{ padding: "14px 18px", display: "grid", gap: 6, fontSize: 13 }}>
            <p style={{ margin: 0 }}><strong>Signed by:</strong> {contract.signer_name} ({contract.signer_email})</p>
            <p style={{ margin: 0 }}><strong>At:</strong> {formatDateTime(contract.signed_at)}</p>
            <p style={{ margin: 0 }}><strong>IP:</strong> {contract.signer_ip ?? "not recorded"}</p>
            <p style={{ margin: 0, wordBreak: "break-all" }}>
              <strong>Document hash:</strong> <code style={{ fontSize: 11 }}>{contract.signature_hash}</code>
            </p>
          </div>
        </section>
      ) : null}

      <section className="panel" aria-label="Contract body">
        <div className="panel-heading">
          <h3>Terms</h3>
          {!editable ? <span className="pipeline-count">Locked — {contract.status}</span> : null}
        </div>
        {editable ? (
          <form action={updateContractBody} style={{ padding: "14px 18px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="hidden" name="contract_id" value={contract.id} />
            <label className="field">
              <span>Title</span>
              <input type="text" name="title" defaultValue={contract.title} maxLength={160} />
            </label>
            <label className="field">
              <span>Body</span>
              <textarea
                name="body"
                className="notes-area"
                style={{ minHeight: 320 }}
                defaultValue={contract.body}
                placeholder="Scope, payment terms, timeline, cancellation policy…"
              />
            </label>
            <div>
              <button type="submit" className="mini-button go">Save</button>
            </div>
          </form>
        ) : (
          <div style={{ padding: "14px 18px 18px", whiteSpace: "pre-wrap", fontSize: 13 }}>
            {contract.body || <span className="muted-copy">No terms written.</span>}
          </div>
        )}
      </section>
    </div>
  );
}
