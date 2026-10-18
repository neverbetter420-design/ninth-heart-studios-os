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
      await expect(prospects.first()).toContainText("Mira Studio");
      await expect(prospects.nth(1).locator(".score")).toHaveText("10");
      await expect(prospects.nth(1)).toContainText("Needs verification");
      await expect(prospects.nth(1)).toContainText("Website unconfirmed · low priority");
      await expect(prospects.nth(1).getByRole("link", { name: "Facebook ↗", exact: true })).toHaveAttribute("href", "https://www.facebook.com/cedarandstone/");
      await expect(prospects.nth(1).getByRole("link", { name: "Search Instagram ↗", exact: true })).toHaveAttribute("href", /site%3Ainstagram.com/);
      await expect(prospects.nth(1).getByRole("button", { name: "Re-analyze & check socials" })).toBeVisible();
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
    expect(await scan.evaluate(el => getComputedStyle(el).backgroundImage)).toBe("none");
    expect(await page.getByRole("region", { name: "Run a scan" }).evaluate(el => getComputedStyle(el).borderRadius)).toBe("0px");
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


test("Decorative Nocturne / Atelier backgrounds render offline in desktop and mobile reviews", async ({ page }, testInfo) => {
  test.setTimeout(90000);
  // Each preview uses actual source markup with synthetic data, not hosted accounts.
  const cases = [
    ["admin", "home", "nocturne-command"],
    ["client", "home", "atelier-home"],
    ["admin", "project", "nocturne-creative-studio"],
    ["client", "project", "atelier-project-workspace"],
  ];
  for (const [role, view, label] of cases) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await show(page, role, "populated", view);
      const shell = page.locator(`.app-shell.nhs-theme-${role}`);
      await expect(shell).toHaveCount(1);
      const image = await shell.evaluate((element) => getComputedStyle(element).backgroundImage);
      expect(image, `${label} background is visible at ${width}px`).toContain("data:image/svg+xml");
      const media = await shell.evaluate((element) => getComputedStyle(element).backgroundSize);
      expect(media).not.toBe("auto");
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${label} overflow at ${width}px`).toBeLessThanOrEqual(width);
      if (view === "project") {
        await expect(page.locator(".studio-workspace")).toHaveCount(1);
        const workspaceBackdrop = await page.locator(".studio-workspace").evaluate(el => getComputedStyle(el).backgroundImage);
        expect(workspaceBackdrop).toContain("data:image/svg+xml");
      }
      const capture = testInfo.outputPath(`${label}-${width}.png`);
      await page.screenshot({ path: capture, fullPage: true, animations: "disabled" });
      await testInfo.attach(`${label}-${width}`, { path: capture, contentType: "image/png" });
    }
  }
  await page.emulateMedia({ contrast: "more" });
  await show(page, "client", "populated");
  await expect(page.locator(".app-shell.nhs-theme-client")).toHaveCSS("background-image", "none");
});
