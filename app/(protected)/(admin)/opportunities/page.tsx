import { MetricCard } from "@/components/MetricCard";
import {
  DocumentCreate,
  DocumentNotice,
  DocumentSectionHeading,
} from "@/components/documents/DocumentChrome";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";
import { OpportunityTable } from "@/components/opportunities/OpportunityTable";
import { addOpportunity } from "./actions";
import { APPROVED_SOURCES, OPPORTUNITY_STATUSES } from "@/lib/radar";
import { createClient } from "@/lib/supabase/server";
import type { Opportunity } from "@/lib/supabase/types";

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const { error: formError, status } = await searchParams;
  const statusFilter = OPPORTUNITY_STATUSES.some((s) => s.key === status)
    ? status!
    : null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunities")
    .select(
      "id, source, external_id, title, url, score, fit, status, metadata, created_at, updated_at",
    )
    .order("updated_at", { ascending: false });
  const opportunities = (error ? [] : (data ?? [])) as Opportunity[];
  const active = opportunities.filter(
    (o) => !["won", "lost", "passed"].includes(o.status),
  ).length;
  const qualified = opportunities.filter((o) =>
    ["qualified", "proposal", "submitted"].includes(o.status),
  ).length;
  const won = opportunities.filter((o) => o.status === "won").length;
  const scored = opportunities.filter((o) => o.score !== null);
  const average = scored.length
    ? String(
        Math.round(
          scored.reduce((sum, o) => sum + (o.score ?? 0), 0) / scored.length,
        ),
      )
    : "—";
  return (
    <div className="content-wrap management-page paperwork-page studio-page radar-page">
      <header className="page-header management-heading">
        <div>
          <p className="eyebrow">Opportunity Radar · Consider the chase</p>
          <h2>
            Good work is a choice.
            <br />
            <em>Make it a considered one.</em>
          </h2>
          <p className="page-description">
            Review the fit, keep the bid moving, and give your best ideas to
            work worth pursuing.
          </p>
        </div>
        <a className="management-text-link" href="#radar-queue">
          Review the shortlist <span aria-hidden="true">↗</span>
        </a>
      </header>
      {formError ? <DocumentNotice>{formError}</DocumentNotice> : null}
      {status && !statusFilter ? (
        <DocumentNotice>
          That bid stage is unavailable. Showing all loaded opportunities.
        </DocumentNotice>
      ) : null}
      <section className="metric-grid radar-metrics" aria-label="Radar metrics">
        <MetricCard
          label="Active"
          value={error ? "—" : String(active)}
          detail="Across loaded opportunities"
          tone="violet"
        />
        <MetricCard
          label="Qualified+"
          value={error ? "—" : String(qualified)}
          detail="Qualified through submitted"
          tone="pink"
        />
        <MetricCard
          label="Won"
          value={error ? "—" : String(won)}
          detail="Recorded as won"
          tone="cyan"
        />
        <MetricCard
          label="Average fit"
          value={error ? "—" : average}
          detail="Scored opportunities · /100"
          tone="green"
        />
      </section>
      <DocumentCreate
        title="Track an opportunity"
        detail="A title, an approved source, and a closer look."
        open={Boolean(formError)}
      >
        <form
          action={addOpportunity}
          className="radar-intake-form"
          id="radar-intake"
        >
          <label className="field">
            <span>Opportunity title</span>
            <input
              name="title"
              required
              maxLength={200}
              placeholder="A website worth making"
            />
          </label>
          <label className="field">
            <span>Source</span>
            <select name="source" required defaultValue="" aria-label="Source">
              <option value="" disabled>
                Choose a source
              </option>
              {APPROVED_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>External ID · optional</span>
            <input name="external_id" maxLength={120} />
          </label>
          <label className="field">
            <span>Listing URL · optional</span>
            <input
              name="url"
              type="url"
              maxLength={500}
              placeholder="https://"
            />
          </label>
          <div className="studio-actions">
            <PortalSubmitButton pendingLabel="Tracking…">
              Track opportunity
            </PortalSubmitButton>
            <p className="management-help">
              Manual intake. Tracking a listing does not submit a bid or contact
              anyone.
            </p>
          </div>
        </form>
      </DocumentCreate>
      <section id="radar-queue" aria-label="Tracked opportunities">
        <DocumentSectionHeading
          eyebrow="The shortlist"
          title="Tracked opportunities"
          detail="Most recently updated first"
        />
        {error ? (
          <DocumentNotice>
            Opportunity data could not load. Counts and listings are
            unavailable; refresh to try again.
          </DocumentNotice>
        ) : null}
        <OpportunityTable
          opportunities={opportunities}
          activeFilter={statusFilter}
          unavailable={Boolean(error)}
        />
      </section>
    </div>
  );
}
