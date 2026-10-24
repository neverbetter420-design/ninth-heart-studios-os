import { test, expect } from "@playwright/test";

// Safety contract: browser tests must never submit data-changing forms or
// create/update/delete real customer data. Both local and live targets are
// read-only. Credentials, when configured, come from GitHub Actions secrets.
const users = {
  admin: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD },
  clientA: { email: process.env.E2E_CLIENT_A_EMAIL, password: process.env.E2E_CLIENT_A_PASSWORD },
  clientB: { email: process.env.E2E_CLIENT_B_EMAIL, password: process.env.E2E_CLIENT_B_PASSWORD },
};
const authReady = (user) => Boolean(user.email && user.password);

async function signIn(page, user) {
  await page.goto("/auth/sign-in");
  await expect(page.getByRole("heading", { name: "Enter NHS OS" })).toBeVisible();
  await page.locator('input[name="email"]').fill(user.email);
  const password = page.locator('input[name="password"]');
  await password.fill(user.password);
  // A browser-side login length restriction blocks form submission without an auth request.
  // Do not print credential values, lengths or email addresses in CI logs.
  const blocked = await password.evaluate((element) => element.validity.tooShort);
  if (blocked) {
    throw new Error("LIVE RELEASE MISMATCH: this sign-in page rejected an existing test password before submission. Deploy the separately approved login fix before live acceptance.");
  }
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/auth\/(?:sign-in|unauthorized)/, { timeout: 25_000 });
  await expect(page.locator(".navigation-shell")).toBeVisible();
}

async function openNavigation(page, isMobile) {
  if (isMobile) {
    const open = page.getByRole("button", { name: "Open navigation" });
    await expect(open).toBeVisible();
    await open.click();
    await expect(page.getByRole("button", { name: "Close navigation" }).first()).toBeVisible();
  }
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(nav).toBeVisible();
  return nav;
}

async function visitNav(page, isMobile, label, pathname) {
  const nav = await openNavigation(page, isMobile);
  // Admin nav groups may be collapsed in Nocturne. Expand the group
  // containing the requested destination before testing the link itself.
  const item = nav.locator(`a.nav-link[href="${pathname}"]`);
  await expect(item).toHaveAttribute("href", pathname);
  if (!(await item.isVisible())) {
    const group = nav.locator(".nav-section").filter({ has: page.locator(`a.nav-link[href="${pathname}"]`) });
    const toggle = group.locator(".nav-section-toggle");
    await expect(toggle).toBeVisible();
    await toggle.click();
  }
  await expect(item).toBeVisible();
  await item.click();
  await expect(page).toHaveURL(new RegExp(pathname === "/" ? "/$" : pathname.replaceAll("/", "\\/") + "$"));
  await expect(page.locator("main h2").first()).toBeVisible();
  if (isMobile) {
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  }
}

test("public sign-in page loads and has usable controls", async ({ page }) => {
  await page.goto("/auth/sign-in");
  await expect(page.getByRole("heading", { name: "Enter NHS OS" })).toBeVisible();
  await expect(page.locator('input[name="email"]')).toBeVisible();
  const password = page.locator('input[name="password"]');
  await expect(password).toBeVisible();
  // Sign-in must not reject legitimate existing short passwords in browser validation.
  // Strength rules apply when setting/changing a password, not when authenticating.
  await expect(password).not.toHaveAttribute("minlength");
  await password.fill("legacy8!");
  expect(await password.evaluate((element) => element.validity.tooShort)).toBe(false);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/auth/forgot-password");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/auth\/forgot-password/);
  await expect(page.locator("main")).toBeVisible();
});

test("anonymous users cannot access admin dashboard or client portal", async ({ page }) => {
  // Guard nested destinations as well as the two home pages.
  for (const path of [
    "/", "/leads", "/leads/discover", "/projects", "/clients",
    "/portal", "/portal/projects", "/portal/messages", "/portal/files",
    "/portal/approvals", "/portal/documents",
  ]) {
    await page.goto(path);
    await expect(page, `Anonymous access to ${path} must redirect`).toHaveURL(/\/auth\/sign-in/);
  }
});

