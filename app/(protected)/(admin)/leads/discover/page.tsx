import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { LeadFinderReview, type FinderResult, type FinderSearch } from "@/components/leads/LeadFinderReview";
import { createClient } from "@/lib/supabase/server";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";
import {
  signalBadges,
  scoreSignals,
  normalizeSocialProfile,
  type WebsiteSignals,
} from "@/lib/prospect-scan";
import {
  analyzeProspect,
  generateDraft,
  saveDraft,
  markDraftSent,
  promoteProspect,
  archiveProspect,
} from "./actions";

type Prospect = {
  id: string;
  business_name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  signals: WebsiteSignals;
  opportunity_score: number | null;
  outreach_draft: string | null;
  outreach_status: string;
  status: string;
  scanned_at: string | null;
};

function scoreTone(score: number | null): string {
  if (score === null) return "violet";
  if (score >= 70) return "pink";
  if (score >= 40) return "violet";
  return "cyan";
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; show?: string; search?: string }>;
}) {
  const { msg, show, search } = await searchParams;
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const { data: historyData, error: historyError } = await supabase
    .from("lead_search_requests")
    .select("id,source,location,industry,status,result_count,imported_count,auto_import,error_message,created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const searches = (historyData ?? []) as FinderSearch[];
  const activeSearch = searches.find(item => item.id === search) ?? searches[0] ?? null;
  const { data: resultData } = activeSearch ? await supabase
    .from("lead_search_results")
    .select("id,business_name,source_ref,industry,address,phone,email,website,maps_url,source,discovery_score,duplicate,imported,import_status,details")
    .eq("search_id", activeSearch.id)
    .order("discovery_score", { ascending: false })
    .limit(20) : { data: [] as FinderResult[] };
  const stagedResults = (resultData ?? []) as FinderResult[];
  const finderSchemaReady = !historyError;
  const geoapifyConnected = Boolean(process.env.GEOAPIFY_API_KEY?.trim());
  let query = supabase
    .from("prospects")
    .select(
      "id, business_name, category, address, phone, website, signals, opportunity_score, outreach_draft, outreach_status, status, scanned_at",
    )
    .order("opportunity_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(60);
  query =
    show === "archived"
      ? query.eq("status", "archived")
      : query.neq("status", "archived");
  const { data, error: readError } = await query;

  // Old saved scans adopt the lower no-website score without a database backfill.
  const prospects = ((readError ? [] : (data ?? [])) as Prospect[])
    .map((p) => ({
      ...p,
      opportunity_score:
        typeof p.signals?.has_website === "boolean"
          ? scoreSignals(p.signals)
          : p.opportunity_score,
    }))
    .sort((a, b) => (b.opportunity_score ?? -1) - (a.opportunity_score ?? -1));
  const showArchived = show === "archived";

  return (
    <div className="content-wrap management-page scanner-page scanner-workroom">
      <header className="page-header management-heading">
        <div>
          <p className="eyebrow">Lead Scanner · Local intelligence</p>
          <h2>
            Better leads.
            <br />
            <em>A closer look.</em>
          </h2>
          <p className="page-description">
            Discover local businesses, review website signals and check listed
            Instagram or Facebook profiles before drafting your first approach.
          </p>
        </div>
        <Link href="/leads" className="management-text-link">
          Lead Intelligence <span aria-hidden="true">↗</span>
        </Link>
      </header>

      {msg && <p className="notice">{msg}</p>}

      <LeadFinderReview
        searches={searches}
        results={stagedResults}
        selectedId={activeSearch?.id}
        schemaReady={finderSchemaReady}
        geoapifyConnected={geoapifyConnected}
      />

      <section aria-label="Prospects">
        <div className="section-head">
          <h3>
            Prospects{" "}
            <span className="count">{readError ? "—" : prospects.length}</span>
          </h3>
          <a
            className="mini-button"
            href={
              showArchived ? "/leads/discover" : "/leads/discover?show=archived"
            }
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </a>
        </div>

        <p className="management-help">
          Saved prospect workspace, separate from the new Lead Finder review queue. Existing scores are ranked within this view.
        </p>
        {readError ? (
          <p className="management-notice" role="alert">
            Prospects could not load. Refresh to try again; the count is
            unavailable.
          </p>
        ) : null}
        {!readError && prospects.length === 0 && (
          <p className="empty-state">
            No prospects yet. Run a scan above and they&apos;ll land here,
            scored and ready.
          </p>
        )}

        <div className="prospect-grid">
          {prospects.map((p) => {
            const badges = signalBadges(p.signals ?? ({} as WebsiteSignals));
            return (
              <article key={p.id} className="card prospect-card">
                <div className="prospect-head">
                  <div>
                    <h4>{p.business_name}</h4>
                    <p className="muted">
                      {[p.category, p.address].filter(Boolean).join(" · ") ||
                        "—"}
                    </p>
                  </div>
                  <span
                    className={`score score-${scoreTone(p.opportunity_score)}`}
                  >
                    {p.opportunity_score ?? "—"}
                  </span>
                </div>

                <div className="badge-row">
                  {badges.map((b, i) => (
                    <span key={i} className={`badge badge-${b.tone}`}>
                      {b.label}
                    </span>
                  ))}
                </div>

                <div className="prospect-meta muted">
                  {p.website ? (
                    <a href={p.website} target="_blank" rel="noreferrer">
                      {p.website.replace(/^https?:\/\//, "").split("/")[0]}
                    </a>
                  ) : (
                    <span>Website not confirmed</span>
                  )}
                  {p.phone && <span> · {p.phone}</span>}
                  {p.status === "promoted" && <span> · ✓ In leads</span>}
                  {p.outreach_status === "sent" && <span> · ✉ Sent</span>}
                </div>

                <section
                  className="prospect-social-check"
                  aria-label={`Social verification for ${p.business_name}`}
                >
                  {(p.signals?.social_profiles ?? [])
                    .filter((profile) =>
                      normalizeSocialProfile(profile.url, profile.platform),
                    )
                    .map((profile) => (
                      <div key={profile.url}>
                        <a
                          href={normalizeSocialProfile(
                            profile.url,
                            profile.platform,
                          )!}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {profile.platform === "instagram"
                            ? "Instagram"
                            : "Facebook"}{" "}
                          ↗
                        </a>
                        <span>
                          {profile.status === "matched"
                            ? "Business details match"
                            : "Needs verification"}
                        </span>
                        <small>{profile.evidence}</small>
                      </div>
                    ))}
                  {!p.signals?.social_profiles?.length && (
                    <p>
                      {p.signals?.social_checked_at
                        ? "No social profile found in the available listing or website. Verify manually."
                        : "Social profiles have not been checked. Re-analyze to verify."}
                    </p>
                  )}
                  {p.signals?.website_source === "social_profile" && (
                    <p>Website found on a matching social profile.</p>
                  )}
                  {!p.website && (
                    <div className="prospect-social-search">
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(`site:instagram.com "${p.business_name}" ${p.address ?? ""}`)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Search Instagram ↗
                      </a>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(`site:facebook.com "${p.business_name}" ${p.address ?? ""}`)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Search Facebook ↗
                      </a>
                    </div>
                  )}
                </section>

                <div className="prospect-actions">
                  <form action={analyzeProspect.bind(null, p.id)}>
                    <PortalSubmitButton
                      className="mini-button"
                      pendingLabel="Checking website & socials…"
                    >
                      Re-analyze &amp; check socials
                    </PortalSubmitButton>
                  </form>
                  <form action={generateDraft.bind(null, p.id)}>
                    <button type="submit" className="mini-button">
                      {p.outreach_draft ? "Regenerate draft" : "Draft outreach"}
                    </button>
                  </form>
                  {p.status !== "promoted" && (
                    <form action={promoteProspect.bind(null, p.id)}>
                      <button type="submit" className="mini-button accent">
                        → Lead
                      </button>
                    </form>
                  )}
                  <form action={archiveProspect.bind(null, p.id)}>
                    <button type="submit" className="mini-button ghost">
                      Archive
                    </button>
                  </form>
                </div>

                {(p.outreach_draft || p.outreach_status !== "none") && (
                  <details className="draft-details">
                    <summary>
                      Outreach draft
                      {p.outreach_status === "sent" ? " (sent)" : ""}
                    </summary>
                    <form
                      action={saveDraft.bind(null, p.id)}
                      className="form-grid"
                    >
                      <textarea
                        name="outreach_draft"
                        defaultValue={p.outreach_draft ?? ""}
                        rows={10}
                      />
                      <div className="row">
                        <button type="submit" className="mini-button">
                          Save draft
                        </button>
                        {p.outreach_status !== "sent" && p.outreach_draft && (
                          <button
                            type="submit"
                            className="mini-button ghost"
                            formAction={markDraftSent.bind(null, p.id)}
                          >
                            Mark sent
                          </button>
                        )}
                      </div>
                      <p className="form-hint">
                        Drafts never send themselves. Copy it into Gmail when
                        you&apos;re happy with it, then mark sent.
                      </p>
                    </form>
                  </details>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
