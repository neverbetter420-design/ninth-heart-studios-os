/**
 * A reset link needs its own recovery context. An ordinary logged-in session
 * must not, by itself, put the password-recovery form into a ready state.
 */
export function isPasswordRecoveryReturn(url: URL): boolean {
  if (url.searchParams.has("error") || new URLSearchParams(url.hash.slice(1)).has("error")) {
    return false;
  }

  const fragment = new URLSearchParams(url.hash.slice(1));
  return (
    url.searchParams.get("recovery") === "1" ||
    fragment.get("type") === "recovery" ||
    url.searchParams.has("code")
  );
}

export type ResetRequestFailure = {
  status?: number;
  code?: string;
};

/**
 * Prefer a helpful but account-neutral response. Auth never reveals whether an
 * email exists, including when requests are throttled or the mailer is down.
 */
export function passwordResetErrorMessage(failure?: ResetRequestFailure): string {
  if (
    failure?.status === 429 ||
    failure?.code === "over_email_send_rate_limit" ||
    failure?.code === "over_request_rate_limit"
  ) {
    return "Too many reset attempts. Please wait before requesting another link.";
  }

  return "Password reset email could not be requested right now. Please try again later or contact the studio.";
}

export function passwordRecoveryRedirectUrl(appUrl: string): string {
  const appOrigin = new URL(appUrl).origin;
  return new URL("/auth/reset-password?recovery=1", appOrigin).toString();
}
