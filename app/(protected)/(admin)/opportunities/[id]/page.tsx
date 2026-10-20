import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DocumentNotice,
  DocumentSectionHeading,
} from "@/components/documents/DocumentChrome";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";
import { FitScorer } from "@/components/opportunities/FitScorer";
import { FitExplanation } from "@/components/opportunities/FitExplanation";
import { ProposalSection } from "@/components/opportunities/ProposalSection";
import { listingUrl } from "@/components/opportunities/OpportunityTable";
import { deleteOpportunity, updateOpportunityStatus } from "../actions";
import {
  OPPORTUNITY_STATUSES,
  fitVerdict,
  opportunityStatusLabel,
  type FitBreakdown,
} from "@/lib/radar";
import { createClient } from "@/lib/supabase/server";
import type { Opportunity, Proposal } from "@/lib/supabase/types";

export default async function OpportunityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error: queryError } = await searchParams;
  const supabase = await createClient();
  const [
    { data: rawOpportunity, error: opportunityError },
    { data: rawProposals, error: proposalError },
  ] = await Promise.all([
    supabase
      .from("opportunities")
      .select(
        "id, source, external_id, title, url, score, fit, status, metadata, created_at, updated_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("proposals")
      .select(
        "id, opportunity_id, title, content, status, created_at, updated_at",
      )
      .eq("opportunity_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (opportunityError)
    return (
      <div className="content-wrap management-page">
        <Link href="/opportunities" className="management-back-link">
          ← Opportunity Radar
        </Link>
        <DocumentNotice>
          Opportunity details could not load. Refresh to try again.
        </DocumentNotice>
      </div>
    );
  if (!rawOpportunity) notFound();
  const opportunity = rawOpportunity as Opportunity;
  const breakdown = (opportunity.metadata?.fit_breakdown ??
    {}) as Partial<FitBreakdown>;
  const url = listingUrl(opportunity.url);
  return (
    <div className="content-wrap management-page paperwork-page studio-page radar-page">
      <Link href="/opportunities" className="management-back-link">
        ← Opportunity Radar
      </Link>
      {queryError ? <DocumentNotice>{queryError}</DocumentNotice> : null}
      <header className="page-header management-heading">
        <div>
          <p className="eyebrow">
            {opportunity.source} · Opportunity workspace
          </p>
          <h2>{opportunity.title}</h2>
          <p className="page-description">
            {opportunityStatusLabel(opportunity.status)} ·{" "}
            {opportunity.score === null
              ? "Unscored"
              : `${opportunity.score}/100 · ${fitVerdict(opportunity.score)}`}
          </p>
        </div>
        {url ? (
          <a
            className="management-text-link"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            View original listing <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </header>
      <nav
        className="management-destinations"
        aria-label="Opportunity destinations"
      >
        <a href="#radar-fit">Review the fit</a>
        <a href="#radar-proposals">Proposal drafts</a>
        <a href="#radar-record">Bid record</a>
      </nav>
      <section
        id="radar-fit"
        aria-label="Review the fit"
        className="radar-section"
      >
        <DocumentSectionHeading
          eyebrow="01 · The decision"
          title="Does the work fit the studio?"
          detail="Five dimensions · 20 points each"
        />
        <div className="radar-fit-grid">
          <FitExplanation
            opportunityId={opportunity.id}
            score={opportunity.score}
            fit={opportunity.fit}
            breakdown={breakdown}
          />
          <FitScorer
            opportunityId={opportunity.id}
            score={opportunity.score}
            fit={opportunity.fit}
            breakdown={breakdown}
          />
        </div>
      </section>
      <ProposalSection
        opportunityId={opportunity.id}
        proposals={proposalError ? [] : ((rawProposals ?? []) as Proposal[])}
        unavailable={Boolean(proposalError)}
      />
      <section
        id="radar-record"
        aria-label="Bid record"
        className="radar-section"
      >
        <DocumentSectionHeading
          eyebrow="03 · The record"
          title="Keep the bid moving."
        />
        <form action={updateOpportunityStatus} className="radar-stage-form">
          <input type="hidden" name="opportunity_id" value={opportunity.id} />
          <label className="field">
            <span>Bid stage</span>
            <select
              name="status"
              defaultValue={opportunity.status}
              aria-label="Bid stage"
            >
              {OPPORTUNITY_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <PortalSubmitButton pendingLabel="Moving…">
            Move stage
          </PortalSubmitButton>
        </form>
        <p className="management-help">
          Stage changes update this studio record. They do not submit a bid or
          send a message.
        </p>
        <details className="radar-delete">
          <summary>Remove this opportunity</summary>
          <p className="management-help">
            Permanently deletes this opportunity and its proposal records.
          </p>
          <form action={deleteOpportunity}>
            <input type="hidden" name="opportunity_id" value={opportunity.id} />
            <PortalSubmitButton
              className="mini-button danger"
              pendingLabel="Deleting…"
            >
              Delete opportunity
            </PortalSubmitButton>
          </form>
        </details>
      </section>
    </div>
  );
}
