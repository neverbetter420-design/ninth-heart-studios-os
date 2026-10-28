import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ScannerSubmitButton } from "@/components/leads/ScannerSubmitButton";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";
import { buildChallengerShortlists, type SavedChallenger } from "@/lib/prospect-shortlists";
import { createDeepScan, processDeepScanBatch, changeDeepScanStatus } from "./deep-actions";
import {
  NICHES,
  signalBadges,
  scoreSignals,
  normalizeSocialProfile,
  type WebsiteSignals,
} from "@/lib/prospect-scan";
import {
  runScan,
  analyzeProspect,
  generateDraft,
  saveDraft,
  markDraftSent,
  promoteProspect,
  archiveProspect,
} from "./actions";

const CATEGORY_FILTERS = {
  all: null,
  restaurants: ["restaurant", "catering.restaurant"],
  bars: ["bar", "pub", "catering.bar", "catering.pub"],
  salons: ["hairdresser", "beauty", "barber", "service.beauty", "service.beauty.hairdresser"],
} as const;
type CategoryFilter = keyof typeof CATEGORY_FILTERS;

type DeepScanPreview = {
  id: string;
  area_label: string;
  status: string;
  requested: number;
  position: number;
  created_count: number;
  refreshed_count: number;
  held_count: number;
  conflict_count: number;
  candidates: unknown[];
  last_error: string | null;
  lease_until: string | null;
  created_at: string;
};

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
  searchParams: Promise<{ msg?: string; show?: string; sort?: string; category?: string }>;
}) {
  const { msg, show, sort, category } = await searchParams;
  const supabase = await createClient();
  const showArchived = show === "archived";
  const sortByPriority = sort === "priority";
  const categoryFilter: CategoryFilter = category && Object.prototype.hasOwnProperty.call(CATEGORY_FILTERS, category)
    ? category as CategoryFilter : "all";
  // Keep sort and filters when switching between views, without copying arbitrary query parameters.
  const viewPath = (changes: { show?: string; sort?: string; category?: string } = {}) => {
    const queryParams = new URLSearchParams();
    if ((changes.show ?? (showArchived ? "archived" : "")) === "archived") queryParams.set("show", "archived");
    if ((changes.sort ?? (sortByPriority ? "priority" : "recent")) === "priority") queryParams.set("sort", "priority");
    const type = changes.category ?? categoryFilter;
    if (type !== "all") queryParams.set("category", type);
    const suffix = queryParams.toString();
    return `/leads/discover${suffix ? `?${suffix}` : ""}`;
  };
  let query = supabase
    .from("prospects")
    .select(
      "id, business_name, category, address, phone, website, signals, opportunity_score, outreach_draft, outreach_status, status, scanned_at",
    )
    .order(sortByPriority ? "opportunity_score" : "scanned_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(60);
  query = showArchived ? query.eq("status", "archived") : query.neq("status", "archived");
  if (categoryFilter !== "all") {
    query = query.in("category", [...CATEGORY_FILTERS[categoryFilter]!]);
  }
  const { data, error: readError } = await query;

  // Old saved scans adopt the lower no-website score without a database backfill.
  const prospects = ((readError ? [] : (data ?? [])) as Prospect[])
    .map((p) => ({
      ...p,
      opportunity_score:
        typeof p.signals?.has_website === "boolean"
          ? scoreSignals(p.signals)
          : p.opportunity_score,
    }));
  if (sortByPriority) {
    prospects.sort((a, b) => (b.opportunity_score ?? -1) - (a.opportunity_score ?? -1));
  }

  // Rank the full saved candidate pool, not only the 60 shown in the current
  // category/filter view. Fail closed when the dataset exceeds this page's
  // bounded read so rankings never masquerade as exhaustive.
  const { data: shortlistData, count: shortlistCount, error: shortlistError } = await supabase
    .from("prospects")
    .select(
      "id, source_ref, business_name, category, address, phone, website, signals, opportunity_score, outreach_draft, outreach_status, status, scanned_at",
      { count: "exact" },
    )
    .eq("status", "new")
    .limit(1000);
  const shortlistReady = !shortlistError && shortlistData &&
    shortlistData.length < 1000 && typeof shortlistCount === "number" && shortlistCount < 1000;
  // The migration may not be applied yet in production. Fail visibly and
  // preserve the working 12-business scanner rather than blocking the page.
  const { data: deepRows, error: deepError } = await supabase.from("deep_scan_jobs")
    .select("id, area_label, status, requested, position, created_count, refreshed_count, held_count, conflict_count, candidates, last_error, lease_until, created_at")
    .order("created_at", { ascending: false }).limit(8);
  const deepScans = (deepError ? [] : (deepRows ?? [])) as DeepScanPreview[];
  const challengerGroups = shortlistReady ? buildChallengerShortlists(
    (shortlistData as SavedChallenger[]).map(p => ({
      ...p,
      opportunity_score:
        typeof p.signals?.has_website === "boolean"
          ? scoreSignals(p.signals as WebsiteSignals)
          : p.opportunity_score,
    })),
    3,
  ).filter(group => group.top.length > 0) : [];

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

      <section className="card scanner-controls" aria-label="Run a scan">
        <h3>Run a scan</h3>
        <form action={runScan} className="form-grid">
          <label>
            Location
            <input name="location" defaultValue="Puyallup, WA" required />
          </label>
          <label>
            Radius
            <select name="radius_mi" defaultValue="10">
              <option value="5">5 miles</option>
              <option value="10">10 miles</option>
              <option value="15">15 miles</option>
              <option value="25">25 miles</option>
            </select>
          </label>
          <fieldset>
            <legend>Business types</legend>
            <div className="check-grid">
              {(Object.keys(NICHES) as Array<keyof typeof NICHES>).map(
                (key) => (
                  <label key={key} className="check">
                    <input
                      type="checkbox"
                      name="niches"
                      value={key}
                      defaultChecked={[
                        "restaurants",
                        "bars",
                        "salons",
                      ].includes(key)}
                    />
                    {NICHES[key].label}
                  </label>
                ),
              )}
            </div>
          </fieldset>
          <ScannerSubmitButton />
          <div className="scanner-deep-setup">
            <label>
              Deep scan size
              <select name="deep_size" defaultValue="50">
                <option value="12">12 · Quick</option>
                <option value="25">25 · Small</option>
                <option value="50">50 · Standard</option>
                <option value="100">100 · Extended</option>
              </select>
            </label>
            <button className="mini-button scanner-deep-create" type="submit" formAction={createDeepScan} disabled={!!deepError}>
              Create resumable deep scan
            </button>
            <p className="management-help">
              Deep Scan saves a discovery queue, then checks six businesses per
              step. Progress is kept between visits; processing requires your
              next action, not an invisible background job.
            </p>
          </div>
          <p className="form-hint">
            Reviews the most promising listings from up to 72 directory results,
            compares their contact reliability and redesign opportunity with saved
            businesses in the same category, and saves only qualified prospects
            (up to 12 per scan). Your contacted and promoted leads are protected.
            Business data via{" "}
            <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Powered by Geoapify</a>
            {" "}and{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
            {" "}(ODbL). Scans are on-demand, not continuous.
          </p>
        </form>
      </section>

      <section className="scanner-deep-jobs" aria-label="Resumable deep scan jobs">
        <div className="section-head">
          <h3>Deep Scan progress</h3>
          <span className="muted">Six verified website/social checks per batch</span>
        </div>
        {deepError ? (
          <p className="management-notice" role="status">
            Deep Scan is not configured here yet. The database migration must
            pass security review before this feature can be used.
          </p>
        ) : deepScans.length === 0 ? (
          <p className="management-help">No deep scans yet. Choose a size above and create your first saved queue.</p>
        ) : (
          <div className="scanner-deep-job-list">
            {deepScans.map(job => {
              const total = Array.isArray(job.candidates) ? job.candidates.length : 0;
              const processed = Math.min(total, Math.max(0, job.position));
              const expired = job.lease_until ? new Date(job.lease_until).getTime() < Date.now() : false;
              const canRun = job.status === "ready" || (job.status === "running" && expired);
              return (
                <article key={job.id} className="scanner-deep-job">
                  <div className="scanner-deep-job-top">
                    <div>
                      <strong>{job.area_label}</strong>
                      <p className="management-help">
                        {job.status} · {total} candidates found of {job.requested} requested
                      </p>
                    </div>
                    <span className="scanner-deep-job-count">{processed}/{total}</span>
                  </div>
                  <div className="scanner-deep-progress" role="progressbar"
                    aria-label={`Processed businesses in ${job.area_label}`}
                    aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={processed}>
                    <span style={{ width: `${total ? Math.round(processed / total * 100) : 0}%` }} />
                  </div>
                  <p className="management-help">
                    {job.created_count} new · {job.refreshed_count} refreshed ·
                    {job.held_count} held · {job.conflict_count} conflicts
                  </p>
                  {job.last_error && <p className="management-notice">{job.last_error}</p>}
                  <div className="scanner-deep-actions">
                    {canRun && (
                      <form action={processDeepScanBatch}>
                        <input type="hidden" name="job_id" value={job.id} />
                        <button className="mini-button" type="submit">
                          {job.status === "running" ? "Retry expired batch" : "Process next six"}
                        </button>
                      </form>
                    )}
                    {job.status === "ready" && (
                      <form action={changeDeepScanStatus}>
                        <input type="hidden" name="job_id" value={job.id} />
                        <input type="hidden" name="operation" value="pause" />
                        <button className="mini-button" type="submit">Pause</button>
                      </form>
                    )}
                    {job.status === "paused" && (
                      <form action={changeDeepScanStatus}>
                        <input type="hidden" name="job_id" value={job.id} />
                        <input type="hidden" name="operation" value="resume" />
                        <button className="mini-button" type="submit">Resume</button>
                      </form>
                    )}
                    {["ready", "paused"].includes(job.status) && (
                      <form action={changeDeepScanStatus}>
                        <input type="hidden" name="job_id" value={job.id} />
                        <input type="hidden" name="operation" value="cancel" />
                        <button className="mini-button" type="submit">Cancel</button>
                      </form>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="scanner-challenger-board" aria-label="Qualified category challengers">
        <div className="section-head">
          <h3>Best-fit shortlist</h3>
          <span className="muted">Evidence first · newest scans can challenge previous prospects</span>
        </div>
        <p className="management-help">
          Ranked from saved, uncontacted prospects in each category using public
          contact evidence (70%) and website opportunity (30%).
          This is not a verified sales lead or a guarantee of conversion.
          Existing contacted and promoted leads stay protected.
        </p>
        {!shortlistReady ? (
          <p className="management-notice" role="status">
            The full saved-prospect shortlist is unavailable or exceeds the
            current review limit. No incomplete rankings are displayed.
          </p>
        ) : challengerGroups.length === 0 ? (
          <p className="management-help">
            No contactable, qualified challengers yet. The scanner will hold back
            low-confidence listings instead of filling this section with guesses.
          </p>
        ) : (
          <div className="scanner-challenger-columns">
            {challengerGroups.map(group => (
              <div key={group.category} className="scanner-challenger-column">
                <div className="scanner-challenger-heading">
                  <h4>{NICHES[group.category].label}</h4>
                  <small>{group.qualified} qualified from {group.considered} saved candidates</small>
                </div>
                <ol className="scanner-challenger-rows">
                  {group.top.map(candidate => (
                    <li key={candidate.id} className="scanner-challenger-row">
                      <span className="scanner-challenger-rank" aria-label={`Rank ${candidate.rank}`}>
                        {String(candidate.rank).padStart(2, "0")}
                      </span>
                      <div className="scanner-challenger-copy">
                        <strong>{candidate.business_name}</strong>
                        <small>
                          Reliability {candidate.reliability} · Opportunity {candidate.opportunity}
                          {candidate.has_phone ? " · Phone listed" : ""}
                          {candidate.has_reachable_site ? " · Site reachable" : ""}
                          {candidate.has_matched_social ? " · Social matched" : ""}
                        </small>
                      </div>
                      <span className="scanner-challenger-quality" aria-label={`Combined fit ${candidate.quality} of 100`}>
                        {candidate.quality}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Prospects">
        <div className="section-head">
          <h3>
            Prospects{" "}
            <span className="count">{readError ? "—" : prospects.length}</span>
          </h3>
          <a
            className="mini-button"
            href={viewPath({ show: showArchived ? "" : "archived" })}
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </a>
        </div>

        <p className="management-help">
          Showing up to 60 saved prospects. {sortByPriority ? "Highest opportunity first." : "Newest scans first."}
          Scanned businesses are saved here as prospects. Use “→ Lead” to add one to Lead Intelligence.
        </p>
        <div className="row" aria-label="Sort scanned prospects">
          <a className="mini-button" aria-current={!sortByPriority ? "page" : undefined} href={viewPath({ sort: "recent" })}>Newest scans</a>
          <a className="mini-button" aria-current={sortByPriority ? "page" : undefined} href={viewPath({ sort: "priority" })}>Highest opportunity</a>
        </div>
        <div className="row" aria-label="Filter scanned prospects by category">
          <a className="mini-button" aria-current={categoryFilter === "all" ? "page" : undefined} href={viewPath({ category: "all" })}>All types</a>
          <a className="mini-button" aria-current={categoryFilter === "bars" ? "page" : undefined} href={viewPath({ category: "bars" })}>Bars & pubs</a>
          <a className="mini-button" aria-current={categoryFilter === "salons" ? "page" : undefined} href={viewPath({ category: "salons" })}>Salons</a>
          <a className="mini-button" aria-current={categoryFilter === "restaurants" ? "page" : undefined} href={viewPath({ category: "restaurants" })}>Restaurants</a>
        </div>
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

                {p.signals?.curation && (
                  <p className="management-help" aria-label="Prospect selection evidence">
                    Selected · Reliability {p.signals.curation.reliability}/100 ·
                    Opportunity {p.signals.curation.opportunity}/100 ·
                    Compared with {p.signals.curation.compared_to} in this business category.
                    Review contact details before outreach.
                  </p>
                )}
                {p.signals?.industry_audit && (
                  <details className="draft-details">
                    <summary>{p.signals.industry_audit.category.replace("_", " ")} homepage check</summary>
                    <p className="management-help">
                      Homepage observations only. An item not seen here may exist elsewhere on this website.
                    </p>
                    <ul className="scanner-audit-findings">
                      {p.signals.industry_audit.signals.map((item) => (
                        <li key={item.key}>
                          <strong>{item.status === "observed" ? "✓" : "?"} {item.label}</strong>
                          <small>{item.evidence}</small>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
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