test("admin navigation loads each section (read-only)", async ({ page, isMobile }) => {
  test.skip(!authReady(users.admin), "Configure E2E_ADMIN_EMAIL/PASSWORD GitHub Actions secrets to enable authenticated tests");
  await signIn(page, users.admin);
  for (const [label, route] of [
    ["Command Center", "/"],
    ["Lead Intelligence", "/leads"],
    ["Lead Scanner", "/leads/discover"],
    ["Opportunity Radar", "/opportunities"],
    ["Project Pipeline", "/projects"],
    ["Client Management", "/clients"],
    ["Contracts", "/contracts"],
    ["Text templates", "/templates"],
    ["Fillable Forms", "/forms"],
    ["Muse", "/muse"],
    ["Automations", "/automations"],
    ["Settings", "/settings"],
  ]) {
    await test.step(label, () => visitNav(page, isMobile, label, route));
  }
  await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "My Projects" })).toHaveCount(0);
});

for (const key of ["clientA", "clientB"]) {
  test(key + " portal navigation loads every section (read-only)", async ({ page, isMobile }) => {
    const user = users[key];
    test.skip(!authReady(user), "Configure E2E_" + key.toUpperCase() + "_EMAIL/PASSWORD GitHub Actions secrets");
    await signIn(page, user);
    for (const [label, route] of [
      ["Home", "/portal"],
      ["My Projects", "/portal/projects"],
      ["Messages", "/portal/messages"],
      ["Files", "/portal/files"],
      ["Approvals", "/portal/approvals"],
      ["Documents", "/portal/documents"],
    ]) {
      await test.step(label, () => visitNav(page, isMobile, label, route));
    }
    // Consolidated Documents navigation must preserve full contracts/forms routes
    // without cluttering the sidebar with two additional primary links.
    await page.goto("/portal/documents");
    await expect(page.getByRole("heading", { name: "Everything in writing." })).toBeVisible();
    await expect(page.getByRole("link", { name: /Contracts/ })).toHaveAttribute("href", "/portal/contracts");
    await expect(page.getByRole("link", { name: /Forms/ })).toHaveAttribute("href", "/portal/forms");
    // Clients must never have a menu entry to the admin lead console.
    const nav = await openNavigation(page, isMobile);
    await expect(nav.getByRole("link", { name: "Lead Intelligence" })).toHaveCount(0);
    await page.goto("/clients");
    await expect(page).toHaveURL(/\/portal/);
  });
}

test("client B cannot open client A's private project", async ({ browser, baseURL }) => {
  test.skip(!authReady(users.clientA) || !authReady(users.clientB), "Both client accounts required for browser isolation test");
  const contextA = await browser.newContext({ baseURL });
  const contextB = await browser.newContext({ baseURL });
  try {
    const a = await contextA.newPage();
    await signIn(a, users.clientA);
    await a.goto("/portal/projects");
    const projectLink = a.locator('a[href^="/portal/projects/"]').first();
    await expect(projectLink).toBeVisible();
    const privateHref = await projectLink.getAttribute("href");
    const privateProjectTitle = (await projectLink.locator("xpath=ancestor::article[1]").locator("h3").innerText()).trim();
    expect(privateHref).toBeTruthy();
    expect(privateProjectTitle).toBeTruthy();

    // Client Project details must not navigate into a closed disclosure.
    await a.goto(privateHref);
    const detailsLink = a.getByRole("link", { name: "Project details", exact: true });
    await expect(detailsLink).toHaveAttribute("href", "?section=details#project-details");
    await detailsLink.click();
    await expect(a.locator("details#project-details")).toHaveAttribute("open", "");

    const b = await contextB.newPage();
    await signIn(b, users.clientB);
    await b.goto(privateHref);
    // Our protected not-found screen intentionally avoids disclosing whether
    // an inaccessible project exists. The previous /404|not found/ matcher
    // rejected this correct, security-conscious wording.
    await expect(b.getByRole("heading", { name: "That page isn't available.", exact: true })).toBeVisible();
    await expect(b.getByRole("heading", { name: privateProjectTitle, exact: true })).toHaveCount(0);
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
