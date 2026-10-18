import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import {
  DocumentNotice,
  DocumentSectionHeading,
  documentDate,
} from "@/components/documents/DocumentChrome";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";
import {
  markAllNotificationsRead,
  markNotificationRead,
  runAutomation,
  toggleAutomation,
} from "./actions";
import { createClient } from "@/lib/supabase/server";
import { isEmailConfigured } from "@/lib/email";
import type {
  Automation,
  AutomationRun,
  Notification,
} from "@/lib/supabase/types";

const KIND_LABELS: Record<string, string> = {
  internal: "Internal",
  email: "Email",
  calendar: "Calendar",
  payments: "Payments",
  lead_source: "Lead source",
};
const RUN_LABELS: Record<string, string> = {
  ok: "Completed",
  error: "Error",
  skipped: "Skipped",
};
function localDestination(href: string | null) {
  return href?.startsWith("/") && !href.startsWith("//") && !href.includes("\\")
    ? href
    : null;
}

export default async function AutomationsPage() {
  const supabase = await createClient();
  const [
    { data: rawAutomations, error: registryError },
    { data: rawRuns, error: runsError },
    { data: rawNotifications, error: notificationsError },
  ] = await Promise.all([
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
  const automations = (
    registryError ? [] : (rawAutomations ?? [])
  ) as Automation[];
  const runs = (runsError ? [] : (rawRuns ?? [])) as AutomationRun[];
  const notifications = (
    notificationsError ? [] : (rawNotifications ?? [])
  ) as Notification[];
  const enabled = automations.filter((a) => a.enabled).length;
  const unread = notifications.filter((n) => !n.read).length;
  const errors = runs.filter((r) => r.status === "error").length;
  const name = (id: string) =>
    automations.find((a) => a.id === id)?.name ?? "Automation name unavailable";
  const emailConfigured = isEmailConfigured();
  return (
    <div className="content-wrap management-page paperwork-page studio-page engine-page">
      <header className="page-header management-heading">
        <div>
          <p className="eyebrow">Automations · The engine room</p>
          <h2>
            A little less chasing.
            <br />
            <em>A little more control.</em>
          </h2>
          <p className="page-description">
            See what is enabled, review the signals, and decide when to act. The
            built-in checks create notifications inside the studio.
          </p>
        </div>
        <Link
          href="/settings#studio-connections"
          className="management-text-link"
        >
          Connection status <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <nav
        className="management-destinations"
        aria-label="Automation destinations"
      >
        <a href="#engine-signals">Notifications</a>
        <a href="#engine-registry">Registry</a>
        <a href="#engine-history">Run history</a>
        <a href="#engine-connections">Integrations</a>
      </nav>
      <section
        className="metric-grid radar-metrics"
        aria-label="Automation metrics"
      >
        <MetricCard
          label="Registry"
          value={registryError ? "—" : String(automations.length)}
          detail={
            registryError ? "Read unavailable" : `${enabled} marked enabled`
          }
          tone="violet"
        />
        <MetricCard
          label="Unread"
          value={notificationsError ? "—" : String(unread)}
          detail="Among 20 latest notifications"
          tone="pink"
        />
        <MetricCard
          label="Recent runs"
          value={runsError ? "—" : String(runs.length)}
          detail="Up to 20 latest records"
          tone="cyan"
        />
        <MetricCard
          label="Run errors"
          value={runsError ? "—" : String(errors)}
          detail="In the displayed run history"
          tone={errors ? "pink" : "green"}
        />
      </section>
      <section
        id="engine-signals"
        aria-label="Notifications"
        className="engine-section"
      >
        <DocumentSectionHeading
          eyebrow="01 · Attention, without the noise"
          title="Studio signals"
          detail="20 latest notifications"
        />
        {notificationsError ? (
          <DocumentNotice>
            Notifications could not load. The unread count is unavailable.
          </DocumentNotice>
        ) : (
          <>
            <div className="engine-notification-tools">
              <p className="management-help">
                {unread} unread in this view. Read notifications remain
                available below.
              </p>
              {unread > 0 ? (
                <form action={markAllNotificationsRead}>
                  <PortalSubmitButton pendingLabel="Marking read…">
                    Mark all notifications read
                  </PortalSubmitButton>
                </form>
              ) : null}
            </div>
            {unread > 0 ? (
              <p className="management-help">
                “Mark all” includes unread notifications outside these 20
                records.
              </p>
            ) : null}
            {notifications.length ? (
              <ul className="engine-list">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className="engine-signal"
                    data-notification-id={n.id}
                    data-read={n.read}
                  >
                    <span className="engine-signal-state">
                      {n.read ? "Read" : "Unread"}
                    </span>
                    <div>
                      <h4>
                        {localDestination(n.href) ? (
                          <Link href={localDestination(n.href)!}>
                            {n.title}
                          </Link>
                        ) : (
                          n.title
                        )}
                      </h4>
                      {n.body ? <p>{n.body}</p> : null}
                      <small>{documentDate(n.created_at, true)}</small>
                    </div>
                    {!n.read ? (
                      <form action={markNotificationRead}>
                        <input
                          type="hidden"
                          name="notification_id"
                          value={n.id}
                        />
                        <PortalSubmitButton pendingLabel="Marking read…">
                          Mark read
                        </PortalSubmitButton>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="management-empty">
                <h4>No signals to review.</h4>
                <p>
                  No notifications were returned. Review the registry and run
                  history for the current automation state.
                </p>
              </div>
            )}
          </>
        )}
      </section>
      <section
        id="engine-registry"
        aria-label="Automation registry"
        className="engine-section"
      >
        <DocumentSectionHeading
          eyebrow="02 · The controls"
          title="What the studio watches."
          detail="Manual runs are explicit actions"
        />
        <p className="management-help">
          The enabled flag records availability. It does not verify a schedule.
          Run now starts one manual check even when the flag is off; it may add
          in-app notifications and a run record.
        </p>
        {registryError ? (
          <DocumentNotice>
            Automation registry could not load. Controls and enabled counts are
            unavailable.
          </DocumentNotice>
        ) : automations.length ? (
          <ol className="engine-list">
            {automations.map((a, i) => (
              <li
                key={a.id}
                className="engine-registry-row"
                data-automation-key={a.key}
              >
                <span className="radar-index" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="engine-registry-copy">
                  <div className="studio-row-heading">
                    <h4>{a.name}</h4>
                    <span
                      className="studio-status"
                      data-state={a.enabled ? "ready" : "off"}
                    >
                      {a.enabled ? "Enabled flag on" : "Enabled flag off"}
                    </span>
                  </div>
                  <p>
                    {KIND_LABELS[a.kind] ?? a.kind} · {a.description}
                  </p>
                  <small>
                    {a.last_run_at
                      ? `Last run ${documentDate(a.last_run_at, true)} · ${RUN_LABELS[a.last_status ?? ""] ?? "Status not recorded"}`
                      : "No last run recorded"}
                  </small>
                  <details className="engine-controls">
                    <summary>
                      Run &amp; availability <span aria-hidden="true">+</span>
                    </summary>
                    <p className="management-help">
                      Run now is a manual action. Changing availability saves
                      the enabled flag; review scheduling separately.
                    </p>
                    <div className="studio-actions">
                      <form action={runAutomation}>
                        <input
                          type="hidden"
                          name="automation_key"
                          value={a.key}
                        />
                        <PortalSubmitButton pendingLabel="Running check…">
                          Run now
                        </PortalSubmitButton>
                      </form>
                      <form action={toggleAutomation}>
                        <input
                          type="hidden"
                          name="automation_id"
                          value={a.id}
                        />
                        <input
                          type="hidden"
                          name="enabled"
                          value={a.enabled ? "false" : "true"}
                        />
                        <PortalSubmitButton
                          className={
                            a.enabled ? "mini-button danger" : "mini-button"
                          }
                          pendingLabel="Saving availability…"
                        >
                          {a.enabled
                            ? "Disable automation"
                            : "Enable automation"}
                        </PortalSubmitButton>
                      </form>
                    </div>
                  </details>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="management-empty">
            <h4>No automation records.</h4>
            <p>
              The registry returned no entries. No availability state can be
              inferred.
            </p>
          </div>
        )}
      </section>
      <section
        id="engine-history"
        aria-label="Run history"
        className="engine-section"
      >
        <DocumentSectionHeading
          eyebrow="03 · The evidence"
          title="What actually ran."
          detail="20 latest run records"
        />
        {runsError ? (
          <DocumentNotice>
            Run history could not load. Run and error counts are unavailable.
          </DocumentNotice>
        ) : runs.length ? (
          <ul className="engine-list">
            {runs.map((r) => (
              <li key={r.id} className="engine-run">
                <div>
                  <h4>{name(r.automation_id)}</h4>
                  <p>{r.summary || "No summary recorded."}</p>
                  <small>
                    Started {documentDate(r.started_at, true)} ·{" "}
                    {r.finished_at
                      ? `Finished ${documentDate(r.finished_at, true)}`
                      : "Finish time not recorded"}
                  </small>
                </div>
                <span
                  className="studio-status"
                  data-state={
                    r.status === "error"
                      ? "unavailable"
                      : r.status === "ok"
                        ? "ready"
                        : "off"
                  }
                >
                  {RUN_LABELS[r.status] ?? r.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="management-empty">
            <h4>No run records returned.</h4>
            <p>
              A saved enabled flag is separate from evidence that a check has
              run.
            </p>
          </div>
        )}
      </section>
      <section
        id="engine-connections"
        aria-label="External integrations"
        className="engine-section"
      >
        <DocumentSectionHeading
          eyebrow="04 · Beyond the studio"
          title="Connections, with context."
        />
        <div className="engine-integration-grid">
          <article>
            <h4>Email</h4>
            <span
              className="studio-status"
              data-state={emailConfigured ? "ready" : "off"}
            >
              {emailConfigured ? "Settings present" : "Not configured"}
            </span>
            <p>
              {emailConfigured
                ? "Email settings are present. Delivery has not been checked here. Muse offers a separate, explicit send action for saved drafts."
                : "Email settings are absent. Review connection status before using Muse email delivery."}
            </p>
            <Link className="management-text-link" href="/muse#muse-saved">
              Saved Muse drafts ↗
            </Link>
          </article>
          <article>
            <h4>Calendar &amp; payments</h4>
            <span className="studio-status">Separate setup</span>
            <p>
              This page does not verify a calendar or payment-provider
              connection. Review the studio connection notes before planning
              either workflow.
            </p>
            <Link
              className="management-text-link"
              href="/settings#studio-connections"
            >
              Connection notes ↗
            </Link>
          </article>
          <article>
            <h4>Opportunity sources</h4>
            <span className="studio-status">Manual intake available</span>
            <p>
              Track approved sources in Radar. This view does not verify source
              API credentials or scheduled imports.
            </p>
            <Link className="management-text-link" href="/opportunities">
              Open Opportunity Radar ↗
            </Link>
          </article>
        </div>
      </section>
    </div>
  );
}
