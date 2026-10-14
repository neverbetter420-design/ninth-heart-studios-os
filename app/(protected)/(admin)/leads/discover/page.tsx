import { createClient } from "@/lib/supabase/server";
import { NICHES, signalBadges, type WebsiteSignals } from "@/lib/prospect-scan";
import {
  runScan,
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
  searchParams: Promise<{ msg?: string; show?: string }>;
}) {
  const { msg, show } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("prospects")
    .select(
      "id, business_name, category, address, phone, website, signals, opportunity_score, outreach_draft, outreach_status, status, scanned_at"
    )
    .order("opportunity_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(60);
  query = show === "archived" ? query.eq("status", "archived") : query.neq("status", "archived");
  const { data } = await query;

  const prospects = (data ?? []) as Prospect[];
  const showArchived = show === "archived";

  return (
    <div className="content-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow electric">Lead Scanner</p>
          <h2>Find them. Read their site. Reach out.</h2>
          <p className="page-description">
            Discovers local businesses by type and area, analyzes their websites for
            redesign signals, scores the opportunity, and drafts your outreach. Free data,
            no API keys, nothing sent without you.
          </p>
        </div>
      </header>

      {msg && <p className="notice">{decodeURIComponent(msg)}</p>}

      <section className="card" aria-label="Run a scan">
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
              {(Object.keys(NICHES) as Array<keyof typeof NICHES>).map((key) => (
                <label key={key} className="check">
                  <input
                    type="checkbox"
                    name="niches"
                    value={key}
                    defaultChecked={["restaurants", "bars", "salons"].includes(key)}
                  />
                  {NICHES[key].label}
                </label>
              ))}
            </div>
          </fieldset>
          <button type="submit" className="primary-button">
            Scan
          </button>
          <p className="form-hint">
            Up to 12 businesses per scan. Business data © OpenStreetMap
            contributors (ODbL). Be nice — scans are on-demand, not continuous.
          </p>
        </form>
      </section>

      <section aria-label="Prospects">
        <div className="section-head">
          <h3>
            Prospects <span className="count">{prospects.length}</span>
          </h3>
          <a
            className="mini-button"
            href={showArchived ? "/leads/discover" : "/leads/discover?show=archived"}
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </a>
        </div>

        {prospects.length === 0 && (
          <p className="empty-state">
            No prospects yet. Run a scan above and they&apos;ll land here, scored and
            ready.
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
                      {[p.category, p.address].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <span className={`score score-${scoreTone(p.opportunity_score)}`}>
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
                    <span>No website listed</span>
                  )}
                  {p.phone && <span> · {p.phone}</span>}
                  {p.status === "promoted" && <span> · ✓ In leads</span>}
                  {p.outreach_status === "sent" && <span> · ✉ Sent</span>}
                </div>

                <div className="prospect-actions">
                  <form action={analyzeProspect.bind(null, p.id)}>
                    <button type="submit" className="mini-button">Re-analyze</button>
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
                    <button type="submit" className="mini-button ghost">Archive</button>
                  </form>
                </div>

                {(p.outreach_draft || p.outreach_status !== "none") && (
                  <details className="draft-details">
                    <summary>
                      Outreach draft
                      {p.outreach_status === "sent" ? " (sent)" : ""}
                    </summary>
                    <form action={saveDraft.bind(null, p.id)} className="form-grid">
                      <textarea
                        name="outreach_draft"
                        defaultValue={p.outreach_draft ?? ""}
                        rows={10}
                      />
                      <div className="row">
                        <button type="submit" className="mini-button">Save draft</button>
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
