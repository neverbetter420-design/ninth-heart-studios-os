import { test, expect } from "@playwright/test";
import { previewCSS, renderNocturne } from "../helpers/nocturne-render.mjs";

// Actual page/shell markup, synthetic reads only. All network traffic is denied.
async function show(page, role, scenario = "normal", view = "home", section = "") {
  await page.route("**/*", (route) => route.abort());
  const { html } = await renderNocturne(role, scenario, view, section);
  await page.setContent(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`);
  await page.addStyleTag({ content: previewCSS });
  await page.evaluate(() => document.fonts.ready);
}
async function contrast(locator, backgroundSelector) {
  return locator.evaluate((el, selector) => {
    const rgb = (color) => color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = (values) => values.map((n) => { n /= 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
    const a = luminance(rgb(getComputedStyle(el).color));
    const b = luminance(rgb(getComputedStyle(selector ? el.closest(selector) : el).backgroundColor));
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  }, backgroundSelector);
}

test("Muse keeps focus, drafting and saved work separate across narrow screens", async ({ page }) => {
  test.setTimeout(90000);
  for (const scenario of ["normal", "long", "empty", "error", "risk-error", "drafts-error", "preview", "invalid-target", "email-configured", "risk-order"]) {
    await show(page, "admin", scenario, "muse");
    const saved = page.locator("details.studio-saved-draft").first();
    if (await saved.count()) await saved.locator(":scope > summary").press("Enter");
    if (scenario === "email-configured") {
      await saved.locator(".studio-send > summary").press("Enter");
      await expect(saved.getByLabel("Recipient address", { exact: true })).toBeVisible();
      await expect(saved.getByRole("button", { name: "Confirm send", exact: true })).toBeVisible();
    } else await expect(page.locator(".studio-send")).toHaveCount(0);
    for (const width of [1440, 1024, 860, 620, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `Muse ${scenario} at ${width}px`).toBeLessThanOrEqual(width);
    }
    await expect(page.getByLabel("Draft kind", { exact: true })).toHaveValue("follow_up");
    if (scenario === "empty") await expect(page.getByRole("button", { name: "Generate draft", exact: true })).toBeDisabled();
    if (["error", "risk-error"].includes(scenario)) {
      await expect(page.getByRole("region", { name: "Top recommendation" })).toContainText("picture is incomplete");
      await expect(page.getByRole("link", { name: "Take the next step" })).toHaveCount(0);
    }
    if (scenario === "risk-order") await expect(page.getByRole("region", { name: "Top recommendation" })).toContainText("Unblock Critical project");
    if (scenario === "drafts-error") await expect(page.getByRole("region", { name: "Saved drafts", exact: true })).toContainText("Saved drafts could not load");
    if (scenario === "invalid-target") {
      await expect(page.getByRole("button", { name: "Save draft", exact: true })).toHaveCount(0);
      await expect(page.getByRole("alert")).toContainText("draft target is unavailable");
    }
    if (["preview", "long"].includes(scenario)) {
      await expect(page.getByLabel("Draft text", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Target", { exact: true })).toHaveValue("lead:synthetic-muse-lead");
      await page.getByLabel("Draft text", { exact: true }).fill("A revised synthetic draft.");
      const button = page.getByRole("button", { name: "Save draft", exact: true });
      await button.scrollIntoViewIfNeeded(); await button.focus();
      expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
      expect(await button.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
    }
    await page.getByRole("navigation", { name: "Muse destinations" }).getByRole("link", { name: "Saved drafts", exact: true }).click();
    await expect(page.locator("#muse-saved h3")).toBeInViewport();
  }
});

test("Settings distinguishes read checks, configuration presence and manual releases", async ({ page }) => {
  for (const scenario of ["normal", "long", "error", "email-configured"]) {
    await show(page, "admin", scenario, "settings");
    for (const width of [1440, 1024, 860, 620, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `Settings ${scenario} at ${width}px`).toBeLessThanOrEqual(width);
    }
    const services = page.getByRole("region", { name: "Connections", exact: true });
    await expect(services).toContainText(scenario === "error" ? "Read check unavailable" : "Read check passed");
    await expect(services).toContainText(scenario === "email-configured" ? "Settings present" : "Not configured");
    await expect(services).toContainText("Manual release");
    await expect(services).not.toContainText("Deployed");
    await expect(page.locator('.studio-page input[type="password"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Save|Deploy|Enable/ })).toHaveCount(0);
    await page.getByRole("navigation", { name: "Settings destinations" }).getByRole("link", { name: "Connections", exact: true }).click();
    await expect(page.locator("#studio-connections h3")).toBeInViewport();
  }
});

test("Document directories keep creation, archives, filters and errors readable", async ({ page }) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const view of ["contracts", "forms", "templates"]) {
    for (const scenario of ["populated", "long", "empty", "archived", "filtered", "error", "form-error"]) {
      await show(page, "admin", scenario, view);
      const nav = page.getByRole("navigation", { name: "Document tools" });
      await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
      await expect(nav.getByRole("link")).toHaveCount(3);
      const creators = page.locator(".nocturne-create-panel");
      for (const create of await creators.all()) {
        if (scenario === "form-error") await expect(create).toHaveAttribute("open", "");
        else { await expect(create).not.toHaveAttribute("open", ""); await create.locator("summary").press("Enter"); }
        for (const input of await create.locator("input:not([type=hidden]), select, textarea").all()) {
          expect(await input.evaluate(el => !!el.labels?.length), `${view} has a visible field label`).toBe(true);
          const label = await input.evaluate(el => el.labels[0].querySelector("span").textContent.trim());
          await expect(input).toHaveAccessibleName(label);
        }
      }
      for (const width of [1440, 1024, 860, 620, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `${view} ${scenario} at ${width}px`).toBeLessThanOrEqual(width);
      }
      if (scenario === "error") {
        await expect(page.getByRole("alert").last()).toContainText("could not load");
        await expect(page.locator(".metric-card strong").first()).toHaveText("—");
        await expect(page.locator(".paperwork-row")).toHaveCount(0);
      }
      if (scenario === "archived" && view !== "contracts") {
        await expect(page.locator(".paperwork-row")).toHaveCount(1);
        await expect(page.locator(".paperwork-row > a")).toHaveAttribute("href", new RegExp(`^/${view}/synthetic-`));
        const category = page.getByRole("navigation", { name: view === "forms" ? "Form category" : "Template category" });
        await expect(category.getByRole("link", { name: "Contracts", exact: true })).toHaveAttribute("href", /state=archived/);
      }
      if (scenario === "filtered" && view === "forms") await expect(page.locator(".paperwork-row")).toHaveCount(0);
      const button = creators.first().getByRole("button").first();
      await button.scrollIntoViewIfNeeded();
      expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
      if (await button.isEnabled()) { await button.focus(); expect(await button.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none"); }
    }
  }
});

test("Contract workspaces keep sent terms locked and signature evidence legible", async ({ page }) => {
  for (const scenario of ["normal", "long", "sent", "signed", "voided", "template-choices-error", "opportunity"]) {
    await show(page, "admin", scenario, "contract-detail");
    for (const details of await page.locator(".paperwork-page details").all()) await details.locator("summary").press("Enter");
    for (const width of [1440, 1024, 860, 620, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `contract ${scenario} at ${width}px`).toBeLessThanOrEqual(width);
    }
    const editable = ["normal", "long", "template-choices-error", "opportunity"].includes(scenario);
    await expect(page.getByRole("button", { name: "Save draft", exact: true })).toHaveCount(editable ? 1 : 0);
    await expect(page.getByRole("button", { name: "Send for signature", exact: true })).toHaveCount(editable ? 1 : 0);
    await expect(page.locator('textarea[name="body"]')).toHaveCount(editable ? 1 : 0);
    if (editable) await expect(page.getByLabel("Terms", { exact: true })).toBeVisible();
    if (scenario === "signed") {
      await expect(page.getByRole("region", { name: "Signature audit" })).toContainText("Jamie Morgan");
      await expect(page.locator("#contract-signature code")).toHaveText("a".repeat(64));
      await expect(page.locator(".paperwork-controls")).toHaveCount(0);
    }
    if (scenario === "template-choices-error") await expect(page.getByRole("alert")).toContainText("Text templates could not load");
    if (scenario === "opportunity") {
      await expect(page.getByRole("link", { name: "Open project" })).toHaveCount(0);
      await expect(page.getByRole("region", { name: "Send contract" })).toContainText("Client signing requires a project with portal access");
    } else await expect(page.getByRole("link", { name: "Open project" })).toHaveAttribute("href", "/projects/synthetic-a?section=documents#workspace-resources");
  }
});

test("Form and text editors keep inactive sending, field controls and private references clear", async ({ page }) => {
  test.setTimeout(90000);
  for (const view of ["form-detail", "template-detail"]) {
    const scenarios = view === "form-detail" ? ["normal", "long", "no-fields", "archived", "imported", "source-error", "projects-error", "submissions-error", "quiet"] : ["normal", "long", "archived"];
    for (const scenario of scenarios) {
      await show(page, "admin", scenario, view);
      for (const details of await page.locator(".paperwork-page details").all()) if (!await details.getAttribute("open").then(v => v !== null)) await details.locator("summary").press("Enter");
      for (const width of [1440, 1024, 860, 620, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `${view} ${scenario} at ${width}px`).toBeLessThanOrEqual(width);
      }
      if (view === "form-detail") {
        const send = page.getByRole("region", { name: "Send form", exact: true });
        const disabled = ["archived", "imported", "source-error", "projects-error", "quiet"].includes(scenario);
        if (disabled) await expect(send.getByRole("button", { name: "Send form", exact: true })).toBeDisabled();
        else await expect(send.getByRole("button", { name: "Send form", exact: true })).toBeEnabled();
        await expect(page.getByLabel("Field type", { exact: true })).toHaveValue("text");
        await expect(page.getByLabel("Field type", { exact: true }).locator("option")).toHaveCount(8);
        await expect(page.locator('input[name="template_id"]')).not.toHaveCount(0);
        if (scenario === "imported") {
          await expect(page.getByRole("link", { name: /Brand reference.pdf/ })).toHaveAttribute("target", "_blank");
          await expect(page.getByRole("button", { name: "Activate form", exact: true })).toBeVisible();
        }
        if (scenario === "source-error") await expect(page.getByRole("alert")).toContainText("source PDF link is unavailable");
        if (scenario === "submissions-error") await expect(page.getByRole("alert")).toContainText("Submissions could not load");
        const nav = page.getByRole("navigation", { name: "Form workspace destinations" });
        await nav.getByRole("link", { name: "Fields", exact: true }).click();
        await expect(page.locator("#form-fields h3")).toBeInViewport();
      } else {
        await expect(page.getByRole("button", { name: scenario === "archived" ? "Restore template" : "Archive template", exact: true })).toBeVisible();
        await expect(page.getByLabel("Reusable text", { exact: true })).toHaveValue(/Project scope|UnbrokenTemplateBody/);
      }
    }
  }
});

test("Unavailable document records use recovery boundaries instead of false not-found states", async () => {
  for (const view of ["contract-detail", "form-detail", "template-detail"]) {
    await expect(renderNocturne("admin", "error", view)).rejects.toThrow("could not load");
    await expect(renderNocturne("admin", "empty", view)).rejects.toThrow("Synthetic project not found");
  }
});

test("Client directory and workspaces keep projects and access controls usable", async ({ page }) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const view of ["clients", "client-detail"]) {
    for (const scenario of view === "clients" ? ["normal", "long", "empty", "form-error"] : ["normal", "long", "quiet", "members-error", "error", "archived"]) {
      await show(page, "admin", scenario, view);
      for (const width of [1440, 1024, 860, 620, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `${view} ${scenario} at ${width}px`).toBeLessThanOrEqual(width);
      }
      if (view === "clients") {
        const create = page.locator('details[aria-label="New client"]');
        if (scenario !== "form-error") await create.locator("summary").press("Enter");
        await expect(create.getByLabel("Client / business name")).toBeVisible();
        if (scenario !== "empty") await expect(page.locator(".management-client-row .management-text-link").first()).toHaveAttribute("href", "/clients/synthetic-client");
      } else {
        const email = page.getByLabel("Member's account email");
        if (scenario === "members-error") {
          await expect(email).toBeDisabled();
          await expect(page.getByRole("button", { name: "Add member", exact: true })).toBeDisabled();
          await expect(page.getByRole("alert")).toContainText("Could not load portal members");
          await expect(page.getByRole("button", { name: "Remove", exact: true })).toHaveCount(0);
        } else await expect(email).toBeEnabled();
        if (scenario === "error") await expect(page.getByRole("alert")).toContainText("Projects could not load");
        if (scenario === "archived") {
          await expect(page.getByRole("link", { name: "New project" })).toHaveCount(0);
          await expect(page.getByRole("button", { name: "Restore client" })).toBeVisible();
        }
        await page.getByRole("navigation", { name: "Client workspace destinations" }).getByRole("link", { name: "Portal access" }).click();
        await expect(page.locator("#client-access h3")).toBeInViewport();
      }
    }
  }
});

test("Pipeline keeps real phases, bounded progress and move controls in view", async ({ page }) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const scenario of ["populated", "long", "stages", "empty", "error", "context", "form-error", "client-choices-error"]) {
    await show(page, "admin", scenario, "pipeline");
    for (const width of [1440, 1024, 860, 620, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${scenario} pipeline at ${width}px`).toBeLessThanOrEqual(width);
    }
    const create = page.locator('details[aria-label="New project"]');
    if (["context", "form-error"].includes(scenario)) await expect(create).toHaveAttribute("open", "");
    if (scenario === "context") await expect(create.getByLabel("Client", { exact: true })).toHaveValue("synthetic-client");
    if (scenario === "client-choices-error") {
      await create.locator("summary").press("Enter");
      await expect(create.getByRole("button", { name: "Create project" })).toBeDisabled();
      await expect(create.getByRole("alert")).toContainText("Client choices could not load");
    }
    if (scenario === "error") {
      await expect(page.getByRole("alert")).toContainText("Project data could not load");
      await expect(page.locator(".pipeline-board")).toHaveCount(0);
      await expect(page.locator(".metric-card strong").first()).toHaveText("—");
    }
    if (scenario === "stages") {
      await expect(page.locator(".pipeline-phase")).toHaveCount(9);
      await expect(page.locator("#phase-unassigned")).toContainText("Sample legacy_phase project");
      await expect(page.locator("#phase-discovery")).not.toContainText("legacy_phase");
      await expect(page.locator("#phase-on_hold .management-due-overdue")).toHaveCount(0);
      await expect(page.locator("#phase-discovery [role=progressbar]")).toHaveAttribute("aria-valuenow", "100");
      await page.locator("#phase-unassigned summary").press("Enter");
      await expect(page.locator("#phase-unassigned select")).toHaveValue("");
    }
    const move = page.locator(".pipeline-move-disclosure").first();
    if (await move.count()) {
      await move.locator("summary").press("Enter");
      await move.locator("select").selectOption("build");
      const button = move.getByRole("button", { name: "Move", exact: true });
      await button.scrollIntoViewIfNeeded();
      await button.focus();
      expect(await button.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
      expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
      expect(await move.locator("form").evaluate(el => new FormData(el).get("status"))).toBe("build");
    }
  }
});

