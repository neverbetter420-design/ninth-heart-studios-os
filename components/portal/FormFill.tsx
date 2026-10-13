"use client";

import { useState } from "react";
import {
  categoryLabel,
  formatCents,
  lineItemsTotal,
  parseLineItems,
  parseValues,
  type FormField,
  type LineItem,
} from "@/lib/forms";
import type { FormSubmission, FormTemplate } from "@/lib/supabase/types";

type SubmissionView = FormSubmission & { template: FormTemplate; sourceUrl: string | null };

function LineItemsEditor({
  field,
  initial,
}: {
  field: FormField;
  initial: LineItem[];
}) {
  const [items, setItems] = useState<LineItem[]>(initial.length > 0 ? initial : [{ description: "", qty: 1, price_cents: 0 }]);

  function update(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Description…"
            value={item.description}
            onChange={(e) => update(i, { description: e.target.value })}
            style={{ flex: 1 }}
            required={field.required}
          />
          <input
            type="number"
            min={0}
            step="1"
            placeholder="Qty"
            value={item.qty}
            onChange={(e) => update(i, { qty: Number(e.target.value) || 0 })}
            style={{ width: 70 }}
          />
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="Price $"
            value={item.price_cents / 100}
            onChange={(e) => update(i, { price_cents: Math.round((Number(e.target.value) || 0) * 100) })}
            style={{ width: 90 }}
          />
          <span style={{ width: 80, textAlign: "right", fontSize: 13 }}>
            {formatCents(item.qty * item.price_cents)}
          </span>
          <button
            type="button"
            className="mini-button danger"
            onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
            aria-label="Remove line"
          >
            ✕
          </button>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          type="button"
          className="mini-button"
          onClick={() => setItems((prev) => [...prev, { description: "", qty: 1, price_cents: 0 }])}
        >
          + Add line
        </button>
        <strong style={{ fontSize: 14 }}>Total: {formatCents(lineItemsTotal(items))}</strong>
      </div>
      <input type="hidden" name={`field_${field.id}`} value={JSON.stringify(items)} />
    </div>
  );
}

