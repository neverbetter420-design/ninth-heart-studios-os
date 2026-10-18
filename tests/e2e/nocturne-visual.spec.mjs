import { test, expect } from "@playwright/test";
import { previewCSS, renderNocturne } from "../helpers/nocturne-render.mjs";

// Actual page/shell markup, synthetic reads only. All network traffic is denied.
async function show(page, role, scenario = "normal", view = "home", section = "") {
  await page.route("**/*", (route) => route.abort());
  const { html } = await renderNocturne(role, scenario, view, section);
  await page.setContent(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`);
  await page.addStyleTag({ content: previewCSS });
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
  for (const scenario of ["normal", "long"]) {
    await show(page, "admin", scenario, "scanner");
    const prospects = page.locator("article.prospect-card");
    await expect(prospects.first()).toContainText("Mira Studio");
    await expect(prospects.nth(1).locator(".score")).toHaveText("10");
    await expect(prospects.nth(1)).toContainText("Needs verification");
    await expect(prospects.nth(1)).toContainText("Website unconfirmed · low priority");
    await expect(prospects.nth(1).getByRole("link", { name: "Facebook ↗", exact: true })).toHaveAttribute("href", "https://www.facebook.com/cedarandstone/");
    await expect(prospects.nth(1).getByRole("link", { name: "Search Instagram ↗", exact: true })).toHaveAttribute("href", /site%3Ainstagram.com/);
    await expect(prospects.nth(1).getByRole("button", { name: "Re-analyze & check socials" })).toBeVisible();
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
      await expect(page.locator(".studio-gallery img")).toHaveCount(scenario === "populated" ? 1 : 0);
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
  expect(await contrast(page.locator(".metric-card > span").first(), ".app-shell")).toBeGreaterThanOrEqual(4.5);
});

test("Atelier long titles, empty and error states fit at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const scenario of ["long", "empty", "error"]) {
    await show(page, "client", scenario);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await expect(page.locator(".atelier-primary-link")).toBeVisible();
    if (scenario === "long") await expect(page.getByRole("link", { name: "Review approval" })).toBeVisible();
    if (scenario === "empty") await expect(page.getByRole("heading", { name: "Your story begins here." })).toBeVisible();
    if (scenario === "error") await expect(page.getByRole("alert")).toContainText("Projects are temporarily unavailable.");
  }
});

test("Nocturne priority surface keeps populated actions readable and reachable", async ({ page }) => {
  await show(page, "admin", "populated");
  await expect(page.locator(".action-row")).toHaveCount(3);
  for (const width of [1440, 900, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(await contrast(page.locator(".action-copy strong").first(), ".action-panel")).toBeGreaterThanOrEqual(4.5);
    const links = page.locator(".action-row a");
    for (const link of await links.all()) {
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeInViewport();
      await expect(link).toHaveAttribute("href", /\/leads\/synthetic-lead-/);
      await link.focus();
      expect(await link.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
    }
  }
});
