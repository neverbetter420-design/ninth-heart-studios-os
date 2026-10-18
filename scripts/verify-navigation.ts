// Structural UI regression checks: no credentials, network access or database writes.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(join(root, file), "utf8");
const exists = (file: string) => existsSync(join(root, file));

const navEntries = [...read("lib/nav.ts").matchAll(
  /\{\s*href:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*icon:\s*"[^"]+",\s*section:\s*"([^"]+)",\s*roles:\s*\[([^\]]+)\]/g,
)].map((match) => ({
  href: match[1],
  label: match[2],
  section: match[3],
  roles: [...match[4].matchAll(/"(admin|client)"/g)].map((m) => m[1]),
}));

assert.ok(navEntries.length >= 19, "expected admin and client navigation destinations");
assert.equal(new Set(navEntries.map((item) => item.href)).size, navEntries.length, "navigation hrefs must be unique");
assert.ok(navEntries.filter((item) => item.roles.includes("admin")).length >= 11);
assert.ok(navEntries.filter((item) => item.roles.includes("client")).length >= 7);

for (const item of navEntries) {
  assert.ok(item.label && item.section, "every navigation item needs a label and section");
  assert.equal(item.roles.length, 1, item.href + " must belong to one role");
  if (item.roles[0] === "client") {
    assert.ok(item.href.startsWith("/portal"), "client navigation exposes an admin page");
  } else {
    assert.ok(!item.href.startsWith("/portal"), "admin navigation includes a client page");
  }
  const route = item.href === "/"
    ? "app/(protected)/(admin)/page.tsx"
    : item.href.startsWith("/portal")
      ? "app/(protected)" + item.href + "/page.tsx"
      : "app/(protected)/(admin)" + item.href + "/page.tsx";
  assert.ok(exists(route), "missing page for nav href " + item.href);
}

const sidebar = read("components/Sidebar.tsx");
for (const item of [
  'aria-label={open ? "Close navigation" : "Open navigation"}',
  'aria-expanded={open}',
  'aria-controls="nhs-sidebar"',
  'className="navigation-backdrop"',
  'event.key === "Escape"',
  'onClick={() => setOpen(false)}',
  'aria-current={active ? "page" : undefined}',
  'action="/auth/sign-out"',
]) {
  assert.ok(sidebar.includes(item), "missing navigation behavior " + item);
}

const styles = read("app/navigation.css");
assert.ok(styles.includes("@media (max-width: 860px)"), "missing mobile navigation breakpoint");
assert.ok(styles.includes(".nhs-sidebar.is-open"), "missing open drawer state");
assert.ok(styles.includes("overflow-y: auto"), "desktop sidebar must scroll");
assert.ok(styles.includes(".action-row .ghost-button { display: inline-flex"), "mobile lead action missing");
assert.ok(read("app/layout.tsx").includes('import "./navigation.css";'), "navigation styles must load");

const resource = read("components/portal/PortalResourcePage.tsx");
assert.ok(resource.includes('profile.role !== "client"'), "client resources require role protection");
for (const item of [
  ["messages", "messages"],
  ["files", "files"],
  ["approvals", "approvals"],
  ["contracts", "contracts"],
  ["forms", "form_submissions"],
]) {
  const page = read("app/(protected)/portal/" + item[0] + "/page.tsx");
  assert.ok(page.includes('kind="' + item[0] + '"'), "missing controller for " + item[0]);
  assert.ok(resource.includes('supabase.from("' + item[1] + '")'), "missing query for " + item[0]);
}

const detail = read("app/(protected)/portal/projects/[projectId]/page.tsx");
for (const id of ["milestones", "pending-approvals", "approvals", "files", "contracts", "forms", "messages"]) {
  assert.ok(detail.includes('id="' + id + '"'), "missing detail anchor " + id);
}
// Nocturne / Atelier role-specific navigation and progressive disclosure.
const appShell = read("components/AppShell.tsx");
const nocturneStyles = read("app/nocturne.css");
const portalHome = read("app/(protected)/portal/page.tsx");
assert.ok(read("app/layout.tsx").includes('import "./nocturne.css";'), "Nocturne theme must load last");
assert.ok(appShell.includes('nhs-theme-client') && appShell.includes('nhs-theme-admin'), "role-scoped themes required");
assert.ok(appShell.includes('action="/auth/sign-out"'), "visible desktop sign out required");
assert.ok(sidebar.includes('className="nhs-mobile-sign-out"'), "visible mobile sign out required");
assert.ok(portalHome.includes('className="atelier-hero"'), "Atelier client welcome required");
assert.ok(portalHome.includes('className="atelier-action-panel"'), "client next action required");
assert.ok(portalHome.includes('href="/portal/messages"'), "messaging must remain linked");
assert.ok(portalHome.includes('href="/portal/files"'), "project files must remain linked");
assert.ok(detail.includes('className="atelier-project-nav"'), "client project destination navigation required");
assert.ok(detail.includes('className="atelier-disclosure"'), "client detail progressive disclosure required");
assert.ok(nocturneStyles.includes("prefers-reduced-motion"), "accessible reduced motion required");
assert.ok(navEntries.some((x) => x.href === "/portal/forms" && x.section === "Decisions & documents"), "client paperwork grouped in navigation");
const dashboard = read("components/Dashboard.tsx");
assert.ok(dashboard.includes('className="nocturne-insights"'), "optional admin intelligence should be progressive disclosure");
const adminProject = read("app/(protected)/(admin)/projects/[projectId]/page.tsx");
assert.ok(adminProject.includes('className="nocturne-workspace-focus"'), "admin priorities must be visible in focused work area");
assert.ok(adminProject.includes('id="workspace-collaboration"'), "project creative collaboration section required");
assert.ok(adminProject.includes('id="workspace-delivery"'), "project delivery and activity section required");

assert.ok(dashboard.includes('href={"/projects/" + project.id}'), "project cards should link to workspace");
assert.ok(dashboard.includes('href={"/opportunities/" + item.id}'), "radar cards should link to opportunity");
assert.ok(!read("components/PageHeader.tsx").includes('<button className="primary-button">'), "dead heading button present");
assert.ok(!read("components/ModulePage.tsx").includes('<button className="text-button">'), "dead prototype button present");

for (const routeFile of [
  "app/(protected)/loading.tsx",
  "app/(protected)/error.tsx",
  "app/(protected)/not-found.tsx",
]) {
  assert.ok(exists(routeFile), "missing workspace recovery route: " + routeFile);
}
assert.ok(read("app/(protected)/error.tsx").includes("onClick={() => reset()}"), "retry action missing");
assert.ok(read("app/(protected)/loading.tsx").includes('aria-busy="true"'), "loading status inaccessible");
assert.ok(read("app/(protected)/not-found.tsx").includes('href="/"'), "not found recovery link missing");
const actionForm = read("components/portal/PortalActionForm.tsx");
assert.ok(actionForm.includes("useActionState"), "portal action state required");
assert.ok(actionForm.includes("useTransition"), "pending state required");
assert.ok(actionForm.includes("setAttempted(true)"), "feedback must not appear before submission");
assert.ok(actionForm.includes("event.nativeEvent as SubmitEvent"), "approval submitter must be captured");
for (const route of [
  "app/(protected)/portal/projects/[projectId]/page.tsx",
  "components/portal/ContractSign.tsx",
  "components/portal/FormFill.tsx",
]) assert.ok(read(route).includes("PortalActionForm"), "missing action feedback in " + route);
for (const actionFile of [
  "app/(protected)/portal/projects/[projectId]/actions.ts",
  "app/(protected)/portal/contracts/actions.ts",
  "app/(protected)/portal/forms/actions.ts",
]) {
  const code = read(actionFile);
  assert.ok(code.includes('status: "success"') && code.includes('status: "error"'), "truthful outcome missing: " + actionFile);
}
// Admin read/write UI regressions: never show success on a rejected record update.
for (const actionFile of [
  "app/(protected)/(admin)/clients/actions.ts",
  "app/(protected)/(admin)/projects/actions.ts",
  "app/(protected)/(admin)/leads/actions.ts",
]) {
  const actionCode = read(actionFile);
  assert.ok(actionCode.includes('status: "success"') && actionCode.includes('status: "error"'), "missing confirmed admin action state for " + actionFile);
}
for (const [component, actionName] of [
  ["app/(protected)/(admin)/clients/page.tsx", "setClientStatusWithFeedback"],
  ["components/projects/PipelineBoard.tsx", "moveProjectWithFeedback"],
  ["components/projects/ProjectOverview.tsx", "updateProjectDetailsWithFeedback"],
  ["components/projects/TaskSection.tsx", "setTaskStatusWithFeedback"],
  ["components/leads/QuickOutcomeButtons.tsx", "logLeadOutcomeWithFeedback"],
]) {
  assert.ok(read(component).includes(actionName), "unwired admin action feedback: " + component);
}
assert.ok(read("components/portal/PortalActionForm.tsx").includes("lockOnSuccess = true"), "repeatable admin actions need unlock support");
for (const component of [
  "components/leads/LeadCaptureCard.tsx",
  "app/(protected)/(admin)/clients/page.tsx",
  "app/(protected)/(admin)/projects/page.tsx",
  "app/(protected)/(admin)/leads/[leadId]/page.tsx",
]) {
  assert.ok(read(component).includes("PortalSubmitButton"), "missing pending button for admin redirect action: " + component);
}
console.log("verify:navigation — role separation, routes, mobile drawer, client destinations and action links passed.");
