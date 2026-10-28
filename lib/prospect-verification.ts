// Public-evidence lineage only. This does NOT verify the legal existence of a
// business, phone ownership, licensing, or that a directory is up-to-date.
import type { SocialProfile, WebsiteSignals } from "./prospect-scan.ts";

export type VerificationEvidence = {
  key: string;
  label: string;
  source: "directory" | "website" | "social";
  status: "listed" | "observed" | "corroborated" | "unconfirmed";
  detail: string;
  observed_at: string;
  source_url?: string;
};
export type BusinessVerification = {
  version: 1;
  status: "corroborated" | "listed_only" | "needs_review";
  checked_at: string;
  evidence: VerificationEvidence[];
};
export type VerificationInput = {
  source_ref?: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
};

function directoryLink(sourceRef: string | null | undefined): string | null {
  const m = /^(node|way|relation):([1-9]\d{0,19})$/.exec(sourceRef ?? "");
  return m ? "https://www.openstreetmap.org/" + m[1] + "/" + m[2] : null;
}

/** Defensive re-validation before surfacing saved evidence as a link in the UI.
 * Never trust a URL merely because it came from a stored signals JSON field.
 */
export function safeVerificationLink(e: VerificationEvidence): string | null {
  if (!e.source_url || e.source_url.length > 2048) return null;
  try {
    const u = new URL(e.source_url);
    if (!["http:", "https:"].includes(u.protocol) ||
      u.username || u.password || u.port || u.hostname.includes(":")) return null;
    const host = u.hostname.toLowerCase().replace(/\.$/, "");
    if (e.source === "directory") {
      return u.protocol === "https:" && host === "www.openstreetmap.org" &&
        /^\/(node|way|relation)\/[1-9]\d{0,19}$/.test(u.pathname)
        ? u.origin + u.pathname : null;
    }
    if (e.source === "social") {
      const allowed = ["www.instagram.com", "www.facebook.com"];
      if (u.protocol !== "https:" || !allowed.includes(host)) return null;
      if (u.pathname === "/profile.php") {
        const id = u.searchParams.get("id");
        return host === "www.facebook.com" && id && /^\d+$/.test(id)
          ? u.origin + "/profile.php?id=" + id : null;
      }
      if (!/^\/[a-z0-9._-]+\/$/i.test(u.pathname)) return null;
      const reserved = ["login", "checkpoint", "accounts", "explore", "p", "reels", "reel",
        "share", "sharer", "dialog", "watch", "events", "groups"];
      if (reserved.includes(u.pathname.split("/")[1].toLowerCase())) return null;
      return u.origin + u.pathname;
    }
    if (!host.includes(".") ||
      /^(?:localhost|.*\.local|.*\.internal|.*\.test|.*\.invalid)$/i.test(host) ||
      /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return null;
    u.hash = "";
    return u.toString();
  } catch { return null; }
}

export function buildBusinessVerification(
  input: VerificationInput,
  signals: Partial<WebsiteSignals>,
  checkedAt: string,
): BusinessVerification {
  const evidence: VerificationEvidence[] = [];
  const common = { source: "directory" as const, status: "listed" as const, observed_at: checkedAt };
  const listingUrl = directoryLink(input.source_ref);
  if (input.name.trim()) evidence.push({
    ...common, key: "identity", label: "Business name listed",
    detail: "A public directory lists this name; ownership has not been independently confirmed.",
    ...(listingUrl ? { source_url: listingUrl } : {}),
  });
  if (input.address?.trim()) evidence.push({
    ...common, key: "address", label: "Address listed",
    detail: "Directory address, not an independently confirmed physical location.",
    ...(listingUrl ? { source_url: listingUrl } : {}),
  });
  if (input.phone?.trim()) evidence.push({
    ...common, key: "phone", label: "Phone listed",
    detail: "Directory phone number; whether it is current or owned by this business is unconfirmed.",
    ...(listingUrl ? { source_url: listingUrl } : {}),
  });
  if (signals.has_website && input.website && signals.reachable) evidence.push({
    key: "website", label: "Website URL reachable", source: "website",
    status: "observed", observed_at: checkedAt,
    detail: "The linked homepage responded with HTML; reachability alone does not establish business identity.",
    source_url: input.website,
  });
  else if (input.website) evidence.push({
    key: "website", label: "Website needs review", source: "website",
    status: "unconfirmed", observed_at: checkedAt,
    detail: "A website was listed, but the homepage check was inconclusive.",
  });
  const profiles: SocialProfile[] = Array.isArray(signals.social_profiles) ? signals.social_profiles.slice(0, 2) : [];
  for (const profile of profiles) {
    if (profile.platform !== "instagram" && profile.platform !== "facebook") continue;
    const matched = profile.status === "matched";
    const item: VerificationEvidence = {
      key: "social-" + profile.platform,
      label: (profile.platform === "instagram" ? "Instagram" : "Facebook") +
        (matched ? " identity corroboration" : " profile unconfirmed"),
      source: "social", status: matched ? "corroborated" : "unconfirmed",
      observed_at: signals.social_checked_at ?? checkedAt,
      detail: matched
        ? "Public profile matched the business name and phone or location at check time; not proof of ownership."
        : "No sufficiently corroborated public profile identity; review manually.",
      ...(profile.url ? { source_url: profile.url } : {}),
    };
    // A saved or manually submitted social URL is not automatically trusted.
    evidence.push({ ...item, ...(safeVerificationLink(item) ? {} : { source_url: undefined }) });
  }
  const matched = evidence.some(e => e.status === "corroborated");
  const uncertain = evidence.some(e => e.status === "unconfirmed");
  return { version: 1, checked_at: checkedAt,
    status: matched ? "corroborated" : uncertain ? "needs_review" : "listed_only",
    evidence: evidence.slice(0, 7),
  };
}
