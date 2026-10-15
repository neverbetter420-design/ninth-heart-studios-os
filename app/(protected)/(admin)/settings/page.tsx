import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const { profile } = await requireAdmin();
  const supabase = await createClient();

  // Connection checks (presence only — never expose values).
  const gmailConfigured = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const { error: dbError } = await supabase.from("profiles").select("id", { count: "exact", head: true });

  const services = [
    {
      name: "Supabase (database + auth)",
      status: dbError ? "Error" : "Connected",
      detail: supabaseUrl ? supabaseUrl.replace("https://", "") : "URL not set",
      tone: dbError ? "danger" : "done",
    },
    {
      name: "Gmail (send email)",
      status: gmailConfigured ? "Configured" : "Not configured",
      detail: gmailConfigured
        ? "App password present — Muse drafts can send."
        : "Add GMAIL_USER + GMAIL_APP_PASSWORD to .env.local (see .env.example).",
      tone: gmailConfigured ? "done" : "progress",
    },
    {
      name: "Cloudflare (hosting)",
      status: "Deployed",
      detail: "app.ninthheartstudios.com — auto-deploy OFF, wrangler deploys only.",
      tone: "done",
    },
    {
      name: "Payments",
      status: "Not connected",
      detail: "Billing goes last. Square chosen for payments + billing.",
      tone: "progress",
    },
  ] as const;

  return (
    <div className="content-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow electric">System Settings</p>
          <h2>Control the machine.</h2>
          <p className="page-description">
            Studio identity, connection status, and the safeguards that keep
            automations from firing into the void.
          </p>
        </div>
      </header>

      <section className="panel" aria-label="Studio" style={{ marginBottom: 14 }}>
        <div className="panel-heading">
          <h3>Studio</h3>
        </div>
        <div style={{ padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
          <p style={{ margin: 0 }}><strong>Ninth Heart Studios</strong> — Unlock Potential. Build Impact.</p>
          <p style={{ margin: 0 }} className="muted-copy">
            Signed in as {profile.email ?? profile.full_name ?? "admin"} ({profile.role}).
          </p>
        </div>
      </section>

      <section className="panel" aria-label="Connections" style={{ marginBottom: 14 }}>
        <div className="panel-heading">
          <h3>Connections</h3>
        </div>
        <ul className="delivery-list">
          {services.map((s) => (
            <li key={s.name} className="delivery-row">
              <div className="delivery-row-main">
                <p className="delivery-row-title">{s.name}</p>
                <p className="delivery-row-sub">{s.detail}</p>
              </div>
              <span className={`delivery-pill ${s.tone}`}>{s.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-label="Safeguards">
        <div className="panel-heading">
          <h3>Safeguards — always on</h3>
        </div>
        <ul className="delivery-list">
          <li className="delivery-row"><p className="delivery-row-sub">Automations ship OFF. Nothing runs until you enable it.</p></li>
          <li className="delivery-row"><p className="delivery-row-sub">Muse drafts never send on their own — every send needs your per-send approval.</p></li>
          <li className="delivery-row"><p className="delivery-row-sub">Clients see only their own projects, files, and forms — enforced by database policy, not just UI.</p></li>
          <li className="delivery-row"><p className="delivery-row-sub">Production deploys are manual (wrangler). Git pushes never deploy on their own.</p></li>
        </ul>
        <div style={{ padding: "0 18px 18px", display: "flex", gap: 8 }}>
          <Link href="/automations" className="mini-button">Automations →</Link>
          <Link href="/templates" className="mini-button">Templates →</Link>
          <Link href="/forms" className="mini-button">Forms →</Link>
        </div>
      </section>
    </div>
  );
}