test("Scanner lowers old missing-website scores and exposes honest social verification", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const scenario of ["normal", "long", "empty", "error"]) {
    await show(page, "admin", scenario, "scanner");
    const prospects = page.locator("article.prospect-card");
    if (["normal", "long"].includes(scenario)) {
      // Default now displays newest scans, not highest opportunity. Never
      // couple social-verification assertions to score-based result order.
      const studio = prospects.filter({ hasText: "Mira Studio" });
      // The long-content preview intentionally replaces the Cedar & Stone
      // name with a stress-test string. Select by the unique verified profile
      // link instead of relying on a specific name or row position.
      const unverified = prospects.filter({ has: page.getByRole("link", { name: "Facebook ↗", exact: true }) });
      await expect(studio).toHaveCount(1);
      await expect(unverified).toHaveCount(1);
      const challengerBoard = page.getByRole("region", { name: "Qualified category challengers" });
      await expect(challengerBoard).toContainText("Mira Studio");
      await expect(challengerBoard).toContainText("Salons & Barbers");
      await expect(challengerBoard).not.toContainText("Cedar & Stone");
      const depthNav = challengerBoard.getByRole("navigation", { name: "Best-fit shortlist length" });
      await expect(depthNav.getByRole("link", { name: "3", exact: true })).toHaveAttribute("aria-current", "page");
      await expect(depthNav.getByRole("link", { name: "10", exact: true })).toHaveAttribute("href", "/leads/discover?shortlist=10#qualified-shortlists");
      await expect(depthNav.getByRole("link", { name: "20", exact: true })).toHaveAttribute("href", "/leads/discover?shortlist=20#qualified-shortlists");
      await expect(depthNav).toContainText("focused view");
      // Manually resumable Deep Scan is visible and does not block the
      // existing quick-scan or unverified social reviews.
      const deep = page.getByRole("region", { name: "Resumable deep scan jobs" });
      await expect(deep).toContainText("12/25");
      await expect(deep.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "12");
      await expect(deep.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "25");
      await expect(deep.getByRole("button", { name: "Process next six" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Create resumable deep scan" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Newest scans" })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("link", { name: "Highest opportunity" })).toBeVisible();
      await expect(unverified.locator(".score")).toHaveText("10");
      await expect(unverified).toContainText("Needs verification");
      await expect(unverified).toContainText("Website unconfirmed · low priority");
      await expect(unverified.getByRole("link", { name: "Facebook ↗", exact: true })).toHaveAttribute("href", "https://www.facebook.com/cedarandstone/");
      await expect(unverified.getByRole("link", { name: "Search Instagram ↗", exact: true })).toHaveAttribute("href", /site%3Ainstagram.com/);
      await expect(unverified.getByRole("button", { name: "Re-analyze & check socials" })).toBeVisible();
    } else {
      await expect(prospects).toHaveCount(0);
      if (scenario === "error") {
        await expect(page.getByRole("alert")).toContainText("Prospects could not load");
        await expect(page.locator(".section-head .count")).toHaveText("—");
        await expect(page.getByText(/No prospects yet/)).toHaveCount(0);
      }
    }
    await expect(page.getByRole("heading", { name: "Better leads. A closer look." })).toBeVisible();
    const scan = page.getByRole("button", { name: "Scan", exact: true });
    await scan.focus();
    expect((await scan.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await scan.evaluate(el => getComputedStyle(el).backgroundImage), "Scan remains visibly branded").toContain("gradient");
    const scannerRadius = await page.getByRole("region", { name: "Run a scan" }).evaluate(el => parseFloat(getComputedStyle(el).borderTopLeftRadius));
    expect(scannerRadius, "The Intelligence Chamber must preserve softly rounded glass geometry").toBeGreaterThanOrEqual(19);
    expect(scannerRadius).toBeLessThanOrEqual(30);
    for (const width of [1440, 1024, 620, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `scanner ${scenario} at ${width}px`).toBeLessThanOrEqual(width);
    }
  }
});

