import { test, expect } from "@playwright/test";

// Intentionally SKIPPED in every ordinary pull-request or browser QA run.
// Enable only in a separate, explicitly approved, manual test-data workflow.
// Every write is scoped to the verified Client A test project; no service key.
const approval = process.env.NHS_QA_WRITE_APPROVAL;
const projectId = process.env.NHS_QA_TEST_PROJECT_ID || "";
// Additional fail-closed guard: only the verified disposable Client A project.
const allowedTestProjectId = "fdb531db-bf9c-47ee-bc6a-458b626665a2";
const expectedProject = "Client A Test Co. Website";
const enabled = approval === "I_APPROVE_ISOLATED_QA_WRITES";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const users = {
  admin: [process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD],
  clientA: [process.env.E2E_CLIENT_A_EMAIL, process.env.E2E_CLIENT_A_PASSWORD],
  clientB: [process.env.E2E_CLIENT_B_EMAIL, process.env.E2E_CLIENT_B_PASSWORD],
};

const testTag = "NHS-WRITE-QA-" + (process.env.GITHUB_RUN_ID || "local") + "-" + Date.now().toString(36);
const route = "/projects/" + projectId;
const portalRoute = "/portal/projects/" + projectId;

async function signIn(page, user) {
  await page.goto("/auth/sign-in");
  await page.locator('input[name="email"]').fill(user[0]);
  await page.locator('input[name="password"]').fill(user[1]);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".navigation-shell")).toBeVisible({ timeout: 25000 });
}

async function guardedSetup(page, browser, baseURL) {
  // Fail closed before any mutation if the intended project was not explicitly
  // identified or does not belong exclusively to our known test identities.
  expect(projectId, "Explicit test project UUID required").toMatch(uuid);
  expect(projectId, "Only the approved test project is writable").toBe(allowedTestProjectId);
  const aCtx = await browser.newContext({ baseURL });
  const bCtx = await browser.newContext({ baseURL });
  try {
    const a = await aCtx.newPage();
    await signIn(a, users.clientA);
    await a.goto("/portal/projects");
    await expect(a.locator('a[href="' + portalRoute + '"]')).toBeVisible();
    await a.goto(portalRoute);
    await expect(a.getByRole("heading", { name: expectedProject, exact: true })).toBeVisible();

    const b = await bCtx.newPage();
    await signIn(b, users.clientB);
    await b.goto(portalRoute);
    await expect(b.getByRole("heading", { name: "That page isn't available.", exact: true })).toBeVisible();
    await expect(b.getByRole("heading", { name: expectedProject, exact: true })).toHaveCount(0);
  } finally {
    await aCtx.close();
    await bCtx.close();
  }

  await signIn(page, users.admin);
  await page.goto(route);
  await expect(page.getByRole("heading", { name: expectedProject, exact: true })).toBeVisible();
  await expect(page.getByText("Client A Test Co.", { exact: false }).first()).toBeVisible();
}

async function portalHas(browser, baseURL, text, visible) {
  const context = await browser.newContext({ baseURL });
  try {
    const page = await context.newPage();
    await signIn(page, users.clientA);
    await page.goto(portalRoute);
    if (visible) await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
    else await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  } finally {
    await context.close();
  }
}

function namedRow(section, title) {
  return section.locator("li.delivery-row").filter({ hasText: title });
}

async function safeRemove(page, sectionName, title) {
  // Only delete a row created by this exact run, never a pre-existing record.
  if (!title.startsWith(testTag)) return;
  await page.goto(route);
  const section = page.getByRole("region", { name: sectionName });
  const row = namedRow(section, title);
  if (await row.count() !== 1) return;
  const deleteButton = row.getByRole("button", { name: "Delete " + title, exact: true });
  await deleteButton.scrollIntoViewIfNeeded();
  await expect(deleteButton).toBeInViewport();
  page.once("dialog", (dialog) => dialog.accept());
  // Do not force the click; pointer interception is a real mobile defect.
  await deleteButton.click();
  // Server revalidation can be asynchronous; reload proves persisted deletion.
  await page.reload();
  await expect(namedRow(page.getByRole("region", { name: sectionName }), title)).toHaveCount(0);
}

