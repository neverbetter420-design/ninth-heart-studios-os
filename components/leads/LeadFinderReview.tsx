import Link from "next/link";
import { NICHES, normalizeSocialProfile, type NicheKey } from "@/lib/prospect-scan";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";
import {
  importLeadSearchResult, queueLeadSearch, retryLeadSearch,
} from "@/app/(protected)/(admin)/leads/discover/lead-finder-actions";

export type FinderSearch = {
  id: string;
  source: string;
  location: string;
  industry: string;
  status: string;
  result_count: number;
  imported_count: number;
  auto_import: boolean;
  error_message: string | null;
  created_at: string;
};
export type FinderResult = {
  id: string;
  business_name: string;
  source_ref: string;
  industry: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  maps_url: string | null;
  source: string;
  discovery_score: number;
  duplicate: boolean;
  imported: boolean;
  import_status: string;
  details: { social_profiles?: Array<{ platform: string; url: string; status: string }> } | null;
};

export function LeadFinderReview({
  searches, results, selectedId, schemaReady, geoapifyConnected,
}: {
  searches: FinderSearch[];
  results: FinderResult[];
  selectedId?: string;
  schemaReady: boolean;
  geoapifyConnected: boolean;
}) {
  const selected = searches.find(s => s.id === selectedId) ?? searches[0] ?? null;
  return (
    <section className="nhs-finder" aria-label="Softr-style Lead Finder">
      <div className="nhs-finder-title">
        <div>
          <p className="eyebrow">Discover · Review · Import</p>
          <h3>Find your next opportunity.</h3>
          <p>Search local businesses, inspect results, and decide exactly which leads enter your pipeline.</p>
        </div>
        <span className="nhs-finder-quiet">Built from your original Softr workflow</span>
      </div>
      {!schemaReady && (
        <p className="management-notice" role="status">
          Lead Finder 2.0 needs its new admin-only search tables before it can run. This preview has not
          changed the live database.
        </p>
      )}
      <form action={queueLeadSearch} className="nhs-finder-form">
        <div className="nhs-finder-fields">
          <label>Data source
            <select name="source" defaultValue={geoapifyConnected ? "geoapify" : "openstreetmap"}>
              <option value="openstreetmap">OpenStreetMap · Free, best effort</option>
              <option value="geoapify" disabled={!geoapifyConnected}>
                {geoapifyConnected ? "Geoapify · Connected" : "Geoapify · API key required"}
              </option>
            </select>
          </label>
          <label>City and state
            <input name="location" defaultValue="Puyallup, WA" maxLength={200} required/>
          </label>
          <label>Search radius
            <select name="radius_mi" defaultValue="10">
              <option value="5">5 miles</option>
              <option value="10">10 miles</option>
              <option value="15">15 miles</option>
              <option value="25">25 miles</option>
            </select>
          </label>
          <label>Results to review
            <select name="result_limit" defaultValue="20">
              <option value="5">5 results</option>
              <option value="10">10 results</option>
              <option value="15">15 results</option>
              <option value="20">20 results</option>
            </select>
          </label>
          <label>Top leads to store
            <select name="top_count" defaultValue="5">
              <option value="3">3 leads</option>
              <option value="5">5 leads</option>
              <option value="10">10 leads</option>
            </select>
          </label>
        </div>
        <fieldset className="nhs-finder-niches">
          <legend>Business types</legend>
          <div className="check-grid">
            {(Object.keys(NICHES) as NicheKey[]).map((key) => (
              <label className="check" key={key}>
                <input name="niches" type="checkbox" value={key}
                  defaultChecked={["restaurants", "bars", "salons"].includes(key)} />
                {NICHES[key].label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="nhs-finder-optin">
          <input name="auto_import" type="checkbox"/>
          <span><strong>Automatically store top leads</strong>
            <small>Optional. Only non-duplicate businesses with a listed website are eligible. Defaults off.</small>
          </span>
        </label>
        <div className="nhs-finder-cta">
          <PortalSubmitButton className="primary-button" pendingLabel="Finding businesses…">
            Find leads
          </PortalSubmitButton>
          <p className="form-hint">Results appear in a separate review area. No automated outreach or recurring scans.
            Social profiles require identity verification. Free Overpass services can be unavailable.</p>
        </div>
      </form>

      <div className="nhs-finder-workspace">
        <aside className="nhs-finder-history" aria-label="Recent searches">
          <h3>Recent searches</h3>
          {!searches.length && <p className="muted">Your search history will appear here.</p>}
          {searches.map(s => (
            <div className={"nhs-finder-history-entry " + (selected?.id === s.id ? "is-current" : "")} key={s.id}>
              <Link href={"/leads/discover?search=" + encodeURIComponent(s.id) + "#search-results"}>
                <strong>{s.location}</strong>
                <span>{s.industry}</span>
              </Link>
              <div className="nhs-finder-status">
                <span data-status={s.status}>{s.status}</span>
                <small>{s.source === "geoapify" ? "Geoapify" : "OpenStreetMap"}</small>
              </div>
              {s.status === "complete" && <small>{s.result_count} results · {s.imported_count} imported</small>}
              {s.error_message && <p className="nhs-finder-error">{s.error_message}</p>}
              {(s.status === "error" || s.status === "queued") && (
                <form action={retryLeadSearch.bind(null, s.id)}>
                  <PortalSubmitButton className="mini-button" pendingLabel="Retrying…">Retry search</PortalSubmitButton>
                </form>
              )}
            </div>
          ))}
        </aside>
        <div className="nhs-finder-results" id="search-results">
          <div className="nhs-finder-results-heading">
            <h3>Search results <span>{selected ? "(" + results.length + ")" : ""}</span></h3>
            {selected && <small>{selected.location} · {selected.status}</small>}
          </div>
          {!selected && <p className="empty-state">Choose a source and location to discover your first businesses.</p>}
          {selected && !results.length && <p className="empty-state">
            {selected.status === "error" ? "This search couldn't finish. Review the error in recent searches." :
              selected.status === "searching" ? "Search is running. Refresh shortly." :
              "No business results stored for this search."}
          </p>}
          {results.map(r => (
            <article className="nhs-finder-result" key={r.id}>
              <div className="nhs-finder-result-head">
                <div>
                  <h4>{r.business_name}</h4>
                  <p className="muted">{r.industry || "Local business"} · {r.source}</p>
                </div>
                <span className="nhs-finder-score" title="Contact completeness, not sales potential">{r.discovery_score}/100 <small>Details</small></span>
              </div>
              <div className="nhs-finder-tags">
                <span>{r.imported ? "Imported" : r.duplicate ? "Duplicate" :
                  r.import_status === "ready" ? "Ready to review" :
                  r.import_status === "importing" ? "Import pending" : "Needs verification"}</span>
                <span>{r.website ? "Website listed" : "Website not confirmed"}</span>
              </div>
              <div className="nhs-finder-result-meta">
                {r.address && <span>⌖ {r.address}</span>}
                {r.phone && <span>☎ {r.phone}</span>}
                {r.email && <span>✉ {r.email}</span>}
              </div>
              {r.details?.social_profiles?.length ? (
                <div className="nhs-finder-social" aria-label="Listed social profiles">
                  {r.details.social_profiles.map((p, i) => {
                    const url = p.platform === "instagram" || p.platform === "facebook"
                      ? normalizeSocialProfile(p.url, p.platform) : null;
                    return url && <a key={i} href={url} target="_blank" rel="noreferrer">
                      {p.platform} ↗ <small>{p.status === "matched" ? "Details match" : "Verify profile"}</small>
                    </a>;
                  })}
                </div>
              ) : null}
              <div className="nhs-finder-result-links">
                {r.website && <a href={r.website} target="_blank" rel="noreferrer">Website ↗</a>}
                {r.maps_url && <a href={r.maps_url} target="_blank" rel="noreferrer">Map ↗</a>}
                {r.imported ? <span>✓ In Leads</span> :
                  r.import_status === "ready" && !r.duplicate && r.website ? (
                    <form action={importLeadSearchResult.bind(null, r.id)}>
                      <PortalSubmitButton className="mini-button accent" pendingLabel="Importing…">
                        + Import lead
                      </PortalSubmitButton>
                    </form>
                  ) : <span className="muted">Review before importing</span>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
