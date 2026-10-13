import { MetricCard } from "@/components/MetricCard";
import { OpportunityTable } from "@/components/opportunities/OpportunityTable";
import { addOpportunity } from "./actions";
import { APPROVED_SOURCES } from "@/lib/radar";
import { createClient } from "@/lib/supabase/server";
import type { Opportunity } from "@/lib/supabase/types";

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const { error: formError, status: statusFilter } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("opportunities")
    .select("id, source, external_id, title, url, score, fit, status, metadata, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (statusFilter) query = query.eq("status", statusFilter);
  const { data, error } = await query;

  const opportunities = ((data ?? []) as Opportunity[]);

  const active = opportunities.filter((o) => !["won", "lost", "passed"].includes(o.status)).length;
  const qualified = opportunities.filter((o) => ["qualified", "proposal", "submitted"].includes(o.status)).length;
  const won = opportunities.filter((o) => o.status === "won").length;
  const scored = opportunities.filter((o) => o.score !== null);
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((s, o) => s + (o.score ?? 0), 0) / scored.length)
      : 0;

  return (
    <div className="content-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow electric">Opportunity Radar</p>
          <h2>Find work worth chasing.</h2>
          <p className="page-description">
            Score outside opportunities against NHS fit before spending time on a
            proposal that was doomed at birth.
          </p>
        </div>
      </header>

      {formError ? (
        <section className="panel lead-query-error" style={{ marginBottom: 14 }}>
          <strong>Heads up.</strong>
          <span>{decodeURIComponent(formError)}</span>
        </section>
      ) : null}

      <section className="metric-grid" aria-label="Radar metrics">
        <MetricCard label="Active" value={String(active)} detail="In the pipeline" tone="violet" />
        <MetricCard label="Qualified+" value={String(qualified)} detail="Proposal stage or better" tone="pink" />
        <MetricCard label="Won" value={String(won)} detail="Closed deals" tone="cyan" />
        <MetricCard label="Avg Fit Score" value={String(avgScore)} detail="Across scored leads" tone="green" />
      </section>

      <section className="panel" aria-label="Add opportunity" style={{ marginBottom: 14 }}>
        <div className="panel-heading">
          <h3>Track an opportunity</h3>
          <span className="pipeline-count">Approved sources only</span>
        </div>
        <form action={addOpportunity} className="delivery-add-form">
          <input type="text" name="title" placeholder="Opportunity title…" required maxLength={200} />
          <select name="source" required defaultValue="" aria-label="Source">
            <option value="" disabled>Source…</option>
            {APPROVED_SOURCES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input type="text" name="external_id" placeholder="External ID (optional)…" maxLength={120} />
          <input type="url" name="url" placeholder="URL (optional)…" maxLength={500} />
          <button type="submit" className="mini-button go">Track</button>
        </form>
      </section>

      {error ? (
        <section className="panel lead-query-error">
          <strong>Opportunity data could not load.</strong>
          <span>{error.message}</span>
        </section>
      ) : null}

      <OpportunityTable opportunities={opportunities} activeFilter={statusFilter ?? null} />
    </div>
  );
}