test.describe("Approved isolated live-action QA", () => {
  test.skip(
    !enabled || !uuid.test(projectId) || projectId !== allowedTestProjectId || Object.values(users).some((p) => !p[0] || !p[1]),
    "Live record writes are disabled by default; require explicit approval, isolated test project and all six test credentials.",
  );
  test.describe.configure({ mode: "serial" });

  test("admin task: create, persisted status, client visibility and safe deletion", async ({ page, browser, baseURL }) => {
    await guardedSetup(page, browser, baseURL);
    const title = testTag + "-task";
    let attempted = false;
    try {
      const section = page.getByRole("region", { name: "Tasks" });
      const form = section.locator('form:has(input[name="title"])');
      await form.locator('input[name="title"]').fill(title);
      await form.locator('input[name="client_visible"]').check();
      attempted = true;
      await form.getByRole("button", { name: "Add", exact: true }).click();
      await expect(form.getByRole("status")).toContainText("Task added.");
      await expect(namedRow(section, title)).toBeVisible();
      await page.reload();
      await expect(namedRow(page.getByRole("region", { name: "Tasks" }), title)).toBeVisible();
      await portalHas(browser, baseURL, title, true);

      let row = namedRow(page.getByRole("region", { name: "Tasks" }), title);
      await row.getByRole("combobox", { name: "Status for " + title }).selectOption("in_progress");
      await row.getByRole("button", { name: "Set", exact: true }).click();
      await expect(row.getByRole("status")).toContainText("Task status updated.");
      await page.reload();
      row = namedRow(page.getByRole("region", { name: "Tasks" }), title);
      // Select the displayed state badge, not the "In progress" option
      // inside the status dropdown (Playwright strict-mode duplicate).
      await expect(row.locator("span.delivery-pill.progress")).toHaveText("In progress");

      await row.getByRole("button", { name: "Hide " + title + " from client" }).click();
      await expect(row.getByRole("status")).toContainText("Task visibility saved.");
      await page.reload();
      await portalHas(browser, baseURL, title, false);
    } finally {
      if (attempted) await safeRemove(page, "Tasks", title);
    }
  });

  test("admin milestone: create, completion and confirmed deletion", async ({ page, browser, baseURL }) => {
    await guardedSetup(page, browser, baseURL);
    const title = testTag + "-milestone";
    let attempted = false;
    try {
      const section = page.getByRole("region", { name: "Milestones" });
      const form = section.locator('form:has(input[name="title"])');
      await form.locator('input[name="title"]').fill(title);
      attempted = true;
      await form.getByRole("button", { name: "Add", exact: true }).click();
      await expect(form.getByRole("status")).toContainText("Milestone added.");
      await expect(namedRow(section, title)).toBeVisible();
      await page.reload();
      await portalHas(browser, baseURL, title, true);

      let row = namedRow(page.getByRole("region", { name: "Milestones" }), title);
      await row.getByRole("combobox", { name: "Status for " + title }).selectOption("complete");
      await row.getByRole("button", { name: "Set", exact: true }).click();
      await expect(row.getByRole("status")).toContainText("Milestone status updated.");
      await page.reload();
      row = namedRow(page.getByRole("region", { name: "Milestones" }), title);
      await expect(row.locator("span.delivery-pill.done")).toHaveText("Complete");
    } finally {
      if (attempted) await safeRemove(page, "Milestones", title);
    }
  });

  test("admin document: share safe link, verify portal and unshare", async ({ page, browser, baseURL }) => {
    await guardedSetup(page, browser, baseURL);
    const title = testTag + "-document";
    let attempted = false;
    try {
      const section = page.getByRole("region", { name: "Documents" });
      const form = section.locator('form:has(input[name="title"])');
      await form.locator('input[name="title"]').fill(title);
      await form.locator('input[name="external_url"]').fill("https://example.com/nhs-qa");
      attempted = true;
      await form.getByRole("button", { name: "Share" }).click();
      await expect(form.getByRole("status")).toContainText("Document shared.");
      await expect(namedRow(section, title)).toBeVisible();
      await page.reload();
      await expect(namedRow(page.getByRole("region", { name: "Documents" }), title)).toBeVisible();
      await portalHas(browser, baseURL, title, true);
    } finally {
      if (attempted) await safeRemove(page, "Documents", title);
    }
  });

  test("admin private file: upload canary, client download link, and scoped removal", async ({ page, browser, baseURL }) => {
    await guardedSetup(page, browser, baseURL);
    const filename = testTag + "-upload.txt";
    let attempted = false;
    try {
      const section = page.getByRole("region", { name: "Project files" });
      const form = section.locator("form.file-upload-form");
      await form.locator('input[type="file"]').setInputFiles({
        name: filename,
        mimeType: "text/plain",
        buffer: Buffer.from("NHS isolated QA canary; no customer data."),
      });
      await form.getByRole("combobox", { name: "File visibility" }).selectOption("client");
      attempted = true;
      await form.getByRole("button", { name: "Upload" }).click();
      await expect(page.getByRole("status").filter({ hasText: "File uploaded successfully." })).toBeVisible();
      await expect(namedRow(page.getByRole("region", { name: "Project files" }), filename)).toBeVisible();
      await page.reload();
      const fileRow = namedRow(page.getByRole("region", { name: "Project files" }), filename);
      await expect(fileRow.getByRole("link", { name: "Download" })).toHaveAttribute("href", /^https:\/\//);
      await portalHas(browser, baseURL, filename, true);
    } finally {
      if (attempted) await safeRemove(page, "Project files", filename);
    }
    await portalHas(browser, baseURL, filename, false);
  });
});
