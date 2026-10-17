"use client";

import { useActionState, useState, useTransition, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { initialPortalFeedbackState, type PortalFeedbackState } from "@/lib/portal-feedback";

type FeedbackAction = (previous: PortalFeedbackState, formData: FormData) => Promise<PortalFeedbackState>;

/**
 * Preserve user-entered fields on a failed server action. React's native
 * <form action> reset behavior otherwise destroys long-form work on errors.
 * The server action is responsible for returning truthful persisted results.
 */
export function PortalActionForm({
  action,
  children,
  className,
  style,
  pendingMessage = "Saving…",
}: {
  action: FeedbackAction;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  pendingMessage?: string;
}) {
  const [feedback, dispatch] = useActionState(action, initialPortalFeedbackState);
  const [pending, startTransition] = useTransition();
  const [attempted, setAttempted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || feedback.status === "success") return;
    const form = event.currentTarget;
    const data = new FormData(form);
    // HTML submit buttons aren't included by default when FormData is created
    // manually. Preserve the chosen Approve / Request changes decision.
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) {
      if (submitter.name) data.set(submitter.name, submitter.value);
    }
    setAttempted(true);
    startTransition(() => dispatch(data));
  }

  return (
    <form className={className} style={style} onSubmit={handleSubmit} aria-busy={pending}>
      <fieldset className="portal-action-fields" disabled={pending || feedback.status === "success"}>
        {children}
      </fieldset>
      {pending ? (
        <p className="portal-action-feedback is-pending" role="status" aria-live="polite">
          <span className="portal-action-spinner" aria-hidden="true" />{pendingMessage}
        </p>
      ) : attempted && feedback.message ? (
        <p className={"portal-action-feedback is-" + feedback.status} role={feedback.status === "error" ? "alert" : "status"} aria-live="polite">
          {feedback.message}
        </p>
      ) : null}
    </form>
  );
}

/** For existing redirect-based uploads: pending comes from native form status. */
export function PortalSubmitButton({
  children,
  pendingLabel,
  className = "mini-button go",
}: {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
