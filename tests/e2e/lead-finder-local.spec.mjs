import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Functional scanner acceptance, backed by a disposable localhost Supabase stack.
// This suite MUST NOT run against the production database, even with test records.
const base = process.env.NHS_LOCAL_SUPABASE_URL;
const adminKey = process.env.NHS_LOCAL_SUPABASE_ADMIN_KEY;
const publicKey = process.env.NHS_LOCAL_SUPABASE_PUBLIC_KEY;
const safe = process.env.CI === "true" &&
  /^http:\/\/(?:localhost|127\.0\.0\.1):54321\/?$/.test(base || "") &&
  process.env.E2E_BASE_URL === "http://127.0.0.1:3000" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL === base &&
  !!adminKey && !!publicKey &&
  !process.env.SUPABASE_ACCESS_TOKEN && !process.env.SUPABASE_DB_PASSWORD;

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
async function must(query, name) {
  const { data, error } = await query;
  expect(error, name).toBeNull();
  expect(data, name + " has data").toBeTruthy();
  return data;
}

test.describe("Lead Finder 2.0: isolated functional acceptance", () => {
  test.skip(!safe, "Scanner writes are permitted only in disposable CI Supabase localhost.");

  test("saved search → review → manual import → duplicate guard → client isolation", async ({ page }) => {
    test.setTimeout(180000);
    const service = createClient(base, adminKey, opts);
    const seed = randomUUID();
    const pwd = "LocalOnlyScannerQA!" + randomUUID();
    const adminEmail = "scanner-admin-" + seed + "@example.invalid";
    const clientEmail = "scanner-client-" + seed + "@example.invalid";
    const adminUser = (await must(service.auth.admin.createUser({
      email: adminEmail, password: pwd, email_confirm: true,
      app_metadata: { role: "admin" },
    }), "create scanner admin")).user;
    await must(service.from("profiles").update({ role: "admin" })
      .eq("id", adminUser.id).select("id").single(), "promote scanner admin");
    const clientUser = (await must(service.auth.admin.createUser({
      email: clientEmail, password: pwd, email_confirm: true,
      app_metadata: { role: "client" },
    }), "create scanner client")).user;

    const name = "Synthetic Cedar & Stone " + seed.slice(0, 8);
    // Each desktop/mobile test owns a distinct OSM identity in the shared
    // disposable database; the second search *within* that test reuses it.
    const fixtureNodeId = BigInt("0x" + seed.replaceAll("-", "").slice(0, 15));
    const sourceRef = "node:" + fixtureNodeId.toString();
    const socialOnlyRef = "node:" + (fixtureNodeId + 1n).toString();
    const first = await must(service.from("lead_search_requests").insert({
      owner_id: adminUser.id, source: "openstreetmap", location: "Puyallup, WA",
      industry: "Restaurants", niches: ["restaurants"], radius_mi: 5,
      result_limit: 5, auto_import: false, top_count: 3,
      status: "complete", result_count: 2, imported_count: 0,
      completed_at: new Date().toISOString(),
    }).select("id,auto_import").single(), "save search");
    expect(first.auto_import).toBe(false);

    const records = await must(service.from("lead_search_results").insert([{
      search_id: first.id, business_name: name, source_ref: sourceRef,
      industry: "restaurant", address: "123 Main St, Puyallup, WA",
      website: "https://example.com/", phone: "253-555-0123",
      source: "openstreetmap", discovery_score: 70, import_status: "ready",
      details: { social_profiles: [{
        platform: "instagram", url: "https://www.instagram.com/cedarandstone/",
        status: "unconfirmed",
      }] },
    }, {
      search_id: first.id, business_name: "Social-only synthetic business",
      source_ref: socialOnlyRef, industry: "restaurant",
      address: "Puyallup, WA", website: "https://www.instagram.com/onlysocial/",
      source: "openstreetmap", discovery_score: 5, import_status: "needs_verification",
      details: { social_profiles: [{
        platform: "instagram", url: "https://www.instagram.com/onlysocial/",
        status: "unconfirmed",
      }] },
    }]).select("id,source_ref"), "save two review results");
    const ready = records.find(r => r.source_ref === sourceRef);
    expect(ready).toBeTruthy();

    await page.goto("/auth/sign-in");
    await page.locator('input[name="email"]').fill(adminEmail);
    await page.locator('input[name="password"]').fill(pwd);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator(".navigation-shell")).toBeVisible({ timeout: 30000 });
    await page.goto("/leads/discover?search=" + first.id);
    const finder = page.getByRole("region", { name: "Softr-style Lead Finder" });
    await expect(finder).toContainText("Recent searches");
    await expect(finder).toContainText("Puyallup, WA");
    await expect(finder.locator("article.nhs-finder-result")).toHaveCount(2);
    await expect(finder.locator('input[name="auto_import"]')).not.toBeChecked();
    const eligible = finder.locator("article.nhs-finder-result").filter({ hasText: name });
    await expect(eligible).toContainText("Official website listed");
    await expect(eligible).toContainText("Verify profile");
    await expect(eligible.getByRole("button", { name: /Import lead/ })).toBeVisible();
    const socialOnly = finder.locator("article.nhs-finder-result").filter({ hasText: "Social-only synthetic business" });
    await expect(socialOnly).toContainText("Official website not confirmed");
    await expect(socialOnly.getByRole("button", { name: /Import lead/ })).toHaveCount(0);

    // A second already-reviewed search can race the original if both imports
    // are manually clicked. Its result must become a duplicate after import.
    const second = await must(service.from("lead_search_requests").insert({
      owner_id: adminUser.id, source: "openstreetmap", location: "Puyallup, WA",
      industry: "Restaurants", niches: ["restaurants"], radius_mi: 5,
      result_limit: 5, status: "complete", result_count: 1, auto_import: false,
      completed_at: new Date().toISOString(),
    }).select("id").single(), "save second search");
    await must(service.from("lead_search_results").insert({
      search_id: second.id, business_name: name, source_ref: sourceRef,
      industry: "restaurant", address: "123 Main St, Puyallup, WA",
      website: "https://example.com/", source: "openstreetmap",
      discovery_score: 70, import_status: "ready",
    }).select("id").single(), "save already-reviewed duplicate");

    await eligible.getByRole("button", { name: /Import lead/ }).click();
    await expect(page).toHaveURL(/msg=Lead\+imported/);
    await expect(page.getByRole("region", { name: "Softr-style Lead Finder" })
      .getByText("✓ In Leads")).toBeVisible();
    const firstLead = await must(service.from("leads").select("id,business_name,metadata")
      .eq("business_name", name).single(), "CRM lead");
    expect(firstLead.metadata.source_ref).toBe(sourceRef);
    expect(firstLead.metadata.source).toBe("nhs_lead_finder_v2");
    expect(firstLead.metadata.import_key).toBeTruthy();
    const firstResult = await must(service.from("lead_search_results")
      .select("imported,import_status,lead_id").eq("id",ready.id).single(), "imported result");
    expect(firstResult).toMatchObject({ imported: true, import_status: "imported", lead_id: firstLead.id });

    await page.goto("/leads/discover?search=" + second.id);
    const duplicated = page.locator("article.nhs-finder-result").filter({ hasText: name });
    await expect(duplicated.getByRole("button", { name: /Import lead/ })).toBeVisible();
    await duplicated.getByRole("button", { name: /Import lead/ }).click();
    await expect(page).toHaveURL(/msg=Import\+skipped/);
    const secondResult = await must(service.from("lead_search_results")
      .select("duplicate,import_status").eq("search_id", second.id).single(), "duplicate result");
    expect(secondResult).toMatchObject({ duplicate: true, import_status: "duplicate" });
    const { count, error: countErr } = await service.from("leads")
      .select("id", { count: "exact", head: true }).eq("business_name", name);
    expect(countErr).toBeNull();
    expect(count).toBe(1);

    // Signed-in clients cannot read the admin-only queue, even via REST.
    const client = createClient(base, publicKey, opts);
    await must(client.auth.signInWithPassword({
      email: clientEmail, password: pwd,
    }), "client sign in");
    for (const table of ["lead_search_requests", "lead_search_results"]) {
      const { data, error } = await client.from(table).select("id").limit(5);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
    expect(clientUser.id).toBeTruthy();
    await page.goto("/auth/sign-in");
    // Admin session remains isolated from the separate REST client session.
    // RLS checks above prove the API cannot be bypassed.
  });
});
