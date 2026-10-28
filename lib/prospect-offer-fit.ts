// Suggested NHS services are questions for owner review, never sales promises.
// Homepage absence is not proof a business lacks a service elsewhere.
import { categoryBucket } from "./prospect-curation.ts";
import type { WebsiteSignals } from "./prospect-scan.ts";

export type OfferFit = {
  key: string;
  title: string;
  kind: "service" | "package" | "consultation";
  basis: "homepage_review" | "discovery";
  reason: string;
  draft_angle: string | null;
};
const CONSULTATION: OfferFit = {
  key: "consultation",
  title: "Free Website Consultation",
  kind: "consultation",
  basis: "discovery",
  reason: "No specific, substantiated service need can be established from the available public evidence. Confirm priorities directly with the business.",
  draft_angle: null,
};
export function suggestNhsOffers(
  category: string | null,
  website: string | null,
  signals: Partial<WebsiteSignals> | null | undefined,
  limit = 2,
): OfferFit[] {
  const cap = Number.isInteger(limit) ? Math.max(1, Math.min(3, limit)) : 2;
  if (!website || !signals?.has_website || !signals.reachable) return [CONSULTATION];

  const niche = categoryBucket(category);
  const audit = signals.industry_audit?.scope === "homepage_only" &&
    signals.industry_audit.category === niche ? signals.industry_audit : null;
  const notObserved = new Set(
    audit?.signals.filter(s => s.status === "not_observed_on_homepage").map(s => s.key) ?? [],
  );
  const offers: OfferFit[] = [];
  const add = (offer: OfferFit) => {
    if (!offers.some(p => p.key === offer.key)) offers.push(offer);
  };
  const multiSignalReview = signals.mobile_viewport === false &&
    (signals.title_ok === false || signals.description_ok === false);
  if (multiSignalReview) {
    const venue = niche === "restaurants" || niche === "bars" || niche === "cafes";
    add({
      key: venue ? "tavern-key" : "website-redesign",
      title: venue ? "The Tavern Key" : "Website Redesign",
      kind: venue ? "package" : "service",
      basis: "homepage_review",
      reason: "More than one homepage setup clue deserves a hands-on website review. A missing viewport declaration or metadata is not proof the experience is broken.",
      draft_angle: "A practical next step could be reviewing the site's mobile layout and page information together before deciding whether a redesign makes sense.",
    });
  }
  if (["restaurants", "bars", "cafes"].includes(niche) && notObserved.has("menu")) add({
    key: "menu-setup", title: "Menu Setup", kind: "service", basis: "homepage_review",
    reason: "A menu action was not detected on the homepage checked. A menu may still be available elsewhere; confirm before recommending changes.",
    draft_angle: "I couldn't confirm a menu action on the homepage checked, though it might be elsewhere. We could review how easily customers find it.",
  });
  if (["restaurants", "cafes"].includes(niche) && notObserved.has("ordering")) add({
    key: "online-ordering", title: "Online Ordering Setup", kind: "service",
    basis: "homepage_review",
    reason: "An ordering action was not observed on the homepage. The business may already use phone, in-person, or third-party ordering.",
    draft_angle: "If online ordering matters to your business, we could review how clearly customers can find the existing options.",
  });
  if ((niche === "restaurants" && notObserved.has("reservations")) ||
      (niche === "salons" && notObserved.has("booking")) ||
      (niche === "auto_repair" && notObserved.has("appointment")) ||
      (niche === "fitness" && notObserved.has("booking")) ||
      (niche === "contractors" && notObserved.has("estimate"))) add({
    key: "booking-form", title: "Booking / Form Setup", kind: "service",
    basis: "homepage_review",
    reason: "A booking, appointment, or inquiry action was not observed on the homepage; this is not evidence that an existing system is absent.",
    draft_angle: "We could check how straightforward it is for visitors to book or send an inquiry, including any existing system you already use.",
  });
  if ((signals.description_ok === false || signals.title_ok === false) &&
      !offers.some(o => o.key === "tavern-key" || o.key === "website-redesign")) add({
    key: "seo-boost", title: "Basic SEO Boost", kind: "service",
    basis: "homepage_review",
    reason: "The homepage HTML did not show one or more standard title/description signals. This is not a ranking, traffic, or performance diagnosis.",
    draft_angle: "A quick review of the homepage's search title and description could be a useful starting point, without guessing at your search performance.",
  });
  return offers.length ? offers.slice(0, cap) : [CONSULTATION];
}
