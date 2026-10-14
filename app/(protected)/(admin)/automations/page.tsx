import { MetricCard } from "@/components/MetricCard";
import {
  markAllNotificationsRead,
  markNotificationRead,
  runAutomation,
  toggleAutomation,
} from "./actions";
import { createClient } from "@/lib/supabase/server";
import { isEmailConfigured } from "@/lib/email";
import type { Automation, AutomationRun, Notification } from "@/lib/supabase/types";

const KIND_LABELS: Record<string, string> = {
  internal: "Internal",
  email: "Email",
  calendar: "Calendar",
  payments: "Payments",
  lead_source: "Lead source",
};

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function AutomationsPage() {
  const supabase = await createClient();

  const [{ data: rawAutomations }, { data: rawRuns }, { data: rawNotifications }] =
    await Promise.all([
      supabase.from("automations").select("*").order("name"),
      supabase
        .from("automation_runs")
        .select("id, automation_id, started_at, finished_at, status, summary")
        .order("started_at", { ascending: false })
        .limit(20),
      supabase
        .from("notifications")
        .select("id, title, body, href, kind, read, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const automations = (rawAutomations ?? []) as Automation[];
  const runs = (rawRuns ?? []) as AutomationRun[];
  const notifications = (rawNotifications ?? []) as Notification[];

  const enabledCount = automations.filter((a) => a.enabled).length;
  const unreadCount = notifications.filter((n) => !n.read).length;
  const errorRuns = runs.filter((r) => r.status === "error").length;

  const automationName = (id: string) =>
    automations.find((a) => a.id === id)?.name ?? "Unknown";

  const emailConnected = isEmailConfigured();

  return (
    <div className="content-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow electric">Automations + Integrations</p>
          <h2>Set it, watch it, kill it.</h2>
          <p className="page-description">
            Every automation is off until you turn it on. Every run is logged.
            Nothing sends externally — notifications stay in the app.
          </p>
        </div>
      </header>

      <section className="metric-grid" aria-label="Automation metrics">
        <MetricCard label="Automations" value={String(automations.length)} detail={`${enabledCount} enabled`} tone="violet" />
        <MetricCard label="Unread" value={String(unreadCount)} detail="Notifications waiting" tone="pink" />
        <MetricCard label="Runs logged" value={String(runs.length)} detail="Audit trail" tone="cyan" />
        <MetricCard label="Errors" value={String(errorRuns)} detail="Failed runs" tone={errorRuns > 0 ? "pink" : "green"} />
      </section>

      <div className="workspace-grid">
        <div className="workspace-span-7">
          <section className="panel" aria-label="Automation registry">
            <div className="panel-heading">
              <h3>Registry</h3>
              <span className="pipeline-count">Kill switches included</span>
            </div>
            <ul className="delivery-list">
              {automations.map((a) => (
                <li key={a.id} className="delivery-row" style={{ alignItems: "flex-start" }}>
                  <div className="delivery-row-main">
                    <p className="delivery-row-title">
                      {a.name}{" "}
                      <span className={`delivery-pill ${a.enabled ? "done" : "blocked"}`}>
                        {a.enabled ? "ON" : "OFF"}
                      </span>
                    </p>
                    <p className="delivery-row-sub">
                      {KIND_LABELS[a.kind] ?? a.kind} · {a.description}
                    </p>
                    <p className="delivery-row-sub">
                      {a.last_run_at
                        ? `Last run ${timeAgo(a.last_run_at)} — ${a.last_status ?? "unknown"}`
                        : "Never run"}
                    </p>
                  </div>
                  <div className="delivery-actions">
                    <form action={runAutomation}>
                      <input type="hidden" name="automation_key" value={a.key} />
                      <button type="submit" className="mini-button">Run now</button>
                    </form>
                    <form action={toggleAutomation}>
                      <input type="hidden" name="automation_id" value={a.id} />
                      <input type="hidden" name="enabled" value={a.enabled ? "false" : "true"} />
                      <button
                        type="submit"
                        className={`mini-button ${a.enabled ? "danger" : "go"}`}
                      >
                        {a.enabled ? "Kill" : "Enable"}
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel" aria-label="Audit trail" style={{ marginTop: 14 }}>
            <div className="panel-heading">
              <h3>Audit trail</h3>
              <span className="pipeline-count">{runs.length} runs</span>
            </div>
            <ul className="delivery-list" style={{ maxHeight: 300, overflowY: "auto" }}>
              {runs.length === 0 ? (
                <li className="delivery-row">
                  <p className="pipeline-empty">No runs yet. Hit “Run now” above.</p>
                </li>
              ) : (
                runs.map((r) => (
                  <li key={r.id} className="delivery-row">
                    <div className="delivery-row-main">
                      <p className="delivery-row-title" style={{ fontWeight: 400 }}>
                        {r.summary || automationName(r.automation_id)}
                      </p>
                      <p className="delivery-row-sub">
                        {automationName(r.automation_id)} · {timeAgo(r.started_at)}
                      </p>
                    </div>
                    <span className={`delivery-pill ${r.status === "ok" ? "done" : r.status === "error" ? "blocked" : "visible"}`}>
                      {r.status}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>

        <div className="workspace-span-5">
          <section className="panel" aria-label="Notifications">
            <div className="panel-heading">
              <h3>Notifications</h3>
              <div className="delivery-actions">
                <span className="pipeline-count">{unreadCount} unread</span>
                {unreadCount > 0 ? (
                  <form action={markAllNotificationsRead}>
                    <button type="submit" className="mini-button">Mark all read</button>
                  </form>
                ) : null}
              </div>
            </div>
            <ul className="delivery-list" style={{ maxHeight: 480, overflowY: "auto" }}>
              {notifications.length === 0 ? (
                <li className="delivery-row">
                  <p className="pipeline-empty">Quiet. Suspiciously quiet.</p>
                </li>
              ) : (
                notifications.map((n) => (
                  <li
                    key={n.id}
                    className="delivery-row"
                    style={{ opacity: n.read ? 0.55 : 1, alignItems: "flex-start" }}
                  >
                    <div className="delivery-row-main">
                      <p className="delivery-row-title" style={{ fontWeight: n.read ? 400 : 600 }}>
                        {n.href && !n.read ? (
                          <a href={n.href} style={{ color: "inherit" }}>{n.title}</a>
                        ) : (
                          n.title
                        )}
                      </p>
                      {n.body ? <p className="delivery-row-sub">{n.body}</p> : null}
                      <p className="delivery-row-sub">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read ? (
                      <form action={markNotificationRead}>
                        <input type="hidden" name="notification_id" value={n.id} />
                        <button type="submit" className="mini-button" aria-label="Mark read">✓</button>
                      </form>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </div>

      <section className="panel" aria-label="External integrations" style={{ marginTop: 14 }}>
        <div className="panel-heading">
          <h3>External integrations</h3>
          <span className="pipeline-count">Keys required</span>
        </div>
        <div style={{ padding: "14px 18px 18px" }}>
          <p className="page-description" style={{ margin: "0 0 12px" }}>
            Email, calendar, invoicing/payments, and automated lead-source imports
            each need an account and API key before they can run. The automation
            registry above is ready to host them — pick a provider and hand over
            a key when you want one wired up.
          </p>
          <ul className="delivery-list">
            <li className="delivery-row">
              <div className="delivery-row-main">
                <p className="delivery-row-title">Email</p>
                <p className="delivery-row-sub">
                  {emailConnected
                    ? "Gmail connected — drafts can send with per-send approval. Every send is logged."
                    : "Needs GMAIL_USER + GMAIL_APP_PASSWORD in .env.local (Google app password)."}
                </p>
              </div>
              <span className={`delivery-pill ${emailConnected ? "done" : "blocked"}`}>
                {emailConnected ? "Connected" : "Not connected"}
              </span>
            </li>
            {[
              { name: "Calendar", note: "Needs Google Calendar OAuth. Consultations could auto-schedule." },
              { name: "Invoicing / payments", note: "Needs a payment provider's keys. Invoices from milestones." },
              { name: "Lead sources", note: "Needs API access per source. Imports land in the Radar with dedup." },
            ].map((i) => (
              <li key={i.name} className="delivery-row">
                <div className="delivery-row-main">
                  <p className="delivery-row-title">{i.name}</p>
                  <p className="delivery-row-sub">{i.note}</p>
                </div>
                <span className="delivery-pill blocked">Not connected</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
