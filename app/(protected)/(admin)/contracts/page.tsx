import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import { createContract } from "./actions";
import { createClient } from "@/lib/supabase/server";
import type { Contract } from "@/lib/supabase/types";

const STATUS_ORDER = ["draft", "sent", "signed", "voided"];

function statusClass(status: string) {
  if (status === "signed") return "delivery-pill done";
  if (status === "sent") return "delivery-pill progress";
  if (status === "voided") return "delivery-pill blocked";
  return "delivery-pill visible";
}

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: formError } = await searchParams;
  const supabase = await createClient();

  const [{ data: rawContracts }, { data: rawProjects }, { data: rawOpportunities }] =
    await Promise.all([
      supabase
        .from("contracts")
        .select("id, project_id, opportunity_id, title, status, sent_at, signed_at, signer_name, created_at")
        .order("updated_at", { ascending: false }),
      supabase.from("projects").select("id, name").order("name"),
      supabase.from("opportunities").select("id, title").order("title"),
    ]);

  const contracts = (rawContracts ?? []) as Contract[];
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, contracts.filter((c) => c.status === s).length]));

  return (
    <div className="content-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow electric">Contracts + E-Signature</p>
          <h2>Get it in writing.</h2>
          <p className="page-description">
            In-app click-to-accept signing. Timestamp, signer, IP, and document
            hash on every signature — no vendor, no fees.
          </p>
        </div>
      </header>

      {formError ? (
        <section className="panel lead-query-error" style={{ marginBottom: 14 }}>
          <strong>Heads up.</strong>
          <span>{decodeURIComponent(formError)}</span>
        </section>
      ) : null}

      <section className="metric-grid" aria-label="Contract metrics">
        <MetricCard label="Drafts" value={String(counts.draft ?? 0)} detail="Being written" tone="violet" />
        <MetricCard label="Sent" value={String(counts.sent ?? 0)} detail="Awaiting signature" tone="pink" />
        <MetricCard label="Signed" value={String(counts.signed ?? 0)} detail="Locked in" tone="cyan" />
        <MetricCard label="Voided" value={String(counts.voided ?? 0)} detail="Dead deals" tone="green" />
      </section>

      <section className="panel" aria-label="New contract" style={{ marginBottom: 14 }}>
        <div className="panel-heading">
          <h3>New contract</h3>
        </div>
        <form action={createContract} className="delivery-add-form">
          <input type="text" name="title" placeholder="Contract title…" required maxLength={160} />
          <select name="project_id" defaultValue="" aria-label="Project">
            <option value="">Project…</option>
            {((rawProjects ?? []) as { id: string; name: string }[]).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select name="opportunity_id" defaultValue="" aria-label="Opportunity">
            <option value="">Opportunity…</option>
            {((rawOpportunities ?? []) as { id: string; title: string }[]).map((o) => (
              <option key={o.id} value={o.id}>{o.title}</option>
            ))}
          </select>
          <button type="submit" className="mini-button go">Draft</button>
        </form>
      </section>

      <section className="panel" aria-label="Contracts">
        <div className="panel-heading">
          <h3>All contracts</h3>
          <span className="pipeline-count">{contracts.length}</span>
        </div>
        <ul className="delivery-list">
          {contracts.length === 0 ? (
            <li className="delivery-row">
              <p className="pipeline-empty">No contracts yet. Verbal agreements are the freelancer&apos;s original sin.</p>
            </li>
          ) : (
            contracts.map((c) => (
              <li key={c.id} className="delivery-row">
                <div className="delivery-row-main">
                  <p className="delivery-row-title">
                    <Link href={`/contracts/${c.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                      {c.title}
                    </Link>
                  </p>
                  <p className="delivery-row-sub">
                    {c.status === "signed" && c.signer_name
                      ? `Signed by ${c.signer_name}`
                      : c.status === "sent"
                        ? "Waiting on signature"
                        : `Created ${new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                  </p>
                </div>
                <span className={statusClass(c.status)}>{c.status}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
