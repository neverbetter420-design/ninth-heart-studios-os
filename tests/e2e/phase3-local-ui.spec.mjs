import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";

// This suite performs portal, lead, relationship and document workflow writes. It is allowed
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
    test.setTimeout(300000);
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
    await expect(page.locator('details#project-resources')).toHaveAttribute("open", "");
    await expect(page.locator("article#documents")).toContainText(docTitleA);
    await page.goto("/portal/projects/" + projectA);
    await expect(page.getByRole("heading", { name: "Synthetic UI Project A", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Project journey" })).toBeVisible();
    await page.screenshot({ path: "design-preview/atelier-workspace-" + previewSuffix + ".png", fullPage: true });
    // Each project destination opens its own group without exposing unrelated
    // client records. Exercise real pointer navigation on desktop and mobile.
    for (const [label, target] of [["Files", "project-resources"], ["Documents", "project-resources"], ["Design feedback", "design-feedback"], ["Messages", "messages"], ["Project details", "project-details"]]) {
      await page.getByRole("navigation", { name: "Project destinations" }).getByRole("link", { name: label, exact: true }).click();
      if (target === "messages") await expect(page.locator("details.atelier-discussion")).toHaveAttribute("open", "");
      else await expect(page.locator("details#" + target)).toHaveAttribute("open", "");
      if (target === "project-resources") {
        await page.locator("details#project-resources > summary").click();
        await expect(page.locator("details#project-resources")).not.toHaveAttribute("open", "");
        await page.getByRole("navigation", { name: "Project destinations" }).getByRole("link", { name: label, exact: true }).click();
        await expect(page.locator("details#project-resources")).toHaveAttribute("open", "");
      }
    }
    await page.goto("/portal/projects/" + projectA);

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

      // Exercise the redesigned lead forms against this disposable database.
      const leadName = "Synthetic UI Lead " + seed;
      await adminPage.goto("/leads#quick-capture");
      const capture = adminPage.getByRole("region", { name: "Quick capture" });
      await capture.getByLabel("Business name").fill(leadName);
      await capture.locator("details > summary").click();
      await capture.getByLabel("Business email").fill("synthetic-lead@example.invalid");
      await capture.getByLabel("Opportunity score").fill("82");
      await capture.getByRole("button", { name: "Capture lead", exact: true }).click();
      await expect(adminPage.getByRole("heading", { name: leadName, exact: true })).toBeVisible();
      const leadId = new URL(adminPage.url()).pathname.split("/").pop();
      const capturedLead = (await required(srv.from("leads").select("business_name,email,score").eq("id", leadId), "captured lead"))[0];
      expect(capturedLead).toMatchObject({ business_name: leadName, email: "synthetic-lead@example.invalid", score: 82 });
      await adminPage.getByRole("button", { name: "Received Reply", exact: true }).click();
      await expect(adminPage.getByRole("status")).toContainText("Lead activity logged.");
      await expect.poll(async () => (await required(srv.from("leads").select("next_action_kind").eq("id", leadId), "reply priority"))[0].next_action_kind).toBe("reply");
      await adminPage.getByLabel("Pacific time").fill("2099-04-12T10:00");
      await adminPage.getByRole("button", { name: "Schedule consultation", exact: true }).click();
      await expect.poll(async () => (await required(srv.from("leads").select("consultation_at").eq("id", leadId), "consultation persisted"))[0].consultation_at).toContain("2099-04-12");
      await adminPage.reload();
      await expect(adminPage.locator(".consultation-panel .micro-copy")).toHaveText("Current: Apr 12, 10:00 AM PDT");
      await adminPage.screenshot({ path: "design-preview/nocturne-lead-detail-" + previewSuffix + ".png", fullPage: true });
      await adminPage.goto("/leads");
      await expect(adminPage.getByRole("link", { name: "Open lead: " + leadName, exact: true })).toBeVisible();
      await adminPage.screenshot({ path: "design-preview/nocturne-leads-" + previewSuffix + ".png", fullPage: true });
      await adminPage.getByRole("link", { name: "Open lead: " + leadName, exact: true }).click();
      await adminPage.locator("details.lead-conversion > summary").click();
      const convertedName = "Synthetic converted project " + seed;
      await adminPage.getByLabel("Project name (optional)").fill(convertedName);
      await adminPage.getByRole("button", { name: "Convert to project", exact: true }).click();
      await expect(adminPage.getByRole("heading", { name: convertedName, exact: true })).toBeVisible();
      const convertedId = new URL(adminPage.url()).pathname.split("/").pop();
      const converted = (await required(srv.from("projects").select("status,client_id").eq("id", convertedId), "converted project persisted"))[0];
      const linkedLead = (await required(srv.from("leads").select("client_id").eq("id", leadId), "lead client linked"))[0];
      expect(converted.status).toBe("discovery");
      expect(converted.client_id).toBe(linkedLead.client_id);

      // Client relationship and vertical pipeline workflows: disposable records only.
      const managedName = "Synthetic managed client " + seed;
      await adminPage.goto("/clients");
      const newClient = adminPage.locator('details[aria-label="New client"]');
      await newClient.locator("summary").click();
      await newClient.getByLabel("Client / business name").fill(managedName);
      await newClient.getByLabel("Primary email (optional)").fill("managed@example.invalid");
      await newClient.getByRole("button", { name: "Create client", exact: true }).click();
      await expect(adminPage.getByRole("heading", { name: managedName, exact: true })).toBeVisible();
      const managedId = new URL(adminPage.url()).pathname.split("/").pop();
      expect((await required(srv.from("clients").select("name,primary_email,status").eq("id", managedId), "managed client persisted"))[0]).toMatchObject({ name: managedName, primary_email: "managed@example.invalid", status: "active" });
      await adminPage.getByRole("link", { name: "New project", exact: true }).click();
      const newProject = adminPage.locator('details[aria-label="New project"]');
      await expect(newProject).toHaveAttribute("open", "");
      await expect(newProject.getByLabel("Client", { exact: true })).toHaveValue(managedId);
      const managedProjectName = "Synthetic managed project " + seed;
      await newProject.getByLabel("Project name", { exact: true }).fill(managedProjectName);
      await newProject.getByRole("button", { name: "Create project", exact: true }).click();
      await expect(adminPage.getByRole("heading", { name: managedProjectName, exact: true })).toBeVisible();
      const managedProjectId = new URL(adminPage.url()).pathname.split("/").pop();
      await adminPage.goto("/projects");
      const pipelineRow = adminPage.locator('[data-project-id="' + managedProjectId + '"]');
      await expect(adminPage.locator("#phase-discovery")).toContainText(managedProjectName);
      await pipelineRow.locator("summary").click();
      await pipelineRow.getByRole("combobox").selectOption("build");
      await pipelineRow.getByRole("button", { name: "Move", exact: true }).click();
      await expect(adminPage.locator(".action-notification").getByRole("status")).toHaveText("Project stage updated.");
      await expect.poll(async () => (await required(srv.from("projects").select("status").eq("id", managedProjectId), "phase change persisted"))[0].status).toBe("build");
      await adminPage.reload();
      await expect(adminPage.locator("#phase-build")).toContainText(managedProjectName);

      await adminPage.goto("/clients/" + managedId);
      await adminPage.getByLabel("Member's account email").fill(emailB);
      await adminPage.getByRole("button", { name: "Add member", exact: true }).click();
      await expect.poll(async () => (await required(srv.from("client_memberships").select("profile_id").eq("client_id", managedId).eq("profile_id", userB.id), "new member persisted")).length).toBe(1);
      const accessContext = await browser.newContext({ baseURL });
      try {
        const memberPage = await accessContext.newPage();
        await signIn(memberPage, emailB);
        await memberPage.goto("/portal/projects/" + managedProjectId);
        await expect(memberPage.getByRole("heading", { name: managedProjectName, exact: true })).toBeVisible();
        await adminPage.reload();
        adminPage.once("dialog", dialog => dialog.accept());
        await adminPage.locator(".management-member-row").filter({ hasText: emailB }).getByRole("button", { name: "Remove", exact: true }).click();
        await expect.poll(async () => (await required(srv.from("client_memberships").select("profile_id").eq("client_id", managedId).eq("profile_id", userB.id), "member removal persisted")).length).toBe(0);
        await memberPage.reload();
        await expect(memberPage.getByRole("heading", { name: "That page isn't available.", exact: true })).toBeVisible();
        await memberPage.goto("/portal/projects/" + projectB);
        await expect(memberPage.getByRole("heading", { name: "Synthetic UI Project B", exact: true })).toBeVisible();
      } finally { await accessContext.close(); }

      const clientStatus = adminPage.getByRole("region", { name: "Client status", exact: true });
      await clientStatus.getByRole("button", { name: "Archive client", exact: true }).click();
      await expect.poll(async () => (await required(srv.from("clients").select("status").eq("id", managedId), "archived client persisted"))[0].status).toBe("archived");
      await adminPage.reload();
      await clientStatus.getByRole("button", { name: "Restore client", exact: true }).click();
      await expect.poll(async () => (await required(srv.from("clients").select("status").eq("id", managedId), "restored client persisted"))[0].status).toBe("active");
      await adminPage.goto("/clients");
      await adminPage.screenshot({ path: "design-preview/nocturne-clients-" + previewSuffix + ".png", fullPage: true });
      await adminPage.getByRole("link", { name: "Open client: " + managedName, exact: true }).click();
      await expect(adminPage.getByRole("link", { name: managedProjectName })).toBeVisible();
      await adminPage.screenshot({ path: "design-preview/nocturne-client-workspace-" + previewSuffix + ".png", fullPage: true });

      // Document workflows use only this disposable stack and the existing UI actions.
      const textTemplateName = "Synthetic contract text " + seed;
      const terms = "Synthetic local terms " + seed;
      await adminPage.goto("/templates");
      const newText = adminPage.locator('details[aria-label="New template"]');
      await newText.locator("summary").click();
      await newText.getByLabel("Template name", { exact: true }).fill(textTemplateName);
      await newText.getByLabel("Reusable text", { exact: true }).fill(terms);
      await newText.getByRole("button", { name: "Create template", exact: true }).click();
      await expect(adminPage.getByRole("heading", { name: textTemplateName, exact: true })).toBeVisible();
      const textTemplateId = new URL(adminPage.url()).pathname.split("/").pop();
      await adminPage.getByLabel("Reusable text", { exact: true }).fill(terms + " saved");
      await adminPage.getByRole("button", { name: "Save template", exact: true }).click();
      await expect.poll(async () => (await required(srv.from("templates").select("content").eq("id", textTemplateId), "template text persisted"))[0].content.body).toBe(terms + " saved");
      await adminPage.getByRole("button", { name: "Archive template", exact: true }).click();
      await expect.poll(async () => (await required(srv.from("templates").select("active").eq("id", textTemplateId), "template archive persisted"))[0].active).toBe(false);
      await adminPage.goto("/templates?state=archived");
      await adminPage.getByRole("link", { name: "Open template: " + textTemplateName, exact: true }).click();
      await adminPage.getByRole("button", { name: "Restore template", exact: true }).click();
      await expect.poll(async () => (await required(srv.from("templates").select("active").eq("id", textTemplateId), "template restore persisted"))[0].active).toBe(true);
      await adminPage.goto("/templates");
      await adminPage.screenshot({ path: "design-preview/nocturne-templates-" + previewSuffix + ".png", fullPage: true });

      const agreementName = "Synthetic UI agreement " + seed;
      await adminPage.goto("/contracts");
      const newContract = adminPage.locator('details[aria-label="New contract"]');
      await newContract.locator("summary").click();
      await newContract.getByLabel("Contract title", { exact: true }).fill(agreementName);
      await newContract.getByLabel("Project", { exact: true }).selectOption(projectA);
      await newContract.getByLabel("Text template (optional)", { exact: true }).selectOption(textTemplateId);
      await newContract.getByRole("button", { name: "Create draft", exact: true }).click();
      await expect(adminPage.getByRole("heading", { name: agreementName, exact: true })).toBeVisible();
      const contractId = new URL(adminPage.url()).pathname.split("/").pop();
      expect((await required(srv.from("contracts").select("body,template_id,status,project_id").eq("id", contractId), "contract template copied"))[0]).toMatchObject({ body: terms + " saved", template_id: textTemplateId, status: "draft", project_id: projectA });
      await adminPage.getByLabel("Terms", { exact: true }).fill(terms + " final");
      await adminPage.getByRole("button", { name: "Save draft", exact: true }).click();
      await expect.poll(async () => (await required(srv.from("contracts").select("body").eq("id", contractId), "contract terms persisted"))[0].body).toBe(terms + " final");
      await adminPage.getByRole("button", { name: "Send for signature", exact: true }).click();
      await expect.poll(async () => (await required(srv.from("contracts").select("status").eq("id", contractId), "contract sent"))[0].status).toBe("sent");
      await adminPage.reload();
      await expect(adminPage.locator('textarea[name="body"]')).toHaveCount(0);
      await page.goto("/portal/projects/" + projectA + "?section=contracts#contracts");
      const signing = page.locator("#contracts details").filter({ hasText: agreementName });
      await signing.locator("summary").click();
      await signing.getByLabel("Your full name", { exact: true }).fill("Synthetic Client A");
      await signing.getByLabel("Your email", { exact: true }).fill(emailA);
      await signing.getByLabel("I have read these terms and agree to them.", { exact: true }).check();
      await signing.getByRole("button", { name: "Sign contract", exact: true }).click();
      await expect.poll(async () => (await required(srv.from("contracts").select("status").eq("id", contractId), "contract signature persisted"))[0].status).toBe("signed");
      await adminPage.reload();
      await expect(adminPage.getByRole("region", { name: "Signature audit" })).toContainText("Synthetic Client A");
      await expect(adminPage.locator("#contract-signature code")).toHaveText(/^[a-f0-9]{64}$/);
      await adminPage.screenshot({ path: "design-preview/nocturne-contract-workspace-" + previewSuffix + ".png", fullPage: true });
      await adminPage.goto("/contracts");
      await adminPage.screenshot({ path: "design-preview/nocturne-contracts-" + previewSuffix + ".png", fullPage: true });

      const formName = "Synthetic UI intake " + seed;
      await adminPage.goto("/forms");
      const newForm = adminPage.locator('details[aria-label="New form"]');
      await newForm.locator("summary").click();
      await newForm.getByLabel("Form name", { exact: true }).fill(formName);
      await newForm.getByLabel("Category", { exact: true }).selectOption("document");
      await newForm.getByRole("button", { name: "Create form", exact: true }).click();
      await expect(adminPage.getByRole("heading", { name: formName, exact: true })).toBeVisible();
      const formId = new URL(adminPage.url()).pathname.split("/").pop();
      await adminPage.getByLabel("Field label", { exact: true }).fill("Business name");
      await adminPage.getByLabel("Required field", { exact: true }).check();
      await adminPage.getByRole("button", { name: "Add field", exact: true }).click();
      await expect.poll(async () => (await required(srv.from("form_templates").select("fields").eq("id", formId), "form field persisted"))[0].fields.length).toBe(1);
      const formFields = (await required(srv.from("form_templates").select("fields").eq("id", formId), "required form field"))[0].fields;
      expect(formFields[0]).toMatchObject({ label: "Business name", type: "text", required: true });
      const sendForm = adminPage.getByRole("region", { name: "Send form", exact: true });
      await sendForm.getByLabel("Project", { exact: true }).selectOption(projectA);
      await sendForm.getByRole("button", { name: "Send form", exact: true }).click();
      await expect.poll(async () => (await required(srv.from("form_submissions").select("id").eq("template_id", formId).eq("project_id", projectA), "sent form persisted")).length).toBe(1);
      await page.goto("/portal/projects/" + projectA + "?section=forms#forms");
      const filling = page.locator("#forms details").filter({ hasText: formName });
      await filling.locator("summary").click();
      await filling.getByLabel("Business name", { exact: false }).fill("Synthetic Client A business");
      await filling.getByRole("button", { name: "Submit", exact: true }).click();
      await expect.poll(async () => (await required(srv.from("form_submissions").select("status").eq("template_id", formId), "form submission persisted"))[0].status).toBe("submitted");
      expect((await required(srv.from("form_submissions").select("values").eq("template_id", formId), "form answers persisted"))[0].values[formFields[0].id]).toBe("Synthetic Client A business");
      await adminPage.reload();
      await expect(adminPage.getByRole("region", { name: "Submissions", exact: true })).toContainText("Submitted");
      await adminPage.screenshot({ path: "design-preview/nocturne-form-workspace-" + previewSuffix + ".png", fullPage: true });
      await adminPage.getByRole("button", { name: "Archive form", exact: true }).click();
      await expect.poll(async () => (await required(srv.from("form_templates").select("active").eq("id", formId), "form archive persisted"))[0].active).toBe(false);
      await adminPage.goto("/forms?state=archived");
      await adminPage.getByRole("link", { name: "Open form: " + formName, exact: true }).click();
      await expect(adminPage.getByRole("button", { name: "Send form", exact: true })).toBeDisabled();
      await adminPage.getByRole("button", { name: "Activate form", exact: true }).click();
      await expect.poll(async () => (await required(srv.from("form_templates").select("active").eq("id", formId), "form activation persisted"))[0].active).toBe(true);

      // Import an AcroForm fixture, retain its private source, and review it inactive.
      const pdf = await PDFDocument.create();
      const pdfPage = pdf.addPage();
      pdf.getForm().createTextField("BusinessName").addToPage(pdfPage, { x: 40, y: 700, width: 220, height: 30 });
      await adminPage.goto("/forms");
      const importer = adminPage.locator('details[aria-label="Import PDF"]');
      await importer.locator("summary").click();
      const importName = "Synthetic PDF review " + seed;
      await importer.getByLabel("Imported form name", { exact: true }).fill(importName);
      await importer.getByLabel("PDF file · up to 25 MB", { exact: true }).setInputFiles({ name: "synthetic-reference.pdf", mimeType: "application/pdf", buffer: Buffer.from(await pdf.save()) });
      await importer.getByRole("button", { name: "Import PDF", exact: true }).click();
      await expect(adminPage.getByRole("heading", { name: importName, exact: true })).toBeVisible();
      const importedId = new URL(adminPage.url()).pathname.split("/").pop();
      const imported = (await required(srv.from("form_templates").select("active,fields,source_file_path").eq("id", importedId), "PDF import persisted"))[0];
      expect(imported.active).toBe(false);
      expect(imported.fields).toHaveLength(1);
      expect(imported.source_file_path).toContain("templates/" + importedId + "/");
      await expect(adminPage.getByRole("button", { name: "Send form", exact: true })).toBeDisabled();
      await expect(adminPage.getByRole("link", { name: /synthetic-reference.pdf/ })).toHaveAttribute("href", /\/storage\/v1\/object\/sign\/form-sources\//);
      await adminPage.goto("/forms?state=archived");
      await expect(adminPage.getByRole("link", { name: "Open form: " + importName, exact: true })).toBeVisible();
      await adminPage.goto("/forms");
      await adminPage.screenshot({ path: "design-preview/nocturne-forms-" + previewSuffix + ".png", fullPage: true });

      // Muse stays in draft mode in this isolated workflow; no Gmail secrets or sends.
      await adminPage.goto("/muse#muse-compose");
      await adminPage.getByLabel("Draft kind", { exact: true }).selectOption("check_in");
      await adminPage.getByLabel("Target", { exact: true }).selectOption("project:" + managedProjectId);
      await adminPage.getByRole("button", { name: "Generate draft", exact: true }).click();
      await expect(adminPage.getByLabel("Draft text", { exact: true })).toBeVisible();
      await expect(adminPage.getByLabel("Target", { exact: true })).toHaveValue("project:" + managedProjectId);
      const museSubject = "Synthetic Muse draft " + seed;
      const museBody = "Reviewed local draft " + seed;
      await adminPage.getByLabel("Subject", { exact: true }).fill(museSubject);
      await adminPage.getByLabel("Draft text", { exact: true }).fill(museBody);
      await adminPage.getByRole("button", { name: "Save draft", exact: true }).click();
      await expect.poll(async () => (await required(srv.from("muse_drafts").select("id").eq("subject", museSubject), "Muse draft persisted")).length).toBe(1);
      const museDraft = (await required(srv.from("muse_drafts").select("id,kind,body,project_id,status").eq("subject", museSubject), "Muse draft readback"))[0];
      expect(museDraft).toMatchObject({ kind: "check_in", body: museBody, project_id: managedProjectId, status: "draft" });
      await adminPage.goto("/muse#muse-saved");
      const savedMuse = adminPage.locator('[data-draft-id="' + museDraft.id + '"]');
      await savedMuse.locator(":scope > summary").click();
      await expect(savedMuse.locator(".studio-draft-body")).toHaveText(museBody);
      await expect(adminPage.locator(".studio-send")).toHaveCount(0);
      await adminPage.evaluate(() => window.scrollTo(0,0));
      await adminPage.screenshot({ path: "design-preview/nocturne-muse-" + previewSuffix + ".png", fullPage: true });
      await savedMuse.getByRole("button", { name: "Archive draft", exact: true }).click();
      await expect.poll(async () => (await required(srv.from("muse_drafts").select("status").eq("id", museDraft.id), "Muse archive persisted"))[0].status).toBe("archived");
      await adminPage.reload();
      await expect(adminPage.locator('[data-draft-id="' + museDraft.id + '"]')).toHaveCount(0);
      await adminPage.goto("/settings");
      await expect(adminPage.getByRole("region", { name: "Connections", exact: true })).toContainText("Read check passed");
      await expect(adminPage.getByRole("region", { name: "Connections", exact: true })).toContainText("Not configured");
      await adminPage.evaluate(() => window.scrollTo(0,0));
      await adminPage.screenshot({ path: "design-preview/nocturne-settings-" + previewSuffix + ".png", fullPage: true });

      await adminPage.goto("/projects");
      await expect(adminPage.getByRole("heading", { name: /Every project,/ })).toBeVisible();
      await adminPage.screenshot({ path: "design-preview/nocturne-admin-pipeline-" + previewSuffix + ".png", fullPage: true });
      await adminPage.goto("/projects/" + projectA);
      await expect(adminPage.getByRole("heading", { name: "Synthetic UI Project A" })).toBeVisible();
      await adminPage.screenshot({ path: "design-preview/nocturne-admin-project-" + previewSuffix + ".png", fullPage: true });
      for (const [label, target] of [["Design & feedback", "workspace-collaboration"], ["Files & documents", "workspace-resources"], ["Conversation", "workspace-conversation"], ["Delivery", "workspace-delivery"]]) {
        await adminPage.getByRole("navigation", { name: "Project destinations" }).getByRole("link", { name: label, exact: true }).click();
        await expect(adminPage.locator("details#" + target)).toHaveAttribute("open", "");
        await adminPage.locator("details#" + target + " > summary").click();
        await expect(adminPage.locator("details#" + target)).not.toHaveAttribute("open", "");
        await adminPage.getByRole("navigation", { name: "Project destinations" }).getByRole("link", { name: label, exact: true }).click();
        await expect(adminPage.locator("details#" + target)).toHaveAttribute("open", "");
      }
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
