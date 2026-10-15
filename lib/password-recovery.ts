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

export function passwordRecoveryRedirectUrl(appUrl: string): string {
  const appOrigin = new URL(appUrl).origin;
  return new URL("/auth/reset-password?recovery=1", appOrigin).toString();
}
