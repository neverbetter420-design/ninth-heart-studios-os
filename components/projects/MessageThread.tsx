import type { ProjectMessage } from "@/lib/supabase/types";
import type { PortalFeedbackState } from "@/lib/portal-feedback";
import { PortalActionForm } from "@/components/portal/PortalActionForm";

type SendAction = (formData: FormData) => Promise<void>;

function formatTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MessageThread({
  projectId,
  messages,
  currentUserId,
  sendAction,
  feedbackAction,
  otherLabel,
  title = "Messages",
}: {
  projectId: string;
  messages: ProjectMessage[];
  currentUserId: string;
  sendAction: SendAction;
  feedbackAction?: (previous: PortalFeedbackState, formData: FormData) => Promise<PortalFeedbackState>;
  otherLabel: string;
  title?: string;
}) {
  return (
    <section className="panel" aria-label={title}>
      <div className="panel-heading">
        <h3>{title}</h3>
        <span className="pipeline-count">{messages.length}</span>
      </div>
      <ul className="delivery-list" style={{ maxHeight: 320, overflowY: "auto" }}>
        {messages.length === 0 ? (
          <li className="delivery-row">
            <p className="pipeline-empty">No messages yet. Say hi — it&apos;s good for business.</p>
          </li>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            return (
              <li key={m.id} className="delivery-row" style={{ alignItems: "flex-start" }}>
                <div className="delivery-row-main">
                  <p className="delivery-row-sub" style={{ marginBottom: 4 }}>
                    <strong style={{ color: mine ? "#d9a8ff" : "#9cd2ff" }}>
                      {mine ? "You" : otherLabel}
                    </strong>{" "}
                    · {formatTime(m.created_at)}
                  </p>
                  <p className="delivery-row-title" style={{ fontWeight: 400, whiteSpace: "pre-wrap" }}>
                    {m.body}
                  </p>
                </div>
              </li>
            );
          })
        )}
      </ul>
      {feedbackAction ? (
        <PortalActionForm action={feedbackAction} className="delivery-add-form" pendingMessage="Sending your message…">
          <input type="hidden" name="project_id" value={projectId} />
          <input type="text" name="body" placeholder="Write a message…" required maxLength={2000} autoComplete="off" />
          <button type="submit" className="mini-button go">Send</button>
        </PortalActionForm>
      ) : (
        <form action={sendAction} className="delivery-add-form">
          <input type="hidden" name="project_id" value={projectId} />
          <input
            type="text"
            name="body"
            placeholder="Write a message…"
            required
            maxLength={2000}
            autoComplete="off"
          />
          <button type="submit" className="mini-button go">Send</button>
        </form>
      )}
    </section>
  );
}