test("Lead Intelligence keeps capture, queue and error states usable at every width", async ({ page }) => {
  for (const scenario of ["populated", "long", "empty", "error", "form-error"]) {
    await show(page, "admin", scenario, "leads");
    const capture = page.getByRole("region", { name: "Quick capture" });
    const extras = capture.locator("details");
    if (scenario === "form-error") await expect(extras).toHaveAttribute("open", "");
    else await expect(extras).not.toHaveAttribute("open", "");
    if (scenario !== "form-error") await extras.locator("summary").press("Enter");
    await expect(capture.getByLabel("Business email")).toBeVisible();
    await capture.getByLabel("Business email").fill("preview@example.invalid");
    for (const width of [1440, 1024, 860, 620, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${scenario} lead queue at ${width}px`).toBeLessThanOrEqual(width);
      const button = capture.getByRole("button", { name: "Capture lead" });
      await button.scrollIntoViewIfNeeded();
      await button.focus();
      expect(await button.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
      expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    if (scenario === "error") {
      await expect(page.getByRole("alert")).toContainText("Lead data could not load");
      await expect(page.getByText("No active leads.", { exact: true })).toHaveCount(0);
      await expect(page.locator(".metric-card strong").first()).toHaveText("—");
    }
    if (scenario === "empty") await expect(page.getByText("No active leads.", { exact: true })).toBeVisible();
    if (scenario === "populated") {
      await expect(page.locator(".lead-open-link")).toHaveCount(3);
      await expect(page.locator(".lead-open-link").first()).toHaveAttribute("href", "/leads/synthetic-lead-0");
    }
    await extras.locator("summary").press("Enter");
    expect(await capture.locator("form").evaluate(el => new FormData(el).get("email"))).toBe("preview@example.invalid");
  }
});

test("Lead conversation retains all outcomes, scheduling and deliberate conversion on mobile", async ({ page }) => {
  for (const scenario of ["populated", "long", "normal"]) {
    await show(page, "admin", scenario, "lead-detail");
    await expect(page.locator(".quick-outcome-grid form")).toHaveCount(6);
    const conversion = page.locator("details.lead-conversion");
    await conversion.locator("summary").press("Enter");
    for (const width of [1440, 1024, 860, 620, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${scenario} lead detail at ${width}px`).toBeLessThanOrEqual(width);
      for (const button of await page.locator(".nocturne-leads button").all()) {
        await button.scrollIntoViewIfNeeded();
        expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
      }
    }
    await expect(page.getByLabel("Project name (optional)")).toBeVisible();
    await expect(page.getByLabel("Pacific time")).toHaveAttribute("type", "datetime-local");
    for (const id of await page.locator('input[name="lead_id"]').all()) await expect(id).toHaveValue("synthetic-lead-0");
    expect(await contrast(page.locator(".lead-detail-list dt").first(), ".app-shell")).toBeGreaterThanOrEqual(4.5);
    await expect(page.locator(".timeline-row")).toHaveCount(scenario === "populated" ? 3 : 0);
  }
});

