// Bounded, evidence-first industry audit of the already-fetched homepage.
// No extra site fetches or robots bypass; absence on homepage is NOT proof
// a business lacks a menu, booking or ordering elsewhere on its website.
import type { NicheKey } from "./prospect-scan";

export type IndustryAuditSignal = {
  key: string;
  label: string;
  status: "observed" | "not_observed_on_homepage";
  evidence: string;
};
export type IndustryAudit = {
  version: 1;
  category: NicheKey;
  scope: "homepage_only";
  scanned_at: string;
  signals: IndustryAuditSignal[];
};
type AuditCriterion = {
  key: string;
  label: string;
  href?: RegExp;
  labelPattern?: RegExp;
  text?: RegExp;
};
const COMMON: AuditCriterion[] = [
  { key: "contact_path", label: "Contact link or direct contact action",
    href: /\/(contact|contact-us|reach-us)(?:[/?#]|$)|^(?:mailto:|tel:)/i,
    labelPattern: /\b(contact|call us|email us|reach us)\b/i },
];
const INDUSTRY: Record<NicheKey, AuditCriterion[]> = {
  restaurants: [
    { key: "menu", label: "Menu link", href: /\/menu(?:[/?#.-]|$)|\.pdf(?:[?#]|$)/i,
      labelPattern: /\b(menu|view our menu|food menu)\b/i },
    { key: "reservations", label: "Reservation action", href: /(opentable|resy|reserve|reservation|book-a-table|tock)/i,
      labelPattern: /\b(reservations?|book a table|reserve a table)\b/i },
    { key: "ordering", label: "Online-ordering action", href: /(order|doordash|ubereats|toasttab|chownow)/i,
      labelPattern: /\b(order online|online ordering|takeout|pickup|delivery)\b/i },
  ],
  bars: [
    { key: "menu", label: "Drink or food menu link", href: /\/menu(?:[/?#.-]|$)/i,
      labelPattern: /\b(drinks? menu|food menu|cocktails? menu|view menu)\b/i },
    { key: "events", label: "Events or entertainment link", href: /\/(events?|live-music|calendar)(?:[/?#]|$)/i,
      labelPattern: /\b(live music|events calendar|upcoming events)\b/i },
    { key: "hours", label: "Hours shown on homepage", text: /\b(opening hours|hours of operation|business hours|mon(?:day)?\s*[-:]\s*(?:fri|friday)|happy hour)\b/i },
  ],
  cafes: [
    { key: "menu", label: "Cafe menu link", href: /\/menu(?:[/?#.-]|$)/i, labelPattern: /\b(menu|drinks menu)\b/i },
    { key: "ordering", label: "Pickup or ordering link", href: /(order|toasttab|squareup|pickup)/i, labelPattern: /\b(order online|order ahead|pickup)\b/i },
    { key: "hours", label: "Hours shown on homepage", text: /\b(opening hours|business hours|hours of operation)\b/i },
  ],
  salons: [
    { key: "booking", label: "Appointment booking action", href: /(book|booking|appointment|vagaro|fresha|glossgenius|styleseat)/i,
      labelPattern: /\b(book now|book online|book appointment|schedule appointment)\b/i },
    { key: "services", label: "Services or pricing link", href: /\/(services|pricing|price-list)(?:[/?#]|$)/i, labelPattern: /\b(our services|services and pricing|price list)\b/i },
    { key: "portfolio", label: "Work gallery link", href: /\/(gallery|portfolio|our-work)(?:[/?#]|$)/i,
      labelPattern: /\b(gallery|our work|before and after|portfolio)\b/i },
  ],
  contractors: [
    { key: "estimate", label: "Estimate or quote action", href: /(quote|estimate|consultation)/i,
      labelPattern: /\b(get a quote|free estimate|request a quote|request an estimate)\b/i },
    { key: "services", label: "Services link", href: /\/services?(?:[/?#]|$)/i, labelPattern: /\b(our services|services we offer)\b/i },
    { key: "area", label: "Service area mentioned on homepage",
      text: /\b(areas? we serve|serving the|service areas?|locations? served)\b/i },
  ],
  auto_repair: [
    { key: "appointment", label: "Service appointment action", href: /(appointment|booking|schedule-service)/i,
      labelPattern: /\b(schedule service|book appointment|request appointment)\b/i },
    { key: "services", label: "Repair services link", href: /\/services?(?:[/?#]|$)/i,
      labelPattern: /\b(repair services|our services)\b/i },
    { key: "hours", label: "Hours shown on homepage", text: /\b(opening hours|business hours|hours of operation)\b/i },
  ],
  fitness: [
    { key: "classes", label: "Classes or schedule link", href: /(classes|class-schedule|timetable)/i,
      labelPattern: /\b(class schedule|view classes|our classes)\b/i },
    { key: "membership", label: "Membership or pricing link", href: /(membership|pricing|plans)/i,
      labelPattern: /\b(membership|join now|pricing)\b/i },
    { key: "booking", label: "Class or session booking action", href: /(book|schedule|reserve)/i,
      labelPattern: /\b(book a class|schedule a session|reserve a spot)\b/i },
  ],
};

/** Restrict inspection to visible text and navigation labels, not JS bundles.
 * Never persist raw customer homepage HTML in our Supabase prospect data.
 */
export function auditIndustryHomepage(
  category: NicheKey, html: string, scannedAt = new Date().toISOString(),
): IndustryAudit {
  const safe = html.slice(0, 1_500_000)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<!--[^]*?-->/g, "");
  const actions = [...safe.matchAll(/<a\b([^>]*?)>([\s\S]*?)<\/a\s*>/gi)]
    .slice(0, 250)
    .map(m => ({
      href: (m[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] ?? "").slice(0, 500),
      text: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140),
    }));
  const visible = safe.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 100000);
  const signals = [...COMMON, ...INDUSTRY[category]].map(criterion => {
    const found = actions.some(a =>
      Boolean(criterion.href?.test(a.href) || criterion.labelPattern?.test(a.text)),
    ) || Boolean(criterion.text?.test(visible));
    return {
      key: criterion.key,
      label: criterion.label,
      status: found ? "observed" as const : "not_observed_on_homepage" as const,
      evidence: found ? "Action or text detected on homepage" :
        "Not observed on the homepage; may exist on another page. Review manually.",
    };
  });
  return { version: 1, category, scope: "homepage_only", scanned_at: scannedAt, signals };
}
