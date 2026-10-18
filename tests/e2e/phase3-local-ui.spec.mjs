import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// This suite deliberately performs approval and message writes. It is allowed
// ONLY inside disposable CI local Supabase, never live NHS / remote Supabase.
const apiURL = process.env.NHS_LOCAL_SUPABASE_URL;
const adminKey = process.env.NHS_LOCAL_SUPABASE_ADMIN_KEY;
const pubKey = process.env.NHS_LOCAL_SUPABASE_PUBLIC_KEY;
const safe = process.env.CI === "true" &&
 /^http:\/\/(?:localhost|127\.0\.0\.1):54321\/?$/.test(apiURL || "") &&
 process.env.E2E_BASE_URL === "http://127.0.0.1:3000" &&
 process.env.NEXT_PUBLIC_SUPABASE_URL === apiURL &&
 !!adminKey && !!pubKey &&
 !process.env.SUPABASE_ACCESS_TOKEN && !process.env.SUPABASE_DB_PASSWORD;
test.describe("Disposable local Supabase client portal decisions and messages", () => {
  test.skip(!safe, "Real portal writes are permitted only against disposable CI localhost:54321.");

  test("client approval + change request + messages persist and remain private", async ({ page, browser, baseURL, isMobile }) => {
    test.setTimeout(230000);
    const opts = { auth: { persistSession: false, autoRefreshToken: false } };
    const srv = createClient(apiURL, adminKey, opts);
    const seed = randomUUID();
    const pass = "LocalOnlyStrongPassword!" + randomUUID();
    const emailAdmin = "ui-admin-" + seed + "@example.invalid";
    const emailA = "ui-a-" + seed + "@example.invalid";
    const emailB = "ui-b-" + seed + "@example.invalid";
    async function required(query, label) {
      const { data, error } = await query;
      expect(error, label + " error").toBeNull();
      expect(data, label + " returned no data").toBeTruthy();
      return data;
    }
    const adminUser = (await required(srv.auth.admin.createUser({
      email: emailAdmin, password: pass, email_confirm: true, app_metadata: { role: "admin" },
    }), "seed synthetic preview admin")).user;
    // Only the disposable localhost project receives trusted admin promotion.
    const adminProfile = await required(
      srv.from("profiles").update({ role: "admin" }).eq("id", adminUser.id).select("role").single(),
      "promote synthetic preview admin"
    );
    expect(adminProfile.role).toBe("admin");
    const userA = (await required(srv.auth.admin.createUser({
      email: emailA, password: pass, email_confirm: true, app_metadata: { role: "client" },
    }), "seed A")).user;
    const userB = (await required(srv.auth.admin.createUser({
      email: emailB, password: pass, email_confirm: true, app_metadata: { role: "client" },
    }), "seed B")).user;
    const clientA = randomUUID(), clientB = randomUUID(), projectA = randomUUID(), projectB = randomUUID();
    const approvalA = randomUUID(), approvalB = randomUUID(), approvalOther = randomUUID();
    const approveTitle = "Synthetic UI approval " + seed;
    const changeTitle = "Synthetic UI changes " + seed;
    const note = "Synthetic UI message " + seed;
    const docTitleA = "Synthetic UI Document A " + seed;
    const docTitleB = "Synthetic UI Document B " + seed;
    await required(srv.from("clients").insert([
      { id: clientA, name: "Synthetic UI Client A" },
      { id: clientB, name: "Synthetic UI Client B" },
    ]).select("id"), "clients");
    await required(srv.from("client_memberships").insert([
      { client_id: clientA, profile_id: userA.id },
      { client_id: clientB, profile_id: userB.id },
    ]).select("client_id"), "memberships");
    await required(srv.from("projects").insert([
      { id: projectA, client_id: clientA, name: "Synthetic UI Project A" },
      { id: projectB, client_id: clientB, name: "Synthetic UI Project B" },
    ]).select("id"), "projects");
    await required(srv.from("documents").insert([
      { project_id: projectA, title: docTitleA, kind: "handoff" },
      { project_id: projectB, title: docTitleB, kind: "other" },
    ]).select("id"), "documents");
    await required(srv.from("approvals").insert([
      { id: approvalA, project_id: projectA, title: approveTitle, status: "pending" },
      { id: approvalB, project_id: projectA, title: changeTitle, status: "pending" },
      { id: approvalOther, project_id: projectB, title: "Other client private approval", status: "pending" },
    ]).select("id"), "approvals");

    async function signIn(p, email) {
      await p.goto("/auth/sign-in");
      await p.locator('input[name="email"]').fill(email);
      await p.locator('input[name="password"]').fill(pass);
      await p.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(p.locator(".navigation-shell")).toBeVisible({ timeout: 30000 });
    }
    await signIn(page, emailA);

    // Real client visual previews from a disposable local Supabase project.
    // No real client records, hosted credentials, or production browser session.
    mkdirSync("design-preview", { recursive: true });
    const previewSuffix = isMobile ? "mobile" : "desktop";
    await page.goto("/portal");
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    await page.screenshot({ path: "design-preview/atelier-home-" + previewSuffix + ".png", fullPage: true });

    await page.goto("/portal/projects");
    await expect(page.locator("article.atelier-project-row")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Synthetic UI Project A" })).toBeVisible();
    await page.screenshot({ path: "design-preview/atelier-projects-" + previewSuffix + ".png", fullPage: true });

    await page.goto("/portal/documents");
    await expect(page.getByRole("heading", { name: "Everything in writing." })).toBeVisible();
    await page.screenshot({ path: "design-preview/atelier-documents-" + previewSuffix + ".png", fullPage: true });
    await expect(page.getByRole("heading", { name: "Everything in writing." })).toBeVisible();
    await expect(page.getByText(docTitleA, { exact: true })).toBeVisible();
    await expect(page.getByText(docTitleB, { exact: true })).toHaveCount(0);
    const documentRow = page.locator(".atelier-document-row").filter({ hasText: docTitleA });
    await documentRow.getByRole("link", { name: "View in project" }).click();
    await expect(page.locator('details#project-details')).toHaveAttribute("open", "");
    await expect(page.locator("article#documents")).toContainText(docTitleA);
    await page.goto("/portal/projects/" + projectA);
    await expect(page.getByRole("heading", { name: "Synthetic UI Project A", exact: true })).toBeVisible();

    const decisions = page.getByRole("region", { name: "Approvals needing your decision" });
    const approveRow = decisions.locator("li.delivery-row").filter({ hasText: approveTitle });

    // Hostile form-field mutation: Client A substitutes a Client B approval ID.
    // The server action must return an error and leave both approvals unchanged.
    const approvalTarget = approveRow.locator('input[name="approval_id"]');
    await approvalTarget.evaluate((el, foreignId) => { el.value = foreignId; }, approvalOther);
    await approveRow.locator('input[name="client_comment"]').fill("Tampered client approval");
    await approveRow.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(approveRow.getByRole("alert")).toContainText("couldn't save that decision");
    const untouchedOwn = (await required(srv.from("approvals").select("status").eq("id",approvalA), "own approval unchanged"))[0];
    const untouchedOther = (await required(srv.from("approvals").select("status").eq("id",approvalOther), "other approval unchanged"))[0];
    expect(untouchedOwn.status).toBe("pending");
    expect(untouchedOther.status).toBe("pending");

    // A failed action must not permanently lock the legitimate form.
    await approvalTarget.evaluate((el, ownId) => { el.value = ownId; }, approvalA);
    await approveRow.locator('input[name="client_comment"]').fill("Approved through local UI");
    await approveRow.getByRole("button", { name: "Approve", exact: true }).click();
    await expect.poll(async () => {
      const rows = await required(srv.from("approvals").select("status,decided_by,decided_at,client_comment").eq("id",approvalA), "persisted approval");
      return rows[0]?.status;
    }, { timeout: 25000 }).toBe("approved");
    const accepted = (await required(srv.from("approvals").select("status,decided_by,decided_at,client_comment").eq("id",approvalA), "decision row"))[0];
    expect(accepted.decided_by).toBe(userA.id);
    expect(accepted.decided_at).toBeTruthy();
    expect(accepted.client_comment).toBe("Approved through local UI");
    await page.reload();
    // Nocturne keeps decision history available but collapsed by default.
    await page.locator("details#project-details > summary").click();
    await expect(page.getByText(approveTitle, { exact: true })).toBeVisible();
    const changeRow = page.getByRole("region", { name: "Approvals needing your decision" })
      .locator("li.delivery-row").filter({ hasText: changeTitle });
    await changeRow.locator('input[name="client_comment"]').fill("Changes requested through local UI");
    await changeRow.getByRole("button", { name: "Request changes", exact: true }).click();
    await expect.poll(async () => {
      const rows = await required(srv.from("approvals").select("status").eq("id",approvalB), "decline row");
      return rows[0]?.status;
    }, { timeout: 25000 }).toBe("declined");
    // The approval action revalidates the entire server-rendered project page.
    // Wait until that transition has completed before submitting a message.
    // Otherwise, the old approval revalidation can unmount a message error.
    await expect(page.getByRole("region", { name: "Approvals needing your decision" })
      .locator("li.delivery-row").filter({ hasText: changeTitle })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Synthetic UI Project A", exact: true })).toBeVisible();

    // Open the optional Atelier conversation section before testing writes.
    const conversation = page.locator("details.atelier-discussion");
    await conversation.locator("summary").click();
    await expect(conversation).toHaveAttribute("open", "");
    const thread = page.getByRole("region", { name: "Messages" });

    // Hostile form-field mutation: use Client B's project ID while logged in as A.
    // The UI must report failure, preserve the typed message, and persist nothing.
    const messageTarget = thread.locator('input[name="project_id"]');
    const rejectedMessage = "Rejected cross-client UI message " + seed;
    await messageTarget.evaluate((el, foreignId) => { el.value = foreignId; }, projectB);
    await thread.locator('input[name="body"]').fill(rejectedMessage);
    await thread.getByRole("button", { name: "Send", exact: true }).click();
    await expect(thread.getByRole("alert")).toContainText("wasn't sent");
    await expect(thread.locator('input[name="body"]')).toHaveValue(rejectedMessage);
    expect(await required(srv.from("messages").select("id").eq("body",rejectedMessage), "no forged message persisted")).toHaveLength(0);

    // Restore the authorized project and prove the form works on retry.
    await messageTarget.evaluate((el, ownProject) => { el.value = ownProject; }, projectA);
    await thread.locator('input[name="body"]').fill(note);
    await thread.getByRole("button", { name: "Send", exact: true }).click();
    await expect.poll(async () => {
      const rows = await required(srv.from("messages").select("sender_id").eq("project_id",projectA).eq("body",note), "message persistence");
      return rows.length;
    }, { timeout: 25000 }).toBe(1);
    const saved = (await required(srv.from("messages").select("sender_id,body").eq("project_id",projectA).eq("body",note),"persisted message"))[0];
    expect(saved.sender_id).toBe(userA.id);
    await page.reload();
    await page.locator("details.atelier-discussion > summary").click();
    await expect(page.getByText(note, { exact: true })).toBeVisible();

    await page.goto("/portal/approvals");
    await expect(page.getByText("Other client private approval", { exact: true })).toHaveCount(0);
    await page.goto("/portal/messages");
    await expect(page.getByText(note, { exact: true })).toBeVisible();

    const ctxB = await browser.newContext({ baseURL });
    try {
      const b = await ctxB.newPage();
      await signIn(b,emailB);
      await b.goto("/portal/projects/" + projectA);
      await expect(b.getByRole("heading", { name: "That page isn't available.", exact: true })).toBeVisible();
      await b.goto("/portal/messages");
      await expect(b.getByText(note, { exact: true })).toHaveCount(0);
      await b.goto("/portal/approvals");
      await expect(b.getByText(approveTitle, { exact: true })).toHaveCount(0);
      await b.goto("/portal/documents");
      await expect(b.getByText(docTitleA, { exact: true })).toHaveCount(0);
      await expect(b.getByText(docTitleB, { exact: true })).toBeVisible();

      await expect(b.getByText(changeTitle, { exact: true })).toHaveCount(0);
    } finally {
      await ctxB.close();
    }

    // Capture the matching admin views using ONLY synthetic CI identities.
    const adminContext = await browser.newContext({
      baseURL,
      viewport: isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    });
    try {
      const adminPage = await adminContext.newPage();
      await signIn(adminPage, emailAdmin);
      await adminPage.goto("/");
      await expect(adminPage.getByRole("heading", { name: "Your studio, in focus." })).toBeVisible();
      await adminPage.screenshot({ path: "design-preview/nocturne-admin-home-" + previewSuffix + ".png", fullPage: true });
      await adminPage.goto("/projects");
      await expect(adminPage.getByRole("heading", { name: "Delivery without the scavenger hunt." })).toBeVisible();
      await adminPage.screenshot({ path: "design-preview/nocturne-admin-pipeline-" + previewSuffix + ".png", fullPage: true });
      await adminPage.goto("/projects/" + projectA);
      await expect(adminPage.getByRole("heading", { name: "Synthetic UI Project A" })).toBeVisible();
      await adminPage.screenshot({ path: "design-preview/nocturne-admin-project-" + previewSuffix + ".png", fullPage: true });
    } finally {
      await adminContext.close();
    }

    // Explicit sign-out affordance must invalidate the session, not just hide UI.
    const desktopSignOut = page.locator(".nhs-context-bar .nhs-sign-out");
    if (await desktopSignOut.isVisible()) {
      await desktopSignOut.click();
    } else {
      await page.locator(".mobile-topbar .nhs-mobile-sign-out").click();
    }
    await expect(page).toHaveURL(new RegExp("/auth/sign-in"), { timeout: 15000 });
    await page.goto("/portal");
    await expect(page).toHaveURL(new RegExp("/auth/sign-in"));
  });
});
