import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import {
  DocumentCreate,
  DocumentNav,
  DocumentNotice,
  DocumentSectionHeading,
  documentDate,
} from "@/components/documents/DocumentChrome";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";
import { createContract } from "./actions";
import { createClient } from "@/lib/supabase/server";
import type { Contract } from "@/lib/supabase/types";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const { error: formError, status } = await searchParams;
  const supabase = await createClient();
  const [{ data: rawContracts, error }, projects, opportunities, templates] =
    await Promise.all([
      supabase
        .from("contracts")
        .select(
          "id, project_id, opportunity_id, title, status, sent_at, signed_at, signer_name, created_at",
        )
        .order("updated_at", { ascending: false }),
      supabase.from("projects").select("id, name").order("name"),
      supabase.from("opportunities").select("id, title").order("title"),
      supabase
        .from("templates")
        .select("id, name")
        .eq("category", "contract")
        .eq("active", true)
        .order("name"),
    ]);
  const contracts = (error ? [] : (rawContracts ?? [])) as Contract[];
  const filter = ["draft", "sent", "signed", "voided"].includes(status ?? "")
    ? status
    : undefined;
  const shown = filter
    ? contracts.filter((c) => c.status === filter)
    : contracts;
  const projectChoices = (projects.error ? [] : (projects.data ?? [])) as {
    id: string;
    name: string;
  }[];
  const opportunityChoices = (
    opportunities.error ? [] : (opportunities.data ?? [])
  ) as { id: string; title: string }[];
  const templateChoices = (templates.error ? [] : (templates.data ?? [])) as {
    id: string;
    name: string;
  }[];
  const noDestination = projectChoices.length + opportunityChoices.length === 0;

  return (
    <div className="content-wrap management-page paperwork-page">
      <header className="page-header management-heading paperwork-heading">
        <div>
          <p className="eyebrow">Studio agreements</p>
          <h2>
            Good work starts
            <br />
            <em>in writing.</em>
          </h2>
          <p className="page-description">
            Draft the terms, share an agreement, and keep its signature record
            in one place.
          </p>
        </div>
      </header>
      <DocumentNav current="contracts" />
      <section className="metric-grid" aria-label="Contract metrics">
        {[
          ["Drafts", "draft", "Being written"],
          ["Awaiting signature", "sent", "Shared agreements"],
          ["Signed", "signed", "Signature recorded"],
        ].map(([label, state, detail]) => (
          <MetricCard
            key={state}
            label={label}
            value={
              error
                ? "—"
                : String(contracts.filter((c) => c.status === state).length)
            }
            detail={detail}
            tone="violet"
          />
        ))}
      </section>
      {formError ? <DocumentNotice>{formError}</DocumentNotice> : null}
      <DocumentCreate
        title="New contract"
        detail="Start with a blank draft or a text template"
        open={Boolean(formError)}
      >
        <form action={createContract} className="paperwork-form">
          <fieldset className="paperwork-fieldset" disabled={noDestination}>
            <label className="field">
              <span>Contract title</span>
              <input
                name="title"
                required
                maxLength={160}
                placeholder="Website design agreement"
              />
            </label>
            <p className="management-help">
              Choose a project or opportunity for this agreement. Clients sign
              through a project with portal access. Sending does not send an
              email.
            </p>
            <div className="paperwork-form-grid">
              <label className="field">
                <span>Project</span>
                <select
                  aria-label="Project"
                  name="project_id"
                  defaultValue=""
                  disabled={Boolean(projects.error)}
                >
                  <option value="">Choose a project</option>
                  {projectChoices.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Opportunity</span>
                <select
                  aria-label="Opportunity"
                  name="opportunity_id"
                  defaultValue=""
                  disabled={Boolean(opportunities.error)}
                >
                  <option value="">Choose an opportunity</option>
                  {opportunityChoices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Text template (optional)</span>
              <select
                aria-label="Text template (optional)"
                name="template_id"
                defaultValue=""
                disabled={Boolean(templates.error)}
              >
                <option value="">Blank agreement</option>
                {templateChoices.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <PortalSubmitButton pendingLabel="Creating draft…">
                Create draft
              </PortalSubmitButton>
            </div>
          </fieldset>
          {projects.error || opportunities.error || templates.error ? (
            <DocumentNotice>
              Some draft choices could not load. Refresh to restore the
              unavailable choices.
            </DocumentNotice>
          ) : null}
          {noDestination && !projects.error && !opportunities.error ? (
            <p className="management-help">
              Create a <Link href="/projects">project</Link> or{" "}
              <Link href="/opportunities">opportunity</Link> before drafting an
              agreement.
            </p>
          ) : null}
        </form>
      </DocumentCreate>
      <section aria-label="Contracts">
        <DocumentSectionHeading
          eyebrow="Agreement directory"
          title="The record of your work"
          detail={
            error
              ? "Unavailable"
              : `${shown.length} ${shown.length === 1 ? "agreement" : "agreements"}`
          }
        />
        <nav className="paperwork-filters" aria-label="Contract status">
          {[
            ["", "All"],
            ["draft", "Drafts"],
            ["sent", "Awaiting signature"],
            ["signed", "Signed"],
            ["voided", "Voided"],
          ].map(([key, label]) => (
            <Link
              key={key}
              href={key ? `/contracts?status=${key}` : "/contracts"}
              aria-current={(filter ?? "") === key ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        {error ? (
          <DocumentNotice>
            Contracts could not load. Refresh to try again.
          </DocumentNotice>
        ) : shown.length === 0 ? (
          <div className="management-empty">
            <h4>
              {filter
                ? "No agreements in this stage."
                : "Your next agreement starts here."}
            </h4>
            <p>
              Open New contract to prepare a draft and attach it to your work.
            </p>
          </div>
        ) : (
          <ol className="paperwork-list">
            {shown.map((c, i) => (
              <li key={c.id} className="paperwork-row">
                <span className="paperwork-number" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h4>{c.title}</h4>
                  <p>
                    {c.status === "signed"
                      ? `Signed${c.signer_name ? ` by ${c.signer_name}` : ""}`
                      : c.status === "sent"
                        ? "Waiting for a signature"
                        : `Created ${documentDate(c.created_at)}`}
                  </p>
                </div>
                <span className="paperwork-status" data-status={c.status}>
                  {c.status}
                </span>
                <Link
                  href={`/contracts/${c.id}`}
                  className="management-text-link"
                  aria-label={`Open contract: ${c.title}`}
                >
                  Open agreement <span aria-hidden="true">↗</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
