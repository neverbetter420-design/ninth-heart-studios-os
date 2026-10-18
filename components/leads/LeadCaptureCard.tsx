import { createLead } from "@/app/(protected)/(admin)/leads/actions";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";

export function LeadCaptureCard({ error }: { error?: string }) {
  return (
    <section className="lead-capture-card" id="quick-capture" aria-labelledby="lead-capture-title" tabIndex={-1}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow electric">Make a connection</p>
          <h3 id="lead-capture-title">Quick capture</h3>
        </div>
      </div>

      {error ? <div className="lead-form-error" role="alert">{error}</div> : null}

      <form action={createLead} className="lead-capture-form">
        <label className="field field-wide">
          <span>Business name *</span>
          <input name="business_name" placeholder="Business name" required />
        </label>

        <label className="field field-wide">
          <span>Acquisition</span>
          <select name="acquisition_type" defaultValue="outbound">
            <option value="outbound">Outbound</option>
            <option value="inbound">Inbound</option>
          </select>
        </label>

        <details className="lead-capture-extras" open={Boolean(error)}>
          <summary>Contact details &amp; score <span aria-hidden="true">+</span></summary>
          <div className="lead-capture-extra-fields">
            <label className="field">
              <span>Contact name</span>
              <input name="contact_name" placeholder="Optional" />
            </label>

            <label className="field">
              <span>Business email</span>
              <input name="email" type="email" placeholder="hello@business.com" />
            </label>

            <label className="field">
              <span>Phone</span>
              <input name="phone" inputMode="tel" placeholder="Optional" />
            </label>

            <label className="field field-wide">
              <span>Website</span>
              <input name="website" type="url" placeholder="https://..." />
            </label>

            <label className="field score-field">
              <span>Opportunity score</span>
              <input name="score" type="number" min="0" max="100" placeholder="0–100" />
            </label>
          </div>
        </details>

        <div className="capture-submit">
          <p>Only the business name is required. Flowkeep chooses the first next action automatically.</p>
          <PortalSubmitButton className="primary-button" pendingLabel="Capturing…">Capture lead</PortalSubmitButton>
        </div>
      </form>
    </section>
  );
}
