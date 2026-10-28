import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ScannerSubmitButton } from "@/components/leads/ScannerSubmitButton";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";
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
