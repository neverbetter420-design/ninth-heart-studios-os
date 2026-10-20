import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isEmailConfigured } from "@/lib/email";
import { DocumentSectionHeading } from "@/components/documents/DocumentChrome";

export default async function SettingsPage() {
  const { profile } = await requireAdmin();
  const supabase = await createClient();
  const { error: dbError } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });
  const emailConfigured = isEmailConfigured();
  const services = [
    {
      name: "Studio database",
      status: dbError ? "Read check unavailable" : "Read check passed",
      detail: dbError
        ? "The profile read could not be completed. Refresh to try again."
        : "The signed-in account can read the profile table. This is a database read check.",
      state: dbError ? "unavailable" : "ready",
    },
    {
      name: "Gmail delivery",
      status: emailConfigured ? "Settings present" : "Not configured",
      detail: emailConfigured
        ? "Email settings are present. Delivery has not been tested here; each Muse send still requires a recipient and confirmation."
        : "Email settings are not available in this build. Muse can still generate and save drafts for you to copy.",
      state: emailConfigured ? "ready" : "pending",
    },
    {
      name: "Hosting & releases",
      status: "Manual release",
      detail:
        "Releases use a separate manual workflow. This page does not check the deployed build or change hosting settings.",
      state: "neutral",
    },
    {
      name: "Payments",
      status: "Separate setup",
      detail:
        "Payment setup is managed separately from these studio controls. No payment connection is tested here.",
      state: "neutral",
    },
  ];
  return (
    <div className="content-wrap management-page studio-page settings-workroom">
      <header className="page-header management-heading">
        <div>
          <p className="eyebrow">The studio, behind the scenes</p>
          <h2>
            Know what’s connected.
            <br />
            <em>Keep the reins.</em>
          </h2>
          <p className="page-description">
            Your studio identity, account and connection checks. This is a
            status view; changes happen in their dedicated setup.
          </p>
        </div>
        <Link href="/muse" className="management-text-link">
          Back to Muse ↗
        </Link>
      </header>
      <nav
        className="management-destinations"
        aria-label="Settings destinations"
      >
        <a href="#studio-identity">Studio & account</a>
        <a href="#studio-connections">Connections</a>
        <a href="#studio-controls">Controls</a>
      </nav>
      <div className="studio-settings-grid">
        <section id="studio-identity" aria-label="Studio">
          <DocumentSectionHeading
            eyebrow="The identity"
            title="Ninth Heart Studios"
          />
          <p className="studio-tagline">Unlock Potential. Build Impact.</p>
          <dl className="studio-account">
            <div>
              <dt>Signed in as</dt>
              <dd>{profile.email ?? profile.full_name ?? "Admin"}</dd>
            </div>
            <div>
              <dt>Account role</dt>
              <dd>{profile.role === "admin" ? "NHS Admin" : profile.role}</dd>
            </div>
          </dl>
          <Link href="/clients" className="management-text-link">
            Manage client portal access ↗
          </Link>
        </section>
        <section id="studio-connections" aria-label="Connections">
          <DocumentSectionHeading
            eyebrow="The current picture"
            title="Connection checks"
          />
          <ul className="studio-services">
            {services.map((s, i) => (
              <li key={s.name} className="studio-service" data-service={i}>
                <div className="studio-row-heading">
                  <h4>{s.name}</h4>
                  <span className="studio-status" data-state={s.state}>
                    {s.status}
                  </span>
                </div>
                <p>{s.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section
        id="studio-controls"
        aria-label="Controls"
        className="studio-controls"
      >
        <DocumentSectionHeading
          eyebrow="Deliberate by design"
          title="You choose when things move."
        />
        <div className="studio-control-grid">
          <article>
            <span className="studio-ordinal">01</span>
            <h4>Draft, then decide.</h4>
            <p>
              Generating and saving text in Muse keeps it in the studio. A Gmail
              send is a separate action with its own recipient and confirmation.
            </p>
            <Link href="/muse#muse-saved" className="management-text-link">
              Review saved drafts ↗
            </Link>
          </article>
          <article>
            <span className="studio-ordinal">02</span>
            <h4>Review the rules.</h4>
            <p>
              Open the automation rules and activity to review their current
              state before making changes.
            </p>
            <Link href="/automations" className="management-text-link">
              Open automations ↗
            </Link>
          </article>
          <article>
            <span className="studio-ordinal">03</span>
            <h4>Release with intent.</h4>
            <p>
              This page does not publish a build. Production releases follow the
              separate review and manual deployment process.
            </p>
            <Link href="/templates" className="management-text-link">
              Open studio templates ↗
            </Link>
          </article>
        </div>
      </section>
    </div>
  );
}