test("Atelier dark sidebar retains readable identity and sign out", async ({ page }) => {
  await show(page, "client");
  // Reveal the same drawer for a CSS check without simulating authentication.
  await page.locator(".nhs-sidebar").evaluate((el) => el.classList.add("is-open"));
  expect(await contrast(page.locator(".brand-mark"), ".sidebar")).toBeGreaterThanOrEqual(4.5);
  const signOut = page.locator(".sidebar-bottom .sign-out-button");
  await signOut.scrollIntoViewIfNeeded();
  expect(await contrast(signOut)).toBeGreaterThanOrEqual(4.5);
  await signOut.hover();
  expect(await contrast(signOut)).toBeGreaterThanOrEqual(4.5);
  await signOut.focus();
  expect(await signOut.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
  expect((await signOut.boundingBox()).height).toBeGreaterThanOrEqual(44);
});

for (const role of ["client", "admin"]) {
  test(role + " project journey and open file workspace fit at narrow widths", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const scenario of ["normal", "long", "populated"]) {
      await show(page, role, scenario, "project", "files");
      await expect(page.getByRole("region", { name: "Project journey" })).toBeVisible();
      await expect(page.locator('.studio-journey li[aria-current="step"]')).toHaveCount(1);
      await expect(page.getByRole("navigation", { name: "Project destinations" })).toBeVisible();
      await expect(page.locator(role === "client" ? "details#project-resources" : "details#workspace-resources")).toHaveAttribute("open", "");
      await expect(page.locator(".studio-gallery-images img")).toHaveCount(scenario === "populated" ? 1 : 0);
      for (const width of [1440, 1024, 860, 620, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `${role} ${scenario} project fits at ${width}px`).toBeLessThanOrEqual(width);
        for (const link of await page.getByRole("navigation", { name: "Project destinations" }).getByRole("link").all()) {
          await link.scrollIntoViewIfNeeded();
          await link.focus();
          expect(await link.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
        }
      }
    }
  });
}

