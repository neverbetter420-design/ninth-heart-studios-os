"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type CSSProperties, type FormEvent, type ReactNode } from "react";
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
  lockOnSuccess = true,
  confirmMessage,
  resetOnSuccess = false,
}: {
  action: FeedbackAction;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  pendingMessage?: string;
  lockOnSuccess?: boolean;
  confirmMessage?: string;
  resetOnSuccess?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [feedback, dispatch] = useActionState(async (previous: PortalFeedbackState, data: FormData) => {
    let result: PortalFeedbackState;
    try {
      result = await action(previous, data);
    } catch {
      // Transport/session failures leave the persisted outcome unknown. Never
      // claim a failed save or invite blind retries that could duplicate writes.
      return {
        status: "error",
        message: "Could not confirm the server response. Refresh to check whether the change was saved before trying again.",
      } satisfies PortalFeedbackState;
    }
    // Announce before revalidation removes the deleted row and its local form.
    if (confirmMessage && result.status === "success") {
      window.dispatchEvent(new CustomEvent("nhs-action-success", { detail: result.message }));
    }
    return result;
  }, initialPortalFeedbackState);
  const [pending, startTransition] = useTransition();
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (resetOnSuccess && feedback.status === "success") formRef.current?.reset();
  }, [feedback, resetOnSuccess]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || (lockOnSuccess && feedback.status === "success")) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;
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
    <form ref={formRef} className={className} style={style} onSubmit={handleSubmit} aria-busy={pending}>
      <fieldset className="portal-action-fields" disabled={pending || (lockOnSuccess && feedback.status === "success")}>
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
