import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { ScannerSubmitButton } from "@/components/leads/ScannerSubmitButton";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";
import { buildChallengerShortlists, parseShortlistDepth, SHORTLIST_DEPTHS, type SavedChallenger } from "@/lib/prospect-shortlists";
import { deepScanPercent, expiredDeepLease } from "@/lib/deep-scan";
import { createDeepScan, processDeepScanBatch, changeDeepScanStatus } from "./deep-actions";
import { safeIndustryEvidenceUrl } from "@/lib/prospect-industry-audit";
import { buildProspectInsights } from "@/lib/prospect-insights";
import { safeVerificationLink } from "@/lib/prospect-verification";
import { compareSavedTerritories } from "@/lib/prospect-territories";
import { suggestNhsOffers } from "@/lib/prospect-offer-fit";
import { buildScannerOutcomeSnapshot, type ScannerOutcomeProspect, type ScannerOutcomeLead, type ScannerProjectEvent } from "@/lib/prospect-conversion";
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
  searchParams: Promise<{ msg?: string; show?: string; sort?: string; category?: string; shortlist?: string;
    scan_location?: string; scan_radius?: string; scan_niches?: string | string[] }>;
}) {
  const { msg, show, sort, category, shortlist, scan_location, scan_radius, scan_niches } = await searchParams;
  // These parameters only prefill the form. The owner must still press Scan.
  const selectedLocation = scan_location && scan_location.trim().length >= 2 && scan_location.length <= 160
    ? scan_location.trim() : "Puyallup, WA";
  const selectedRadius = scan_radius && /^\d{1,2}$/.test(scan_radius) &&
    Number(scan_radius) >= 1 && Number(scan_radius) <= 50 ? String(Number(scan_radius)) : "10";
  const replayNiches = (Array.isArray(scan_niches) ? scan_niches : scan_niches ? [scan_niches] : [])
    .filter((name): name is keyof typeof NICHES => Object.hasOwn(NICHES, name));
  const selectedNiches = replayNiches.length ? replayNiches : ["restaurants", "bars", "salons"];
  await requireAdmin();
  const supabase = await createClient();
  const showArchived = show === "archived";
  const sortByPriority = sort === "priority";
  const shortlistDepth = parseShortlistDepth(shortlist);
  const categoryFilter: CategoryFilter = category && Object.prototype.hasOwnProperty.call(CATEGORY_FILTERS, category)
    ? category as CategoryFilter : "all";
  // Keep sort and filters when switching between views, without copying arbitrary query parameters.
  const viewPath = (changes: { show?: string; sort?: string; category?: string; shortlist?: string } = {}) => {
    const queryParams = new URLSearchParams();
    if ((changes.show ?? (showArchived ? "archived" : "")) === "archived") queryParams.set("show", "archived");
    if ((changes.sort ?? (sortByPriority ? "priority" : "recent")) === "priority") queryParams.set("sort", "priority");
    const type = changes.category ?? categoryFilter;
    if (type !== "all") queryParams.set("category", type);
    const depth = parseShortlistDepth(changes.shortlist ?? shortlist);
    if (depth !== 3) queryParams.set("shortlist", String(depth));
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
  // Conversions are linked to actual scanner-created Lead Intelligence rows,
  // not inferred from listing counts or matching business names.
  const [allProspectRows, outcomeLeadRows, projectEventRows] = await Promise.all([
    supabase.from("prospects")
      .select("id, source_ref, category, status, outreach_status, lead_id", { count: "exact" })
      .limit(1000),
    supabase.from("leads")
      .select("id, status, last_reply_at, consultation_at, metadata", { count: "exact" })
      .limit(1000),
    supabase.from("activities")
      .select("lead_id, project_id, event_type", { count: "exact" })
      .eq("event_type", "project_created")
      .limit(1000),
  ]);
  const outcomeReady = [allProspectRows, outcomeLeadRows, projectEventRows].every(q =>
    !q.error && q.data && q.data.length < 1000 && typeof q.count === "number" && q.count < 1000
  );
  const outcomeSnapshot = outcomeReady
    ? buildScannerOutcomeSnapshot(
        allProspectRows.data as ScannerOutcomeProspect[],
        outcomeLeadRows.data as ScannerOutcomeLead[],
        projectEventRows.data as ScannerProjectEvent[],
      )
    : null;
  const territoryComparison = shortlistReady ? compareSavedTerritories(shortlistData as SavedChallenger[]) : null;
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
    shortlistDepth,
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

      <section id="scan-controls" className="card scanner-controls" aria-label="Run a scan">
        <h3>Run a scan</h3>
        <form action={runScan} className="form-grid">
          <label>
            Location
            <input name="location" defaultValue={selectedLocation} maxLength={160} required />
          </label>
          <label>
            Radius
            <select name="radius_mi" defaultValue={selectedRadius}>
              {!["5", "10", "15", "25"].includes(selectedRadius) && (
                <option value={selectedRadius}>{selectedRadius} miles</option>
              )}
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
                      defaultChecked={selectedNiches.includes(key)}
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
            (up to 12 per scan). Existing clients, leads, and contacted prospects
            are protected. Possible duplicate identities are withheld from saving
            and reported for manual review; no records are merged automatically.
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
          <span className="muted">Six website/social checks per batch</span>
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
              const expired = expiredDeepLease(job.status, job.lease_until, Date.now());
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
                    <span style={{ width: `${deepScanPercent(processed, total)}%` }} />
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

      <section id="qualified-shortlists" className="scanner-challenger-board" aria-label="Qualified category challengers">
        <div className="section-head">
          <h3>Best-fit shortlist</h3>
          <span className="muted">Evidence first · newest scans can challenge previous prospects</span>
        </div>
        <nav className="scanner-shortlist-depth" aria-label="Best-fit shortlist length">
          <span>Show top</span>
          {SHORTLIST_DEPTHS.map(depth => (
            <Link key={depth} href={viewPath({ shortlist: String(depth) }) + "#qualified-shortlists"}
              className="scanner-shortlist-depth-link"
              aria-current={depth === shortlistDepth ? "page" : undefined}>
              {depth}
            </Link>
          ))}
          <span>per category · {shortlistDepth === 3 ? "focused view" : "expanded view"}</span>
        </nav>
        <p className="management-help">
          Ranked from saved, uncontacted prospects in each category using public
          contact evidence (70%) and website opportunity (30%).
          The selected depth changes only how many results are displayed, not
          which businesses are saved or automatically contacted.
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

      <section className="scanner-territory-report" aria-label="Territory comparison from saved prospects">
        <div className="section-head">
          <h3>Territory study</h3>
          <span className="muted">Your saved prospect sample · not market coverage</span>
        </div>
        <p className="management-help">
          Compare the last search area and radius recorded on each saved prospect.
          Qualified means a contactable, uncontacted listing with enough supporting
          evidence. A searched city is not proof of the business&apos;s exact location.
          Repeat scans require your click and use the existing duplicate safeguards.
        </p>
        {!shortlistReady || !territoryComparison ? (
          <p role="status" className="management-notice">
            The complete saved prospect sample is not available. Territory comparisons are hidden rather than estimated from an incomplete page.
          </p>
        ) : territoryComparison.areas.length === 0 ? (
          <p className="management-help">
            No prospects with a recorded scan area yet. New saved scans will start building a territory comparison.
          </p>
        ) : (
          <div className="scanner-territory-list">
            {territoryComparison.areas.map((area) => {
              const params = new URLSearchParams();
              params.set("scan_location", area.location);
              params.set("scan_radius", String(area.radius_mi));
              for (const niche of area.niches) params.append("scan_niches", niche);
              return (
                <article className="scanner-territory-row" key={area.location.toLowerCase() + ":" + area.radius_mi}>
                  <div className="scanner-territory-head">
                    <div>
                      <strong>{area.area_label}</strong>
                      <small>{area.radius_mi}-mile search radius · last observed {area.latest_checked_at.slice(0, 10)}</small>
                    </div>
                    <div className="scanner-territory-count">
                      <strong>{area.qualified}<span> / {area.saved}</span></strong>
                      <small>qualified / saved</small>
                    </div>
                  </div>
                  <div className="scanner-territory-track" role="img"
                    aria-label={area.qualified + " of " + area.saved + " saved prospects qualified"}>
                    <span style={{ width: (area.saved ? Math.round(area.qualified / area.saved * 100) : 0) + "%" }} />
                  </div>
                  <div className="scanner-territory-foot">
                    <span>Avg fit: {area.average_quality === null ? "—" : area.average_quality + "/100"}</span>
                    <span>{area.top_categories.length
                      ? area.top_categories.map(group => NICHES[group.category].label + " " + group.count).join(" · ")
                      : "No qualified prospects yet"}</span>
                    <a href={"/leads/discover?" + params.toString() + "#scan-controls"}>Prefill repeat scan ↗</a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {territoryComparison && territoryComparison.without_context > 0 && (
          <p className="management-help">
            {territoryComparison.without_context} older saved prospects have no reliable search-area context and are excluded from the comparison.
            These rankings reflect only saved prospects, not all businesses in a city.
          </p>
        )}
      </section>

      <section className="scanner-outcome-study" aria-label="Recorded scanner outreach outcomes">
        <div className="section-head">
          <h3>What happened next</h3>
          <span className="muted">Recorded outcomes only · no invented conversions</span>
        </div>
        <p className="management-help">
          From saved scanner prospects and strictly linked Lead Intelligence records.
          Marked sent is a manual status, not verified delivery. Consultations are
          scheduled, not necessarily attended. A created project is not recorded revenue.
          ROI and true win/loss rates require actual commercial outcome data.
        </p>
        {!outcomeSnapshot ? (
          <p className="management-notice" role="status">
            Complete conversion records are unavailable or exceed the review limit.
            No partial or estimated conversion figures are displayed.
          </p>
        ) : (
          <>
            <div className="scanner-conversion-metrics" role="list" aria-label="Scanner outcome counts">
              {[
                { label: "Saved records", value: outcomeSnapshot.totals.saved_records },
                { label: "Marked sent", value: outcomeSnapshot.totals.marked_sent },
                { label: "Replies recorded", value: outcomeSnapshot.totals.replies_recorded },
                { label: "Consultations booked", value: outcomeSnapshot.totals.consultations_scheduled },
                { label: "Projects created", value: outcomeSnapshot.totals.projects_created },
              ].map(metric => (
                <div role="listitem" key={metric.label}>
                  <strong>{metric.value}</strong>
                  <small>{metric.label}</small>
                </div>
              ))}
            </div>
            <details className="draft-details scanner-outcome-detail">
              <summary>Compare recorded outcomes by business category</summary>
              {outcomeSnapshot.categories.length === 0 ? (
                <p className="management-help">
                  No scanner prospects have been saved in this dataset.
                </p>
              ) : (
                <div className="scanner-outcome-rows">
                  {outcomeSnapshot.categories.map(group => (
                    <div key={group.category} className="scanner-outcome-row">
                      <strong>{group.category === "other" ? "Uncategorized" : NICHES[group.category].label}</strong>
                      <small>{group.saved_records} saved · {group.marked_sent} marked sent · {group.replies_recorded} replies · {group.consultations_scheduled} consultations · {group.projects_created} projects</small>
                    </div>
                  ))}
                </div>
              )}
            </details>
            {outcomeSnapshot.unmatched_promotions > 0 && (
              <p className="management-help">
                {outcomeSnapshot.unmatched_promotions} promoted record(s) could not be
                linked conclusively to scanner-origin leads and are excluded from outcomes.
              </p>
            )}
            <p className="management-help">
              {outcomeSnapshot.totals.declined} linked leads marked not interested.
              This is a workflow snapshot, not a sales conversion rate or claim of causation.
            </p>
          </>
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
            const insights = buildProspectInsights(p.signals, p.website, 3);
            const suggestedOffers = suggestNhsOffers(p.category, p.website, p.signals, 2);
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
                {p.signals?.verification && (
                  <details className="draft-details" aria-label={`Business verification for ${p.business_name}`}>
                    <summary>
                      Identity evidence · {p.signals.verification.status === "corroborated"
                        ? "Public profile corroborated"
                        : p.signals.verification.status === "needs_review"
                          ? "Manual review needed" : "Directory listing only"}
                    </summary>
                    <p className="management-help">
                      Source history · checked {p.signals.verification.checked_at.slice(0, 10)}.
                      Public signals do not establish legal ownership, current phone service,
                      or authorization to contact.
                    </p>
                    <ul className="scanner-audit-findings">
                      {p.signals.verification.evidence.map((item) => {
                        const verifiedLink = safeVerificationLink(item);
                        return (
                          <li key={item.key}>
                            <strong>
                              {item.status === "corroborated" ? "✓" : item.status === "unconfirmed" ? "?" : "·"}
                              {" "}{item.label}
                            </strong>
                            <small>{item.detail}</small>
                            <small>{item.source} · {item.status.replace("_", " ")} · {item.observed_at.slice(0, 10)}</small>
                            {verifiedLink && (
                              <a href={verifiedLink} target="_blank" rel="noopener noreferrer">
                                View public evidence ↗
                              </a>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
                {p.signals?.scan_memory && p.signals.scan_memory.events.length > 0 && (
                  <details className="draft-details" aria-label={`Scan history for ${p.business_name}`}>
                    <summary>Evidence history · {p.signals.scan_memory.events.length} recorded changes</summary>
                    <p className="management-help">
                      Recent directory, website or social observations. A changed signal
                      is not proof of a closed business or removed service.
                    </p>
                    <ul className="scanner-audit-findings">
                      {[...p.signals.scan_memory.events].reverse().slice(0, 6).map((event, index) => (
                        <li key={`${event.at}-${event.key}-${index}`}>
                          <strong>{event.kind === "new_evidence" ? "✓" : "?"} {event.description}</strong>
                          <small>{event.source} · {event.at.slice(0, 10)} · {event.kind === "new_evidence" ? "New supporting observation" : "Review suggested"}</small>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {p.signals?.industry_audit && (
                  <details className="draft-details">
                    <summary>{p.signals.industry_audit.category.replace("_", " ")} website evidence</summary>
                    <p className="management-help">
                      Homepage-only audit · v{p.signals.industry_audit.version} ·{" "}
                      {new Date(p.signals.industry_audit.scanned_at).toLocaleDateString("en-US", { timeZone: "UTC" })}.
                      Not detected does not mean missing from the full site.
                      A viewport tag is not a mobile usability test.
                    </p>
                    <ul className="scanner-audit-findings">
                      {p.signals.industry_audit.signals.map((item) => {
                        const evidenceUrl = safeIndustryEvidenceUrl(p.website, item.evidence_url);
                        return (
                          <li key={item.key}>
                            <strong>{item.status === "observed" ? "✓" : "?"} {item.label}</strong>
                            <small>{item.evidence}</small>
                            {evidenceUrl && (
                              <a href={evidenceUrl} target="_blank" rel="noopener noreferrer">
                                Review homepage evidence ↗
                              </a>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
                <details className="draft-details" aria-label={"NHS service fit for " + p.business_name}>
                  <summary>Possible NHS service fit · {suggestedOffers[0].title}</summary>
                  <p className="management-help">
                    Suggestions for your own review, not a verified need or an automatic proposal.
                    Open the business site before deciding which offer belongs in an outreach draft.
                  </p>
                  <ul className="scanner-audit-findings">
                    {suggestedOffers.map(offer => (
                      <li key={offer.key}>
                        <strong>{offer.title} · {offer.kind}</strong>
                        <small>{offer.reason}</small>
                        <small>{offer.basis === "homepage_review"
                          ? "Based on a partial homepage observation"
                          : "Discovery only · manual business consultation advised"}</small>
                      </li>
                    ))}
                  </ul>
                  <p className="management-help">
                    Draft outreach is prepared only when you choose it. Nothing is sent automatically.
                  </p>
                </details>
                <details className="draft-details" aria-label={`Prospect insights for ${p.business_name}`}>
                  <summary>Why review this business? · Evidence-based insights</summary>
                  <p className="management-help">
                    Observations from available public listings and the fetched homepage.
                    These are review questions, not confirmed defects or promises of sales.
                  </p>
                  <ul className="scanner-audit-findings">
                    {insights.map((insight) => (
                      <li key={insight.key}>
                        <strong>{insight.kind === "review" ? "?" : insight.kind === "observed" ? "✓" : "·"} {insight.title}</strong>
                        <small>{insight.detail}</small>
                        <small>{insight.basis === "homepage" ? "Homepage evidence" : insight.basis === "directory" ? "Directory evidence" : "Unverified"}
                          {insight.checked_at ? ` · ${insight.checked_at.slice(0, 10)}` : ""}
                        </small>
                        {insight.evidence_url && (
                          <a href={insight.evidence_url} target="_blank" rel="noopener noreferrer">
                            Open supporting page ↗
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
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
                  {p.status === "new" && p.outreach_status !== "sent" && (
                    <form action={generateDraft.bind(null, p.id)}>
                      <button type="submit" className="mini-button">
                        {p.outreach_draft ? "Regenerate draft" : "Draft outreach"}
                      </button>
                    </form>
                  )}
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
