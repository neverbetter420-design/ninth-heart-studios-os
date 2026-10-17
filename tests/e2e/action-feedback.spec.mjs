import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

// Exercise the real form component in an isolated browser document. No app
// routes, authentication shortcuts, Supabase requests or customer writes.
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
let fixtureBundle;

test.beforeAll(async () => {
  const result = await build({
    absWorkingDir: repoRoot,
    stdin: {
      resolveDir: repoRoot,
      sourcefile: "action-feedback-fixture.tsx",
      loader: "tsx",
      contents: `
        import React from "react";
        import { createRoot } from "react-dom/client";
        import { PortalActionForm } from "./components/portal/PortalActionForm";
        import { ActionNotifications } from "./components/ActionNotifications";

        const calls = [];
        const pending = [];
        window.actionFixture = {
          calls,
          resolveNext(status, message) {
            const deferred = pending.shift();
            if (!deferred) throw new Error("No pending action to resolve");
            deferred.resolve({ status, message });
          },
          rejectNext(message) {
            const deferred = pending.shift();
            if (!deferred) throw new Error("No pending action to reject");
            deferred.reject(new Error(message));
          },
        };
        async function action(_previous, formData) {
          calls.push(Object.fromEntries(formData.entries()));
          return new Promise((resolve, reject) => pending.push({ resolve, reject }));
        }

        function Fixture() {
          const [showRemove, setShowRemove] = React.useState(true);
          window.actionFixture.removeForm = () => setShowRemove(false);
          return (
          <React.Fragment>
            <ActionNotifications />
            <section aria-label="Create fixture">
              <PortalActionForm action={action} pendingMessage="Saving draft…" lockOnSuccess={false} resetOnSuccess>
                <input type="hidden" name="kind" value="create" />
                <label>Draft title<input name="title" required /></label>
                <button type="submit">Create draft</button>
              </PortalActionForm>
            </section>
            {showRemove ? <section aria-label="Remove fixture">
              <PortalActionForm action={action} pendingMessage="Removing member…" confirmMessage="Remove this member from this client?">
                <input type="hidden" name="kind" value="remove" />
                <label>Removal note<input name="note" /></label>
                <button type="submit">Remove member</button>
              </PortalActionForm>
            </section> : null}
          </React.Fragment>
          );
        }
        createRoot(document.getElementById("root")).render(<Fixture />);
      `,
    },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  fixtureBundle = result.outputFiles[0].text;
});

async function mountFixture(page) {
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.route("**/*", (route) => route.abort());
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="root"></main></body></html>');
  await page.addScriptTag({ content: fixtureBundle });
  await expect(page.getByRole("button", { name: "Create draft" })).toBeVisible();
  return requests;
}

async function resolveAction(page, status, message) {
  await page.evaluate(({ status, message }) => window.actionFixture.resolveNext(status, message), { status, message });
}

async function actionCalls(page) {
  return page.evaluate(() => window.actionFixture.calls);
}

test("canceling destructive confirmation does not dispatch an action", async ({ page }) => {
  const requests = await mountFixture(page);
  const remove = page.getByRole("region", { name: "Remove fixture" });
  const dialogs = [];
  page.once("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await remove.getByRole("button", { name: "Remove member" }).click();
  expect(dialogs).toEqual(["Remove this member from this client?"]);
  expect(await actionCalls(page)).toEqual([]);
  await expect(remove.locator("form")).toHaveAttribute("aria-busy", "false");
  await expect(remove.getByRole("button")).toBeEnabled();
  await expect(remove.getByRole("status")).toHaveCount(0);
  await expect(page.locator(".action-notification")).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("accepted removal disables pending controls, prevents duplicates, and locks after success", async ({ page }) => {
  const requests = await mountFixture(page);
  const remove = page.getByRole("region", { name: "Remove fixture" });
  await remove.getByLabel("Removal note").fill("Approved access removal");
  page.once("dialog", (dialog) => dialog.accept());
  await remove.getByRole("button", { name: "Remove member" }).click();
  await expect(remove.locator("form")).toHaveAttribute("aria-busy", "true");
  await expect(remove.getByRole("status")).toHaveText("Removing member…");
  await expect(remove.getByRole("button")).toBeDisabled();
  await expect(remove.getByLabel("Removal note")).toBeDisabled();
  await expect.poll(() => actionCalls(page)).toEqual([{ kind: "remove", note: "Approved access removal" }]);

  // A submit event must also be ignored while pending, independently of the
  // disabled button and fieldset preventing normal duplicate clicks.
  await remove.locator("form").dispatchEvent("submit");
  expect((await actionCalls(page)).length).toBe(1);
  await resolveAction(page, "success", "Member removed.");
  await expect(remove.getByRole("status")).toHaveText("Member removed.");
  await expect(remove.locator("form")).toHaveAttribute("aria-busy", "false");
  await expect(remove.getByRole("button")).toBeDisabled();
  await expect(remove.getByLabel("Removal note")).toBeDisabled();
  await remove.locator("form").dispatchEvent("submit");
  expect((await actionCalls(page)).length).toBe(1);
  expect(requests).toEqual([]);
});

test("server error preserves entered values and permits a retry", async ({ page }) => {
  const requests = await mountFixture(page);
  const create = page.getByRole("region", { name: "Create fixture" });
  await create.getByLabel("Draft title").fill("Keep my draft after an error");
  await create.getByRole("button", { name: "Create draft" }).click();
  await expect.poll(async () => (await actionCalls(page)).length).toBe(1);
  await resolveAction(page, "error", "The server did not save this draft.");
  await expect(create.getByRole("alert")).toHaveText("The server did not save this draft.");
  await expect(create.getByLabel("Draft title")).toHaveValue("Keep my draft after an error");
  await expect(create.getByLabel("Draft title")).toBeEnabled();
  await expect(create.getByRole("button")).toBeEnabled();
  await expect(page.locator(".action-notification")).toHaveCount(0);

  await create.getByRole("button", { name: "Create draft" }).click();
  await expect.poll(async () => (await actionCalls(page)).length).toBe(2);
  expect((await actionCalls(page))[1].title).toBe("Keep my draft after an error");
  await resolveAction(page, "success", "Draft created.");
  await expect(create.getByRole("status")).toHaveText("Draft created.");
  expect(requests).toEqual([]);
});

test("confirmed removal remains announced after the removed row unmounts", async ({ page }) => {
  const requests = await mountFixture(page);
  const remove = page.getByRole("region", { name: "Remove fixture" });
  page.once("dialog", (dialog) => dialog.accept());
  await remove.getByRole("button", { name: "Remove member" }).click();
  await expect.poll(async () => (await actionCalls(page)).length).toBe(1);
  await resolveAction(page, "success", "Member removed from this client.");
  const notification = page.locator(".action-notification");
  await expect(notification.getByRole("status")).toHaveText("Member removed from this client.");

  await page.evaluate(() => window.actionFixture.removeForm());
  await expect(remove).toHaveCount(0);
  await expect(notification.getByRole("status")).toHaveText("Member removed from this client.");
  await notification.getByRole("button", { name: "Dismiss confirmation" }).click();
  await expect(notification).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("confirmed create resets fields and remains available for repeated creation", async ({ page }) => {
  const requests = await mountFixture(page);
  const create = page.getByRole("region", { name: "Create fixture" });
  await create.getByLabel("Draft title").fill("First draft");
  await create.getByRole("button", { name: "Create draft" }).click();
  await expect.poll(async () => (await actionCalls(page)).length).toBe(1);
  await resolveAction(page, "success", "First draft created.");
  await expect(create.getByRole("status")).toHaveText("First draft created.");
  await expect(create.getByLabel("Draft title")).toHaveValue("");
  await expect(create.getByRole("button")).toBeEnabled();

  await create.getByLabel("Draft title").fill("Second draft");
  await create.getByRole("button", { name: "Create draft" }).click();
  await expect(create.getByRole("status")).toHaveText("Saving draft…");
  await expect.poll(async () => (await actionCalls(page)).length).toBe(2);
  await resolveAction(page, "success", "Second draft created.");
  await expect(create.getByRole("status")).toHaveText("Second draft created.");
  await expect(create.getByLabel("Draft title")).toHaveValue("");
  await expect(create.getByRole("button")).toBeEnabled();
  expect(await actionCalls(page)).toEqual([
    { kind: "create", title: "First draft" },
    { kind: "create", title: "Second draft" },
  ]);
  expect(requests).toEqual([]);
});

test("unconfirmed server transport failure displays a cautious error and preserves the draft", async ({ page }) => {
  const requests = await mountFixture(page);
  const create = page.getByRole("region", { name: "Create fixture" });
  await create.getByLabel("Draft title").fill("Possibly submitted");
  await create.getByRole("button", { name: "Create draft" }).click();
  await expect.poll(async () => (await actionCalls(page)).length).toBe(1);
  await expect(create.getByRole("status")).toHaveText("Saving draft…");

  await page.evaluate(() => window.actionFixture.rejectNext("Network disconnected after submission"));
  await expect(create.getByRole("alert")).toContainText("Could not confirm the server response");
  await expect(create.getByRole("alert")).toContainText("Refresh");
  await expect(create.getByLabel("Draft title")).toHaveValue("Possibly submitted");
  await expect(create.getByRole("button", { name: "Create draft" })).toBeEnabled();
  await expect(page.locator(".action-notification")).toHaveCount(0);
  expect((await actionCalls(page)).length).toBe(1);
  expect(requests).toEqual([]);
});
