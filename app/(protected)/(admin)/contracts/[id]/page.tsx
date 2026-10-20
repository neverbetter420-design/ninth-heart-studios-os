import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DocumentNav,
  DocumentNotice,
  DocumentSectionHeading,
  documentDate,
} from "@/components/documents/DocumentChrome";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";
import {
  applyTemplateToContract,
  deleteContract,
  sendContract,
  updateContractBody,
  voidContract,
} from "../actions";
import { createClient } from "@/lib/supabase/server";
import type { Contract } from "@/lib/supabase/types";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: raw, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Contract could not load.");
  if (!raw) notFound();
  const contract = raw as Contract;
  const editable = contract.status === "draft";
  const { data: rawTemplates, error: templatesError } = editable
    ? await supabase
        .from("templates")
        .select("id, name")
        .eq("category", "contract")
        .eq("active", true)
        .order("name")
    : { data: null, error: null };
  const templates = (templatesError ? [] : (rawTemplates ?? [])) as {
    id: string;
    name: string;
  }[];
  return (
    <div className="content-wrap management-page paperwork-page paperwork-detail">
      <Link href="/contracts" className="management-back-link">
        ← All contracts
      </Link>
      <header className="page-header management-heading paperwork-heading">
        <div>
          <p className="eyebrow">Agreement · {contract.status}</p>
          <h2>{contract.title}</h2>
          <p className="page-description">
            {editable
              ? "Shape the terms here. Save your changes before sending for signature."
              : "The agreement and its recorded status, kept together."}
          </p>
        </div>
      </header>
      <DocumentNav current="contracts" />
      <nav
        className="management-destinations"
        aria-label="Contract workspace destinations"
      >
        <a href="#contract-terms">Terms</a>
        <a href="#contract-record">Agreement record</a>
        {contract.status === "signed" ? (
          <a href="#contract-signature">Signature record</a>
        ) : null}
      </nav>
      <div className="paperwork-workspace">
        <div className="paperwork-main">
          <section id="contract-terms" aria-label="Contract body">
            <DocumentSectionHeading
              eyebrow={editable ? "The working draft" : "Recorded agreement"}
              title="The terms"
              detail={
                editable ? "Editable draft" : `Locked · ${contract.status}`
              }
            />
            {editable ? (
              <>
                {templatesError ? (
                  <DocumentNotice>
                    Text templates could not load. You can still edit the draft.
                  </DocumentNotice>
                ) : templates.length ? (
                  <details className="paperwork-replace">
                    <summary>Start from a text template</summary>
                    <p className="management-help">
                      Replacing copies the template into this draft and replaces
                      its saved terms. Save any work you want to keep first.
                    </p>
                    <form
                      action={applyTemplateToContract}
                      className="paperwork-form"
                    >
                      <input
                        type="hidden"
                        name="contract_id"
                        value={contract.id}
                      />
                      <label className="field">
                        <span>Contract text template</span>
                        <select
                          aria-label="Contract text template"
                          name="template_id"
                          required
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Choose a template
                          </option>
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div>
                        <PortalSubmitButton pendingLabel="Replacing terms…">
                          Replace saved terms
                        </PortalSubmitButton>
                      </div>
                    </form>
                  </details>
                ) : null}
                <form action={updateContractBody} className="paperwork-form">
                  <input type="hidden" name="contract_id" value={contract.id} />
                  <label className="field">
                    <span>Title</span>
                    <input
                      name="title"
                      defaultValue={contract.title}
                      maxLength={160}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Terms</span>
                    <textarea
                      aria-label="Terms"
                      name="body"
                      className="paperwork-body-editor"
                      defaultValue={contract.body}
                      placeholder="Scope, payment terms, timeline and cancellation policy…"
                    />
                  </label>
                  <div>
                    <PortalSubmitButton pendingLabel="Saving draft…">
                      Save draft
                    </PortalSubmitButton>
                  </div>
                </form>
              </>
            ) : (
              <div className="paperwork-body">
                {contract.body || "No terms recorded."}
              </div>
            )}
          </section>
          {contract.status === "signed" ? (
            <section id="contract-signature" aria-label="Signature audit">
              <DocumentSectionHeading
                eyebrow="Signature audit"
                title="The signature record"
              />
              <dl className="paperwork-metadata">
                <div>
                  <dt>Signed by</dt>
                  <dd>{contract.signer_name || "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Signer email</dt>
                  <dd>{contract.signer_email || "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Signed at</dt>
                  <dd>{documentDate(contract.signed_at, true)}</dd>
                </div>
                <div>
                  <dt>Recorded IP</dt>
                  <dd>{contract.signer_ip ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Document hash</dt>
                  <dd>
                    <code>{contract.signature_hash || "Not recorded"}</code>
                  </dd>
                </div>
              </dl>
            </section>
          ) : null}
        </div>
        <aside className="paperwork-context">
          <section id="contract-record" aria-label="Agreement record">
            <DocumentSectionHeading title="Agreement record" />
            <dl className="paperwork-metadata">
              <div>
                <dt>Status</dt>
                <dd className="paperwork-status" data-status={contract.status}>
                  {contract.status}
                </dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{documentDate(contract.created_at, true)}</dd>
              </div>
              {contract.sent_at ? (
                <div>
                  <dt>Sent for signature</dt>
                  <dd>{documentDate(contract.sent_at, true)}</dd>
                </div>
              ) : null}
            </dl>
            {contract.project_id ? (
              <Link
                href={`/projects/${contract.project_id}?section=documents#workspace-resources`}
                className="management-text-link"
              >
                Open project ↗
              </Link>
            ) : null}
            {contract.opportunity_id ? (
              <Link
                href={`/opportunities/${contract.opportunity_id}`}
                className="management-text-link"
              >
                Open opportunity ↗
              </Link>
            ) : null}
          </section>
          {editable ? (
            <section aria-label="Send contract">
              <DocumentSectionHeading title="Ready for signature?" />
              <p>
                Save the final terms first. Sending locks the draft. Clients
                sign through their project portal.
              </p>
              {!contract.project_id ? (
                <p className="management-help">
                  This agreement is linked to an opportunity. Client signing
                  requires a project with portal access.
                </p>
              ) : null}
              <form action={sendContract}>
                <input type="hidden" name="contract_id" value={contract.id} />
                <PortalSubmitButton pendingLabel="Sending agreement…">
                  Send for signature
                </PortalSubmitButton>
              </form>
            </section>
          ) : contract.status === "sent" ? (
            <p className="management-help">
              Awaiting the client’s signature. The sent agreement is locked.
            </p>
          ) : null}
          {["draft", "sent"].includes(contract.status) ? (
            <details className="paperwork-controls">
              <summary>Record controls</summary>
              <p>
                Voiding retires the agreement. A draft can also be permanently
                deleted.
              </p>
              <div className="paperwork-control-actions">
                <form action={voidContract}>
                  <input type="hidden" name="contract_id" value={contract.id} />
                  <PortalSubmitButton
                    pendingLabel="Voiding…"
                    className="mini-button danger"
                  >
                    Void agreement
                  </PortalSubmitButton>
                </form>
                {editable ? (
                  <form action={deleteContract}>
                    <input
                      type="hidden"
                      name="contract_id"
                      value={contract.id}
                    />
                    <PortalSubmitButton
                      pendingLabel="Deleting…"
                      className="mini-button danger"
                    >
                      Delete draft
                    </PortalSubmitButton>
                  </form>
                ) : null}
              </div>
            </details>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
