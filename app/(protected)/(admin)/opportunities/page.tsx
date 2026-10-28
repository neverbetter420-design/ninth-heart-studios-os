import { MetricCard } from "@/components/MetricCard";
import {
  DocumentCreate,
  DocumentNotice,
  DocumentSectionHeading,
} from "@/components/documents/DocumentChrome";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";
import { OpportunityTable } from "@/components/opportunities/OpportunityTable";
import { addOpportunity } from "./actions";
import { APPROVED_SOURCES, FREELANCE_SOURCES, OPPORTUNITY_STATUSES } from "@/lib/radar";
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
            Find and assess freelance web-design work on Upwork, Fiverr and
            Freelancer. Save promising listings, compare their fit, and prepare
            proposals without automatically applying or messaging anyone.
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
      <section className="radar-marketplaces" aria-label="Freelance Opportunity AI sources">
        <DocumentSectionHeading
          eyebrow="Freelance Opportunity AI · Three sources"
          title="Find the work worth pitching."
          detail="Source-aware research and preliminary fit checks. Discovery is manual until an approved provider integration is connected."
        />
        <div className="radar-marketplace-links">
          {FREELANCE_SOURCES.map((marketplace) => (
            <a
              href={marketplace.href}
              key={marketplace.name}
              target="_blank"
              rel="noopener noreferrer"
              className="radar-marketplace-link"
            >
              <strong>{marketplace.name}</strong>
              <span>{marketplace.help}</span>
              <small>{marketplace.mode} · Open ↗</small>
            </a>
          ))}
        </div>
        <p className="management-help">
          Fiverr opportunities are account-specific seller matches, not a
          public jobs feed. Upwork and Freelancer require authorized API access
          before automated searching.
          All bids, messages and offers stay manual and owner-approved.
        </p>
      </section>
      <DocumentCreate
        title="Save a freelance opportunity"
        detail="Paste a job brief for preliminary fit guidance, then decide whether to pursue it."
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
          <label className="field">
            <span>Project brief · recommended</span>
            <textarea
              name="brief"
              rows={5}
              maxLength={4000}
              placeholder="Paste the client's own description, deliverables and timeline. No sensitive details."
            />
          </label>
          <label className="field">
            <span>Listed budget (USD) · optional</span>
            <input
              name="budget_usd"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max="9999999"
              placeholder="e.g. 900"
            />
          </label>
          <div className="studio-actions">
            <PortalSubmitButton pendingLabel="Tracking…">
              Track opportunity
            </PortalSubmitButton>
            <p className="management-help">
              Manual intake only. The brief generates rule-based fit guidance,
              not a live AI assessment or prediction. You control the official
              score, proposals and platform submissions.
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