test("Command Center progress and disclosure fit at desktop and narrow widths", async ({ page }) => {
  await show(page, "admin", "long");
  for (const width of [1440, 1280, 1024, 900, 860, 620, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const panel = await page.locator(".project-panel").boundingBox();
    const percentage = await page.locator(".project-row b").boundingBox();
    expect(percentage.x + percentage.width, `100% fits inside Project Pulse at ${width}px`).toBeLessThanOrEqual(panel.x + panel.width - 10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const toggle = page.locator(".nocturne-insights-toggle");
    expect(await toggle.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    const summary = page.locator(".nocturne-insights > summary");
    await summary.scrollIntoViewIfNeeded();
    await summary.click();
    await expect(page.locator(".nocturne-insights")).toHaveAttribute("open", "");
    await summary.press("Enter");
    await expect(page.locator(".nocturne-insights")).not.toHaveAttribute("open", "");
  }
  expect(await contrast(page.locator(".metric-card > span").first(), ".nhs-command-surface")).toBeGreaterThanOrEqual(4.5);
});

test("Atelier long titles, empty and error states fit at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const scenario of ["long", "empty", "error"]) {
    await show(page, "client", scenario);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await expect(page.locator(".atelier-welcome-cta")).toBeVisible();
    if (scenario === "long") await expect(page.getByRole("link", { name: "Review approval" })).toBeVisible();
    if (scenario === "long") {
      const compass = page.locator(".nhs-atelier-compass");
      await expect(compass).toBeVisible();
      await expect(compass.locator('button[aria-pressed="true"]')).toContainText("Next");
      await expect(compass.getByRole("button", { name: /Journey/ })).toBeVisible();
      await expect(compass.getByRole("button", { name: /Connect/ })).toBeVisible();
      await expect(compass.getByRole("link", { name: "Review approval" })).toHaveAttribute("href", "/portal/approvals");
      // Offline preview renders static HTML. Interaction switching requires a hydrated React runtime.
    }
    if (scenario === "empty") await expect(page.getByRole("heading", { name: "Your story begins here." })).toBeVisible();
    if (scenario === "error") await expect(page.getByRole("alert")).toContainText("Projects are temporarily unavailable.");
  }
});

test("Nocturne Priority Halo keeps all three ranked leads readable and reachable", async ({ page }) => {
  await show(page, "admin", "populated");
  const halo = page.locator(".nhs-priority-halo");
  const nodes = halo.locator(".nhs-priority-halo__node");
  const link = halo.locator(".nhs-priority-halo__open");
  await expect(halo).toBeVisible();
  await expect(nodes).toHaveCount(3);
  await expect(nodes.nth(0)).toHaveAttribute("aria-pressed", "true");
  await expect(halo.locator(".nhs-priority-halo__detail h4")).not.toBeEmpty();
  await expect(link).toHaveAttribute("href", /\/leads\/synthetic-lead-0$/);

  for (const width of [1440, 900, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth), "Halo page overflow at " + width).toBeLessThanOrEqual(width);
    for (const node of await nodes.all()) {
      await node.scrollIntoViewIfNeeded();
      await expect(node).toBeInViewport();
      const box = await node.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(40);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
    }
    await expect(halo.locator(".nhs-priority-halo__detail")).toBeVisible();
    expect(await contrast(halo.locator(".nhs-priority-halo__detail strong"), ".nhs-command-surface")).toBeGreaterThanOrEqual(4.5);
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeInViewport();
    await link.focus();
    expect(await link.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
  }
});

test("Radar shortlist keeps intake, bid stages and loaded metrics clear", async ({ page }) => {
  for (const scenario of ["populated", "long", "empty", "error", "filtered", "invalid-stage", "form-error", "unsafe-url"]) {
    await show(page, "admin", scenario, "opportunities");
    const intake = page.locator(".nocturne-create-panel");
    if (!(await intake.getAttribute("open") === "")) await intake.locator(":scope > summary").press("Enter");
    await expect(page.getByLabel("Opportunity title", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Source", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Bid stage filter" }).locator('[aria-current="page"]')).toHaveCount(1);
    for (const width of [1440, 1024, 860, 620, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `Radar ${scenario} at ${width}px`).toBeLessThanOrEqual(width);
    }
    if (scenario === "filtered") {
      await expect(page.locator(".radar-row")).toHaveCount(1);
      await expect(page.locator(".metric-card strong").first()).toHaveText("2");
      await expect(page.getByRole("link", { name: "Qualified", exact: true })).toHaveAttribute("aria-current", "page");
    }
    if (scenario === "error") {
      await expect(page.getByRole("alert")).toContainText("could not load");
      await expect(page.locator(".metric-card strong").first()).toHaveText("—");
      await expect(page.locator(".radar-row")).toHaveCount(0);
      await expect(page.getByText("Room for the right work.", { exact: true })).toHaveCount(0);
    }
    if (scenario === "unsafe-url") await expect(page.getByRole("link", { name: "View listing", exact: true })).toHaveCount(0);
    if (scenario === "invalid-stage") await expect(page.getByRole("alert")).toContainText("Showing all loaded");
    const submit = page.getByRole("button", { name: "Track opportunity", exact: true });
    await submit.scrollIntoViewIfNeeded(); await submit.focus();
    expect((await submit.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await submit.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
  }
});

test("Opportunity workspaces separate scoring, saved proposals and bid records", async ({ page }) => {
  for (const scenario of ["normal", "long", "empty", "error", "proposals-error", "sent", "unscored", "unsafe-url"]) {
    await show(page, "admin", scenario, "opportunity-detail");
    if (scenario === "error") {
      await expect(page.getByRole("alert")).toContainText("details could not load");
      await expect(page.getByRole("button", { name: "Move stage", exact: true })).toHaveCount(0);
      continue;
    }
    for (const details of await page.locator(".radar-page details").all()) await details.locator(":scope > summary").press("Enter");
    for (const width of [1440, 1024, 860, 620, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `Opportunity ${scenario} at ${width}px`).toBeLessThanOrEqual(width);
    }
    await expect(page.getByLabel("Project fit (0–20)", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Bid stage", { exact: true })).toHaveValue("qualified");
    await expect(page.getByRole("region", { name: "Proposal workspace", exact: true })).toContainText("does not deliver it");
    if (scenario === "sent") {
      await expect(page.getByRole("button", { name: "Save proposal draft", exact: true })).toHaveCount(0);
      await expect(page.locator(".studio-draft-body")).toContainText("clear scope");
    } else if (!["empty", "proposals-error"].includes(scenario)) {
      await expect(page.getByLabel("Proposal text", { exact: true })).toBeVisible();
      await page.getByLabel("Proposal text", { exact: true }).fill("A careful synthetic proposal.");
    }
    if (scenario === "proposals-error") {
      await expect(page.getByRole("alert")).toContainText("Proposal drafts could not load");
      await expect(page.getByRole("button", { name: "Create draft", exact: true })).toHaveCount(0);
    }
    if (scenario === "unsafe-url") await expect(page.getByRole("link", { name: "View original listing", exact: true })).toHaveCount(0);
    const nav = page.getByRole("navigation", { name: "Opportunity destinations" });
    await nav.getByRole("link", { name: "Bid record", exact: true }).click();
    await expect(page.locator("#radar-record h3")).toBeInViewport();
  }
});

test("Automation workroom distinguishes availability, history and partial read failures", async ({ page }) => {
  test.setTimeout(90000);
  for (const scenario of ["normal", "long", "empty", "error", "runs-error", "notifications-error", "enabled", "failed-run", "read", "email-configured"]) {
    await show(page, "admin", scenario, "automations");
    for (const details of await page.locator(".engine-controls").all()) await details.locator(":scope > summary").press("Enter");
    for (const width of [1440, 1024, 860, 620, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `Automations ${scenario} at ${width}px`).toBeLessThanOrEqual(width);
    }
    const registry = page.getByRole("region", { name: "Automation registry", exact: true });
    await expect(registry).toContainText("even when the flag is off");
    await expect(page.getByRole("region", { name: "External integrations", exact: true })).toContainText(scenario === "email-configured" ? "Settings present" : "Not configured");
    if (scenario === "error") {
      await expect(registry.getByRole("alert")).toContainText("registry could not load");
      await expect(page.getByRole("button", { name: "Run now", exact: true })).toHaveCount(0);
      await expect(page.locator(".metric-card strong").first()).toHaveText("—");
    }
    if (scenario === "runs-error") {
      await expect(page.getByRole("region", { name: "Run history", exact: true }).getByRole("alert")).toContainText("could not load");
      await expect(page.getByRole("button", { name: "Run now", exact: true })).toBeVisible();
    }
    if (scenario === "notifications-error") await expect(page.getByRole("button", { name: "Mark all notifications read", exact: true })).toHaveCount(0);
    if (scenario === "enabled") await expect(page.getByRole("button", { name: "Disable automation", exact: true })).toBeVisible();
    if (scenario === "read") {
      await expect(page.getByRole("button", { name: "Mark read", exact: true })).toHaveCount(0);
      await expect(page.locator(".engine-signal h4 a")).toHaveAttribute("href", "/leads");
    }
    if (scenario === "failed-run") await expect(page.locator(".engine-run .studio-status")).toHaveText("Error");
    // Inspect manual-run and enabled controls, never invoke either in source previews.
    const run = page.getByRole("button", { name: "Run now", exact: true });
    if (await run.count()) { await run.scrollIntoViewIfNeeded(); await run.focus(); expect((await run.boundingBox()).height).toBeGreaterThanOrEqual(44); expect(await run.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none"); }
    await page.getByRole("navigation", { name: "Automation destinations" }).getByRole("link", { name: "Run history", exact: true }).click();
    await expect(page.locator("#engine-history h3")).toBeInViewport();
  }
});

test("Shared navigation keeps workspace names, nested paperwork and return paths aligned", async ({ page }) => {
  test.setTimeout(90000);
  const cases = [
    ["admin", "/", "Command Center", "/", []],
    ["admin", "/leads/discover", "Lead Scanner", "/leads/discover", ["/"]],
    ["admin", "/clients/synthetic-client", "Client workspace", "/clients", ["/", "/clients"]],
    ["admin", "/leads/synthetic-lead", "Lead workspace", "/leads", ["/", "/leads"]],
    ["admin", "/opportunities/synthetic-opportunity", "Opportunity workspace", "/opportunities", ["/", "/opportunities"]],
    ["admin", "/projects/synthetic-project", "Project workspace", "/projects", ["/", "/projects"]],
    ["admin", "/templates", "Text templates", "/templates", ["/"]],
    ["admin", "/templates/synthetic-template", "Template workspace", "/templates", ["/", "/templates"]],
    ["admin", "/forms/synthetic-form", "Form workspace", "/forms", ["/", "/forms"]],
    ["admin", "/contracts/synthetic-contract", "Contract workspace", "/contracts", ["/", "/contracts"]],
    ["admin", "/settings", "Settings", "/settings", ["/"]],
    ["client", "/portal", "Home", "/portal", []],
    ["client", "/portal/projects/synthetic-project", "Project workspace", "/portal/projects", ["/portal", "/portal/projects"]],
    ["client", "/portal/messages", "Messages", "/portal/messages", ["/portal"]],
    ["client", "/portal/files", "Files", "/portal/files", ["/portal"]],
    ["client", "/portal/approvals", "Approvals", "/portal/approvals", ["/portal"]],
    ["client", "/portal/documents", "Documents", "/portal/documents", ["/portal"]],
    ["client", "/portal/contracts", "Contracts", "/portal/documents", ["/portal", "/portal/documents"]],
    ["client", "/portal/forms", "Forms", "/portal/documents", ["/portal", "/portal/documents"]],
  ];
  for (const [role, path, current, active, returns] of cases) {
    await show(page, role, "normal", "navigation", path);
    await expect(page.locator(".brand-mark img")).toHaveJSProperty("naturalWidth", 160);
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb", exact: true });
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText(current);
    expect(await crumbs.locator("a").evaluateAll(links => links.map(a => a.getAttribute("href")))).toEqual(returns);
    await expect(page.locator('.nav-stack a[aria-current="page"]')).toHaveAttribute("href", active);
    if (role === "client") await expect(page.locator('.nav-stack a[href="/leads"]')).toHaveCount(0);
    for (const width of [1440, 860, 390, 320]) {
      await page.setViewportSize({ width, height: 800 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${path} at ${width}px`).toBeLessThanOrEqual(width);
    }
  }
});


test("Decorative welcome artwork stays in the entrance, not over working surfaces", async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const welcomeCases = [
    ["admin", ".nocturne-overview", ".nhs-command-surface", "#f9f4ee"],
    ["client", ".atelier-hero", ".atelier-feature-project", "#fffaf7"],
  ];
  for (const [role, heroSelector, workSelector, paperColor] of welcomeCases) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await show(page, role, "populated", "home");
      const shell = page.locator(".app-shell.nhs-theme-" + role);
      await expect(shell).toHaveCount(1);
      const hero = page.locator(heroSelector);
      await expect(hero).toBeVisible();
      const heroImage = await hero.evaluate(el => getComputedStyle(el).backgroundImage);
      expect(heroImage, role + " welcome artwork at " + width).toContain(role === "admin" ? "data:image/webp;base64" : "data:image/svg+xml");
      // The percent-encoded SVG includes literal parentheses from gradient functions.
      // Capture the complete quoted CSS URL; ending at the first ")" corrupts the image.
      const decoded = await hero.evaluate(async el => {
        const match = getComputedStyle(el).backgroundImage.match(/url\(["'](data:image\/(?:svg\+xml|webp)[^"']+)["']\)/);
        if (!match) return false;
        const artwork = new Image();
        artwork.src = match[1];
        await artwork.decode();
        return artwork.naturalWidth > 0 && artwork.naturalHeight > 0;
      });
      expect(decoded, role + " floral asset decodes offline").toBe(true);
      await expect(page.locator(".brand-mark img")).toHaveJSProperty("naturalWidth", 160);
      const work = page.locator(workSelector);
      await expect(work).toBeVisible();
      await expect(work).toHaveCSS("background-color", role === "admin" ? "rgba(0, 0, 0, 0)" : "rgba(255, 254, 252, 0.85)");
      const workBackdrop = await work.evaluate(el => getComputedStyle(el).backgroundImage);
      expect(workBackdrop, "Keep busy workspace free of floral artwork").not.toContain("data:image/svg+xml");
      expect(workBackdrop, "Keep the photographic hero out of working surfaces").not.toContain("data:image/webp;base64");
      expect(await page.evaluate(() => document.documentElement.scrollWidth), role + " overflow at " + width).toBeLessThanOrEqual(width);
      const capture = testInfo.outputPath(role + "-soft-atelier-" + width + ".png");
      await page.screenshot({ path: capture, fullPage: true, animations: "disabled" });
      await testInfo.attach(role + "-soft-atelier-" + width, { path: capture, contentType: "image/png" });
    }
  }
  // Project layouts use calm papers and dividers, not a giant page-filling flower.
  for (const role of ["admin", "client"]) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await show(page, role, "populated", "project");
      await expect(page.locator(".studio-workspace")).toBeVisible();
      await expect(page.locator(".brand-mark img")).toHaveJSProperty("naturalWidth", 160);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (role === "admin") await expect(page.locator(".studio-workspace-admin")).toHaveCSS("background-color", "rgb(244, 238, 235)");
    }
  }
  for (const preference of [{ contrast: "more" }, { contrast: "no-preference", forcedColors: "active" }]) {
    await page.emulateMedia(preference);
    for (const role of ["admin", "client"]) {
      await show(page, role, "populated", "home");
      const hero = page.locator(role === "admin" ? ".nocturne-overview" : ".atelier-hero");
      await expect(hero).toHaveCSS("background-image", "none");
    }
  }
});

test("Project communication, feedback pins and invoice fields remain readable on both canvases", async ({ page }, testInfo) => {
  for (const role of ["admin", "client"]) {
    await show(page, role, "populated", "controls");
    await page.getByRole("article", { name: "Forms", exact: true }).locator("details > summary").press("Enter");
    for (const sender of await page.locator(".studio-message-sender").all()) {
      expect(await contrast(sender, ".app-shell")).toBeGreaterThanOrEqual(4.5);
    }
    for (const pin of await page.locator(".studio-feedback-pin").all()) {
      expect(await contrast(pin)).toBeGreaterThanOrEqual(4.5);
    }
    const frame = page.getByRole("button", { name: "Deliverable preview — click to place a feedback pin", exact: true });
    await frame.focus();
    expect(await frame.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
    for (const width of [1440, 1024, 860, 768, 620, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${role} controls at ${width}px`).toBeLessThanOrEqual(width);
      expect((await page.getByRole("textbox", { name: "Line 1 description", exact: true }).boundingBox()).width).toBeGreaterThan(100);
      for (const input of await page.locator(".studio-line-item-row input, .studio-line-item-row button").all()) {
        const box = await input.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
    }
    const capture = testInfo.outputPath(`${role}-workspace-controls.png`);
    await page.screenshot({ path: capture, fullPage: true });
    await testInfo.attach(`${role}-workspace-controls`, { path: capture, contentType: "image/png" });
  }
});

test("The shared atmosphere carries across every admin and client destination", async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const width = testInfo.project.name.startsWith("mobile") ? 390 : 1440;
  await page.setViewportSize({ width, height: 900 });
  const screens = {
    admin: ["home", "leads", "lead-detail", "scanner", "clients", "client-detail", "pipeline", "project", "contracts", "contract-detail", "forms", "form-detail", "templates", "template-detail", "muse", "opportunities", "opportunity-detail", "automations", "settings"],
    client: ["home", "portal-projects", "project", "portal-documents", "portal-messages", "portal-files", "portal-approvals", "portal-contracts", "portal-forms"],
  };
  for (const [role, views] of Object.entries(screens)) {
    for (const view of views) {
      await show(page, role, "populated", view);
      await expect(page.locator(`.nhs-theme-${role}`)).toHaveCSS("color-scheme", role === "client" ? "light" : "dark");
      const stageBackground = await page.locator(".main-shell").evaluate(el => getComputedStyle(el).backgroundImage);
      if (role === "admin") {
        expect(stageBackground, `${view} should inherit the photographic NHS Dark Rose studio`).toMatch(/webp|gradient/);
        expect(stageBackground, `${view} should share the photographic skull-and-rose identity`).toContain("webp");
        await expect(page.locator(".main-shell")).toHaveCSS("background-color", "rgb(3, 3, 9)");
      } else {
        expect(stageBackground, `${view} should preserve the warm client Atelier`).toContain("gradient");
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${role} ${view} at ${width}px`).toBeLessThanOrEqual(width);
      const capture = testInfo.outputPath(`${role}-${view}-${width}.png`);
      await page.screenshot({ path: capture, fullPage: true, animations: "disabled" });
      await testInfo.attach(`${role}-${view}-${width}`, { path: capture, contentType: "image/png" });
    }
  }
});

// The Admin Client Workspace must visibly differ from the former all-black workspace.
test("Client Management inherits the skull-and-rose hero without losing ivory directory contrast", async ({ page }) => {
  await show(page, "admin", "populated", "clients");
  const header = page.locator(".management-clients > .management-heading");
  await expect(header).toBeVisible();
  const photo = await header.evaluate(el => getComputedStyle(el).backgroundImage);
  expect(photo, "Client Management should display the shared Dark Rose photo").toContain("webp");
  await expect(header.locator("h2")).toHaveCSS("color", "rgb(244, 238, 246)");
  const directory = page.locator(".management-clients .management-directory");
  await expect(directory).toBeVisible();
  expect(await directory.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe("rgb(3, 3, 9)");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("NHS relationship Atelier has dark hero and visibly warm ivory workspace", async ({ page }) => {
  await show(page, "admin", "populated", "client-detail");
  const layout = page.locator(".management-client-workspace");
  await expect(layout).toBeVisible();
  const hero = layout.locator(".management-heading");
  const canvas = layout.locator(".management-client-grid");
  await expect(hero).toBeVisible();
  await expect(canvas).toBeVisible();
  expect(await canvas.evaluate(el => getComputedStyle(el).backgroundColor)).toBe("rgb(249, 244, 238)");
  expect(await hero.evaluate(el => getComputedStyle(el).backgroundColor)).toBe("rgb(11, 11, 18)");
  expect(await hero.evaluate(el => getComputedStyle(el).backgroundImage), "Client detail should carry a photographic NHS entrance").toContain("webp");
  expect(await canvas.evaluate(el => getComputedStyle(el).color)).toBe("rgb(64, 42, 57)");
  for (const width of [1440, 1024, 620, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `Relationship Atelier overflow at ${width}px`).toBeLessThanOrEqual(width);
  }
});

test("Midnight Observatory uses NHS black glass and rose-accented welcome", async ({ page }) => {
  await show(page, "admin", "populated", "home");
  const hero = page.locator(".nocturne-command-center .nocturne-overview");
  const work = page.locator(".nocturne-command-center .nhs-command-surface");
  await expect(hero).toBeVisible();
  await expect(work).toBeVisible();
  // The approved cinematic layout is open and atmospheric, not a photo
  // inside one rectangle above another giant opaque dashboard box.
  const cinematicArtwork = await hero.evaluate(el=>getComputedStyle(el).backgroundImage);
  expect(cinematicArtwork.includes("data:image/webp;base64") || cinematicArtwork.includes("nhs-dark-rose-photographic.webp")).toBe(true);
  await expect(hero).toHaveCSS("border-top-width", "0px");
  await expect(work).toHaveCSS("border-top-width", "0px");
  const instruments = work.locator(".metric-card");
  await expect(instruments).toHaveCount(3);
  expect(await instruments.first().evaluate(el=>parseFloat(getComputedStyle(el).borderTopLeftRadius))).toBeGreaterThanOrEqual(16);
  expect(await instruments.first().evaluate(el=>getComputedStyle(el).backgroundImage)).toContain("gradient");
  await expect(work.locator(".metric-grid")).toContainText("Active Leads");
  await expect(work.locator(".dashboard-grid")).toContainText("Next 3 actions");
  await expect(work.locator(".dashboard-grid")).toContainText("Project pulse");
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({width,height:850});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth),
      `Nocturne Soft Atelier overflows at ${width}px`).toBeLessThanOrEqual(width);
  }
});

test("soft client portal and admin project workspace share warm palette", async ({ page }) => {
  await show(page, "client", "populated", "home");
  await expect(page.locator(".atelier-home .atelier-hero")).toHaveCSS("background-color", "rgb(255, 253, 249)");
  await expect(page.locator(".atelier-home .atelier-feature-project")).toHaveCSS("background-color", "rgba(255, 254, 252, 0.85)");
  await show(page, "admin", "populated", "project");
  await expect(page.locator(".studio-workspace-admin")).toHaveCSS("background-color", "rgb(244, 238, 235)");
});


test("Seven studio rooms are distinct, readable and captured at desktop and phone widths", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const rooms=[
    ["observatory","admin","home","#d32c5a"],
    ["electric","admin","scanner","#6cbadd"],
    ["rose","admin","clients","#b87f99"],
    ["artist","admin","pipeline","#d4b18a"],
    ["archive","admin","contracts","#b69a68"],
    ["velvet","admin","muse","#c9a0e6"],
    ["private","client","home","#c18ca3"]
  ];
  const roomAccents = new Set();
  for(const [room,role,view,accent] of rooms){
    for(const [size,width] of [["desktop",1440],["phone",390]]){
      await page.setViewportSize({width,height:900});
      await show(page,role,"populated",view);
      const roomIdentity=page.locator(".nhs-room-identity");
      await expect(roomIdentity).toHaveAttribute("data-room",room);
      await expect(roomIdentity).toBeVisible();
      expect(await page.locator(".app-shell").evaluate(el=>getComputedStyle(el).getPropertyValue("--room-accent").trim())).toBe(accent);
      const back=await page.locator(".main-shell").evaluate(el=>getComputedStyle(el).backgroundImage);
      expect(back,room+" "+size+" background").toContain("gradient");
      if (role === "admin") expect(back, room+" should keep the same photographic Dark Rose brand").toContain("webp");
      if(size==="desktop")roomAccents.add(accent);
      const screenWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
      expect(screenWidth,room+" "+size+" horizontal overflow").toBeLessThanOrEqual(width);
      const output=testInfo.outputPath("room-"+room+"-"+size+".png");
      await page.screenshot({path:output,fullPage:false,animations:"disabled"});
      await testInfo.attach(room+" / "+size,{path:output,contentType:"image/png"});
    }
  }
  // Shared photographic atmosphere is intentional. Rooms retain their
  // own accent semantics and readable working canvases, not seven incompatible brands.
  expect(roomAccents.size).toBe(7);
});


test("Every NHS room has its own etched visual motif, with working responsive pages", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const identities = [
    ["electric", "admin", "scanner", "#7dd5f2"],
    ["rose", "admin", "clients", "#f4aac5"],
    ["artist", "admin", "pipeline", "#efd0a1"],
    ["archive", "admin", "templates", "#e5c69a"],
    ["velvet", "admin", "muse", "#e0bbff"],
    ["private", "client", "home", null],
  ];
  const distinctIllustrations = new Set();
  const width = testInfo.project.name.startsWith("mobile") ? 390 : 1440;
  await page.setViewportSize({ width, height: 900 });
  for (const [room, role, view, accent] of identities) {
    await show(page, role, "populated", view);
    const shell = page.locator(".app-shell");
    await expect(shell.locator(".nhs-room-identity")).toHaveAttribute("data-room", room);
    const motif = await shell.evaluate((el, isClient) =>
      getComputedStyle(el).getPropertyValue(isClient ? "--nhs-client-motif" : "--nhs-room-art").trim(), role === "client");
    expect(motif, room + " must use NHS-specific original room artwork").toContain("data:image/svg+xml");
    const match = motif.match(/(data:image\/svg\+xml,[^"']+)/);
    expect(match, room + " should have an embedded local SVG illustration").not.toBeNull();
    const asset = decodeURIComponent(match[1]);
    expect(asset).toContain("<svg");
    distinctIllustrations.add(asset);
    const main = page.locator(".main-shell");
    const background = await main.evaluate(el => getComputedStyle(el).backgroundImage);
    expect(background, room + " artwork must be visible in its environment").toContain("data:image/svg+xml");
    if (role === "admin") {
      expect(background).toContain("data:image/webp;base64");
      expect(await shell.evaluate(el => getComputedStyle(el).getPropertyValue("--nhs-room-accent").trim())).toBe(accent);
    } else {
      await expect(shell).toHaveCSS("color-scheme", "light");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth), room + " horizontal overflow").toBeLessThanOrEqual(width);
    const capture = testInfo.outputPath("nhs-" + room + "-" + width + ".png");
    await page.screenshot({ path: capture, fullPage: false, animations: "disabled" });
    await testInfo.attach("NHS " + room + " room", { path: capture, contentType: "image/png" });
  }
  expect(distinctIllustrations.size, "Rooms must not repeat the same illustration").toBe(identities.length);
});
