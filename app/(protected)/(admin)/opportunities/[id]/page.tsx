import Link from "next/link";
import { notFound } from "next/navigation";
import { FitScorer } from "@/components/opportunities/FitScorer";
import { FitExplanation } from "@/components/opportunities/FitExplanation";
import { ProposalSection } from "@/components/opportunities/ProposalSection";
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

  const [{ data: rawOpportunity }, { data: rawProposals }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, source, external_id, title, url, score, fit, status, metadata, created_at, updated_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("proposals")
      .select("id, opportunity_id, title, content, status, created_at, updated_at")
      .eq("opportunity_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!rawOpportunity) notFound();
  const opportunity = rawOpportunity as Opportunity;
  const breakdown = ((opportunity.metadata as Record<string, unknown>)?.fit_breakdown ?? {}) as Partial<FitBreakdown>;

  return (
    <div className="content-wrap">
      <div className="lead-detail-backline" style={{ marginBottom: 10 }}>
        <Link href="/opportunities" className="text-button">← Opportunity Radar</Link>
      </div>

      {queryError ? (
        <section className="panel lead-query-error" style={{ marginBottom: 14 }}>
          <strong>Heads up.</strong>
          <span>{decodeURIComponent(queryError)}</span>
        </section>
      ) : null}

      <header className="page-header">
        <div>
          <p className="eyebrow electric">{opportunity.source} · Opportunity</p>
          <h2>{opportunity.title}</h2>
          <p className="page-description">
            <span className="stage-badge">{opportunityStatusLabel(opportunity.status)}</span>{" "}
            {opportunity.score !== null ? `${opportunity.score}/100 · ${fitVerdict(opportunity.score)}` : "Unscored"}
            {opportunity.url ? (
              <>
                {" · "}
                <a href={opportunity.url} target="_blank" rel="noopener noreferrer">View listing</a>
              </>
            ) : null}
          </p>
        </div>
        <div className="delivery-actions">
          <form action={updateOpportunityStatus} className="mini-form">
            <input type="hidden" name="opportunity_id" value={opportunity.id} />
            <select name="status" defaultValue={opportunity.status} aria-label="Bid stage">
              {OPPORTUNITY_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <button type="submit" className="mini-button go">Move</button>
          </form>
          <form action={deleteOpportunity}>
            <input type="hidden" name="opportunity_id" value={opportunity.id} />
            <button type="submit" className="mini-button danger">Delete</button>
          </form>
        </div>
      </header>

      <FitExplanation
        opportunityId={opportunity.id}
        score={opportunity.score}
        fit={opportunity.fit}
        breakdown={breakdown}
      />

      <div className="workspace-grid">
        <div className="workspace-span-6">
          <FitScorer
            opportunityId={opportunity.id}
            score={opportunity.score}
            fit={opportunity.fit}
            breakdown={breakdown}
          />
        </div>
        <div className="workspace-span-6">
          <ProposalSection
            opportunityId={opportunity.id}
            proposals={(rawProposals ?? []) as Proposal[]}
          />
        </div>
      </div>
    </div>
  );
}