function ReadOnlySubmission({ submission, sourceUrl }: { submission: SubmissionView; sourceUrl: string | null }) {
  const fields = (Array.isArray(submission.template.fields) ? submission.template.fields : []) as FormField[];
  const values = parseValues(submission.values);
  return (
    <div style={{ padding: "0 18px 18px" }}>
      {sourceUrl ? (
        <p style={{ fontSize: 13, margin: "0 0 10px" }}>
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
            View original document ({submission.template.source_file_name ?? "PDF"})
          </a>
        </p>
      ) : null}
      {fields.map((f) => {
        const v = values[f.id];
        let display: string;
        if (f.type === "line_items") {
          const items = parseLineItems(v);
          display = items.map((li) => `${li.description} × ${li.qty} @ ${formatCents(li.price_cents)}`).join("; ") || "—";
        } else if (f.type === "checkbox") {
          display = v === true ? "☑ Yes" : "☐ No";
        } else if (f.type === "signature") {
          display = "Signed";
        } else {
          display = v === undefined || v === null || String(v) === "" ? "—" : String(v);
        }
        return (
          <p key={f.id} style={{ margin: "6px 0", fontSize: 13 }}>
            <strong>{f.label}:</strong> {display}
          </p>
        );
      })}
      {submission.total_cents !== null && submission.total_cents !== undefined ? (
        <p style={{ margin: "10px 0 0", fontSize: 14 }}>
          <strong>Total: {formatCents(submission.total_cents)}</strong>
        </p>
      ) : null}
      {submission.signer_name ? (
        <p className="muted-copy" style={{ fontSize: 12, marginTop: 8 }}>
          Signed by {submission.signer_name}
          {submission.submitted_at ? ` on ${new Date(submission.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
        </p>
      ) : null}
    </div>
  );
}

export function FormFill({
  submissions,
  submitAction,
}: {
  submissions: SubmissionView[];
  submitAction: (formData: FormData) => void;
}) {
  if (submissions.length === 0) return null;

  return (
    <article className="panel detail-panel" aria-label="Forms">
      <h3>Forms</h3>
      {submissions.map((s) => {
        const fields = (Array.isArray(s.template.fields) ? s.template.fields : []) as FormField[];
        const needsSignature = fields.some((f) => f.type === "signature");
        return (
          <details key={s.id} className="panel" style={{ margin: "10px 0", borderRadius: 12 }}>
            <summary className="panel-heading" style={{ cursor: "pointer" }}>
              <h3 style={{ fontSize: 14 }}>{s.template.name}</h3>
              <span className={`delivery-pill ${s.status === "submitted" ? "done" : "progress"}`}>
                {s.status === "submitted" ? "Submitted" : "Needs you"}
              </span>
            </summary>
            {s.status === "submitted" ? (
              <ReadOnlySubmission submission={s} sourceUrl={s.sourceUrl} />
            ) : (
              <form action={submitAction} style={{ padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                <input type="hidden" name="submission_id" value={s.id} />
                <p className="muted-copy" style={{ fontSize: 12, margin: 0 }}>
                  {categoryLabel(s.template.category)}
                  {s.template.description ? ` · ${s.template.description}` : ""}
                </p>
                {s.sourceUrl ? (
                  <p style={{ fontSize: 13, margin: 0 }}>
                    <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer">
                      View original document ({s.template.source_file_name ?? "PDF"})
                    </a>
                  </p>
                ) : null}
                {fields.map((f) => (
                  <label key={f.id} className="field">
                    <span>
                      {f.label}
                      {f.required ? " *" : ""}
                    </span>
                    {f.type === "text" ? (
                      <input type="text" name={`field_${f.id}`} required={f.required} maxLength={500} />
                    ) : f.type === "textarea" ? (
                      <textarea name={`field_${f.id}`} className="notes-area" required={f.required} maxLength={5000} />
                    ) : f.type === "number" ? (
                      <input type="number" name={`field_${f.id}`} required={f.required} step="any" />
                    ) : f.type === "date" ? (
                      <input type="date" name={`field_${f.id}`} required={f.required} />
                    ) : f.type === "checkbox" ? (
                      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input type="checkbox" name={`field_${f.id}`} required={f.required} />
                        <span style={{ fontSize: 13 }}>{f.help ?? "Check to confirm"}</span>
                      </span>
                    ) : f.type === "select" ? (
                      <select name={`field_${f.id}`} required={f.required} defaultValue="">
                        <option value="" disabled>Choose…</option>
                        {(f.options ?? []).map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : f.type === "signature" ? (
                      <span className="muted-copy" style={{ fontSize: 13 }}>
                        You&apos;ll sign below when you submit this form.
                      </span>
                    ) : f.type === "line_items" ? (
                      <LineItemsEditor field={f} initial={[]} />
                    ) : null}
                    {f.help && f.type !== "checkbox" ? (
                      <span className="muted-copy" style={{ fontSize: 12 }}>{f.help}</span>
                    ) : null}
                  </label>
                ))}
                {needsSignature ? (
                  <>
                    <label className="field">
                      <span>Your full name</span>
                      <input type="text" name="signer_name" placeholder="Jane Smith" required maxLength={120} autoComplete="name" />
                    </label>
                    <label className="field">
                      <span>Your email</span>
                      <input type="email" name="signer_email" placeholder="you@example.com" required maxLength={160} autoComplete="email" />
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
                      <input type="checkbox" name="agreed" required style={{ marginTop: 3 }} />
                      <span>I confirm the information above is correct and agree to this form.</span>
                    </label>
                  </>
                ) : null}
                <div>
                  <button type="submit" className="mini-button go">
                    {needsSignature ? "Sign + submit" : "Submit"}
                  </button>
                </div>
                <p className="muted small">Your answers, timestamp, and IP are recorded with your submission.</p>
              </form>
            )}
          </details>
        );
      })}
    </article>
  );
}
