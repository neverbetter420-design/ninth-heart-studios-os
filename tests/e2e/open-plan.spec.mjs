import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { previewCSS, renderNocturne } from "../helpers/nocturne-render.mjs";

// Render real components and the complete ordered stylesheet; synthetic reads
// only. No server actions, hosted auth, remote assets or external requests.
async function show(page, role, view = "home", scenario = "populated", path = "") {
  await page.route("**/*", route => route.abort());
  const { html } = await renderNocturne(role, scenario, view, path);
  await page.setContent(`<!doctype html><html lang="en"><head><title>NHS OS local review</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>${previewCSS}</style></head><body>${html}</body></html>`);
}
const launcher = page => page.getByRole("button", { name: "Open navigation", exact: true });
const directory = page => page.getByRole("navigation", { name: "Primary navigation", exact: true });
async function bounds(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
}

test("all rooms use full-width workspaces with no permanent sidebar or dock", async ({ page }) => {
  mkdirSync("design-preview/open-plan", { recursive: true });
  for (const width of [1440, 1024, 768, 430, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [role, view] of [["admin","home"],["admin","leads"],["admin","clients"],["admin","project"],["admin","contracts"],["admin","muse"],["client","home"],["client","project"],["client","portal-projects"],["client","portal-documents"],["client","portal-messages"],["client","portal-files"],["client","portal-approvals"],["client","portal-contracts"],["client","portal-forms"]]) {
      await show(page, role, view);
      await expect(page.locator(".nhs-sidebar,.navigation-shell,.nhs-mobile-quicknav")).toHaveCount(0);
      await expect(directory(page)).toBeHidden();
      await expect(page.getByRole("button", { name: "Sign out", exact: false })).toBeVisible();
      expect((await page.locator(".main-shell").boundingBox()).width).toBe(width);
      await bounds(page);
      if ([1440,390].includes(width) && ["home","project","portal-documents"].includes(view)) {
        await page.screenshot({ path: `design-preview/open-plan/${role}-${view}-${width}.png`, fullPage: true });
      }
      if (role === "client") {
        const lightSurfaces = await page.locator(".main-shell,.atelier-hero,.atelier-feature-project,.nhs-atelier-compass,.atelier-destinations,.studio-workspace-client,.panel,.atelier-project-row,.atelier-resource-row").evaluateAll(elements => elements.filter(el => {
          const rgb = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [];
          return (rgb[3] ?? 1) > .5 && Math.min(...rgb.slice(0,3)) > 150;
        }).map(el => el.className));
        expect(lightSurfaces, `${view} at ${width}px must have no cream surfaces`).toEqual([]);
      }
    }
  }
});

test("room directory works with keyboard, Escape, light dismissal and role-specific destinations", async ({ page }) => {
  for (const width of [1440,768,390,320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const role of ["admin","client"]) {
      await show(page, role);
      await launcher(page).focus();
      await page.keyboard.press("Enter");
      await expect(directory(page)).toBeVisible();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Close navigation", exact: true })).toBeFocused();
      const hrefs = await directory(page).locator("a[href^='/']").evaluateAll(elements => elements.map(el => el.getAttribute("href")));
      expect(hrefs.length).toBe(role === "admin" ? 12 : 6);
      expect(hrefs.every(href => role === "client" ? href.startsWith("/portal") : !href.startsWith("/portal"))).toBe(true);
      await expect(directory(page).locator('[aria-current="page"]')).toHaveCount(1);
      await bounds(page);
      if (width === 1440 || width === 390) await page.screenshot({ path: `design-preview/open-plan/${role}-directory-${width}.png`, fullPage: true });
      await page.keyboard.press("Escape");
      await expect(directory(page)).toBeHidden();
      await expect(launcher(page)).toBeFocused();
      await launcher(page).click();
      await page.getByRole("button", { name: "Close navigation", exact: true }).click();
      await expect(directory(page)).toBeHidden();
      await launcher(page).click();
      await page.mouse.click(2,2);
      await expect(directory(page)).toBeHidden();
    }
  }
  for (const role of ["admin","client"]) {
    const cases = role === "admin" ? [["/leads/discover","/leads/discover"],["/projects/synthetic-a","/projects"]] : [["/portal/contracts","/portal/documents"],["/portal/forms","/portal/documents"],["/portal/projects/synthetic-a","/portal/projects"]];
    for (const [path, active] of cases) {
      await show(page, role, "navigation", "normal", path);
      await launcher(page).click();
      await expect(directory(page).locator('[aria-current="page"]')).toHaveAttribute("href", active);
    }
  }
});

test("client empty, error and long-content states stay dark and fit on mobile", async ({ page }) => {
  for (const width of [1440,320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const scenario of ["empty","error","long"]) {
      await show(page, "client", "home", scenario);
      await bounds(page);
      if (scenario === "empty") await expect(page.getByText("Your story begins here.")).toBeVisible();
      if (scenario === "error") await expect(page.getByRole("alert")).toContainText("Projects are temporarily unavailable");
      await page.screenshot({ path: `design-preview/open-plan/client-${scenario}-${width}.png`, fullPage: true });
    }
  }
});

for (const width of [1440,390]) {
  test(`WCAG A/AA accessibility on client pages and both role directories at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const view of ["home","portal-projects","portal-documents","portal-messages","portal-files","portal-approvals","portal-contracts","portal-forms","project"]) {
      await show(page, "client", view);
      if (view === "project") await page.locator("main details").evaluateAll(items => items.forEach(item => item.open = true));
      const result = await new AxeBuilder({ page }).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
      expect(result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), `${view} ${width}px`).toEqual([]);
    }
    for (const role of ["admin","client"]) {
      await show(page, role);
      await launcher(page).click();
      const result = await new AxeBuilder({ page }).include("#nhs-room-directory").withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
      expect(result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), `${role} directory ${width}px`).toEqual([]);
    }
  });
}
test("reduced-motion and forced-color navigation remain usable", async ({ page }) => {
  await show(page,"client");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.locator(".atelier-hero-copy").evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  await page.emulateMedia({ forcedColors: "active" });
  await launcher(page).focus();
  await page.keyboard.press("Enter");
  await expect(directory(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(launcher(page)).toBeFocused();
  expect(await launcher(page).evaluate(el => getComputedStyle(el).outlineStyle)).toBe("solid");
});

// The enhanced studio stays data-driven: no fabricated percentages, badges or
// decorative-only routes. Its illustrated symbols do not replace accessible links.
test("Color Studio keeps original identity, actual project progress, and four functional icon routes", async ({ page }) => {
  for (const width of [1440,390,320]) {
    await page.setViewportSize({ width, height: 1000 });
    await show(page, "client", "home", "populated");
    await expect(page.locator(".nhs-color-hero-core img")).toHaveAttribute("src", /data:image\/webp;base64,/);
    await expect(page.locator(".nhs-portal-progress-dial")).toContainText("72%");
    await expect(page.getByRole("progressbar", { name:"Project progress" })).toHaveAttribute("aria-valuenow","72");
    const dest = page.locator(".atelier-destination-grid .atelier-destination");
    await expect(dest).toHaveCount(4);
    for (const href of ["/portal/messages", "/portal/files", "/portal/documents", "/portal/approvals"]) {
      await expect(page.locator(`.atelier-destination-grid a.atelier-destination[href="${href}"]`)).toHaveCount(1);
    }
    await expect(dest.locator("svg")).toHaveCount(4);
    await expect(page.locator(".nhs-room-directory")).toBeHidden();
    await bounds(page);
  }
  await show(page, "client", "home", "error");
  await expect(page.getByRole("alert")).toContainText("Projects are temporarily unavailable");
  await expect(page.locator(".nhs-portal-progress-dial")).toHaveCount(0);
});

test("distinct decorative rose, skull and skeleton key are visible without covering client actions", async ({ page }) => {
  for (const width of [1440,390,320]) {
    await page.setViewportSize({ width, height: 1000 });
    await show(page,"client","home","populated");
    for (const name of ["rose","skull","key"]) {
      const relic = page.locator(`.nhs-hero-relic[data-relic="${name}"] .nhs-relic-art--${name}`);
      await expect(relic).toBeVisible();
      expect((await relic.boundingBox()).width).toBeGreaterThan(50);
    }
    await expect(page.locator(".nhs-dial-relic--rose .nhs-relic-art--rose")).toBeVisible();
    await expect(page.locator(".nhs-dial-relic--key .nhs-relic-art--key")).toBeVisible();
    await expect(page.locator(".nhs-compass-relic-skull .nhs-relic-art--skull")).toBeVisible();
    await expect(page.getByRole("link",{name:/Open workspace/})).toBeVisible();
    await bounds(page);
  }
  await show(page,"client","portal-messages","populated");
  for (const name of ["rose","skull","key"]) {
    await expect(page.locator(`.nhs-client-room-relic--${name} .nhs-relic-art--${name}`)).toBeVisible();
  }
  await show(page,"client","home","empty");
  await expect(page.locator(".nhs-relic-empty-art .nhs-relic-art--rose")).toBeVisible();
  await expect(page.locator(".nhs-relic-empty-art .nhs-relic-art--key")).toBeVisible();
});


test("seven NHS rooms display distinct local background scenes without replacing the Command Center", async ({ page }) => {
  const cases = [
    ["admin", "home", "observatory"],
    ["admin", "leads", "electric"],
    ["admin", "clients", "rose"],
    ["admin", "pipeline", "artist"],
    ["admin", "contracts", "archive"],
    ["admin", "muse", "velvet"],
    ["client", "home", "private"],
  ];
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});
    const backgrounds = new Set();
    for (const [role,view,room] of cases) {
      await show(page,role,view,"populated");
      const image = await page.locator(".main-shell").evaluate((el,isObservatory) => isObservatory ? getComputedStyle(el).backgroundImage : getComputedStyle(el,"::before").backgroundImage,room === "observatory");
      expect(image, room + " must have a local image background").toMatch(/data:image\/(?:svg\+xml|webp)/);
      backgrounds.add(image);
      await expect(page.locator(".nhs-sidebar,.navigation-shell,.nhs-mobile-quicknav")).toHaveCount(0);
      await bounds(page);
      await page.screenshot({path:`design-preview/open-plan/wallpaper-${room}-${width}.png`});
    }
    expect(backgrounds.size, "every one of the seven rooms must have different artwork").toBe(7);
  }
});


test("room entrances layer local photographic texture beneath their distinct scene",async ({page})=>{
  const cases=[
    ["admin","clients",".management-page.management-clients > .page-header.management-heading"],
    ["admin","contracts",".paperwork-page > .management-heading"],
    ["client","home",".nhs-color-studio .nhs-color-hero"],
  ];
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});
    for(const [role,view,selector] of cases){
      await show(page,role,view,"populated");
      const background=await page.locator(selector).first().evaluate(el=>getComputedStyle(el).backgroundImage);
      expect(background).toContain("linear-gradient");
      expect(background).not.toContain("data:image/webp");
      const fixed = await page.locator(".main-shell").evaluate(el=>getComputedStyle(el,"::before").backgroundImage);
      expect(fixed).toContain("data:image/webp");
      expect(fixed).not.toContain("data:image/svg+xml");
      await bounds(page);
    }
  }
});

test("eye-comfort room lighting dims photography but not working controls", async ({page}) => {
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});
    for (const [role,view] of [["admin","leads"],["client","home"]]) {
      await show(page,role,view,"populated");
      const ambient = await page.locator(".main-shell").evaluate(el => ({
        background:getComputedStyle(el,"::before").backgroundImage,
        filter:getComputedStyle(el).filter,
      }));
      expect(ambient.background).toContain("linear-gradient");
      expect(ambient.background).toContain("data:image/");
      expect(ambient.filter).toBe("none");
      await bounds(page);
    }
    await show(page,"admin","home","populated");
    const hero=await page.locator(".nocturne-overview").first().evaluate(el=>getComputedStyle(el).backgroundImage);
    expect(hero).toContain("linear-gradient");
    await bounds(page);
  }
});

test("legacy ivory project, relationship and archive surfaces are replaced by Command Center ink",async ({page})=>{
  const samples=[
    ["admin","clients",".management-clients .management-directory"],
    ["admin","pipeline",".management-pipeline"],
    ["admin","project",".studio-workspace-admin"],
    ["admin","contracts",".paperwork-page"],
    ["admin","client-detail",".management-client-grid"],
  ];
  for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:1000});
    for(const [role,room,selector] of samples){
      await show(page,role,room,"populated");
      const surface=page.locator(selector).first();
      await expect(surface).toBeVisible();
      const bg=await surface.evaluate(el=>getComputedStyle(el).backgroundColor);
      const vals=bg.match(/[\d.]+/g).map(Number);
      const transparent=vals.length===4&&vals[3]===0;
      expect(transparent||(vals[0]<55&&vals[1]<55&&vals[2]<65),
        selector+" should not use a bright canvas").toBe(true);
      await bounds(page);
    }
  }
});


test("real studio metrics have quiet icon instruments, without fake actions or mobile overflow", async ({page}) => {
  const cases=[["leads",4],["clients",3],["pipeline",3],["contracts",3]];
  for(const width of [1440,390,320]) {
    await page.setViewportSize({width,height:1000});
    for(const [room,count] of cases) {
      await show(page,"admin",room,"populated");
      const metrics=page.locator(".metric-grid .metric-card");
      await expect(metrics).toHaveCount(count);
      await expect(metrics.locator(".metric-symbol[aria-hidden='true'] svg")).toHaveCount(count);
      await expect(metrics.locator(".metric-symbol :is(a,button)")).toHaveCount(0);
      for(const metric of await metrics.all()) {
        await expect(metric.locator("p")).not.toBeEmpty();
        await expect(metric.locator("strong")).not.toBeEmpty();
      }
      await bounds(page);
    }
  }
});

test("cinematic room photos remain locked to the viewport while content scrolls",async ({page})=>{
  const cases=[
    ["admin","leads","electric"],["admin","clients","rose"],["admin","pipeline","artist"],
    ["admin","contracts","archive"],["admin","muse","velvet"],["client","home","private"]
  ];
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:520});
    for(const [role,view,room] of cases) {
      await show(page,role,view,"populated");
      const scene=page.locator(".main-shell");
      const before=await scene.evaluate(el=>{
        const layer=getComputedStyle(el,"::before");
        return {position:layer.position,backgroundImage:layer.backgroundImage,
          positionImage:layer.backgroundPosition,animation:layer.animationName,
          transform:layer.transform,pointerEvents:layer.pointerEvents,
          viewportHeight:layer.height};
      });
      expect(before.position,room+" photo should be fixed").toBe("fixed");
      expect(before.backgroundImage,room+" photo should render").toContain("data:image/webp;base64");
      expect(before.animation).toBe("none");
      expect(before.transform).toBe("none");
      expect(before.pointerEvents).toBe("none");
      await page.evaluate(()=>{
        document.documentElement.style.minHeight="2300px";
        window.scrollTo(0,400);
      });
      await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(0);
      const after=await scene.evaluate(el=>{
        const layer=getComputedStyle(el,"::before");
        return {position:layer.position,backgroundImage:layer.backgroundImage,
          positionImage:layer.backgroundPosition,animation:layer.animationName,
          transform:layer.transform,pointerEvents:layer.pointerEvents,
          viewportHeight:layer.height};
      });
      expect(after,room+" wallpaper must stay fixed after page scroll").toEqual(before);
      await page.evaluate(()=>{
        window.scrollTo(0,0);
        document.documentElement.style.minHeight="";
      });
      await bounds(page);
    }
  }
});


test("approved NHS editorial continuity applies to actual deep pages, not only the seven backgrounds", async ({ page }) => {
  // Synthetic-only source rendering. This fails when old opaque tiled layouts
  // silently return to Client, Leads, Archive, or the Client Portal.
  const rows = [
    ["admin", "clients", ".management-client-row", "rose"],
    ["admin", "leads", ".lead-inbox-row", "electric"],
    ["admin", "contracts", ".paperwork-row", "archive"],
    ["client", "portal-projects", ".atelier-project-row", "private"],
    ["client", "portal-files", ".atelier-resource-row", "private"],
  ];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 920 });
    for (const [role, view, selector, room] of rows) {
      await show(page, role, view, "populated");
      await expect(page.locator(`.nhs-room-identity[data-room="\${room}"]`)).toHaveCount(1);
      const entries = page.locator(selector);
      await expect(entries.first()).toBeVisible();
      const surface = await entries.first().evaluate((element) => {
        const style = getComputedStyle(element);
        return { background:style.backgroundColor, image:style.backgroundImage,
          radius:style.borderTopLeftRadius, shadow:style.boxShadow };
      });
      expect(surface.radius, `\${view} must read as an open row`).toBe("0px");
      expect(surface.image, `\${view} must not use a decorative card background`).toBe("none");
      expect(surface.shadow, `\${view} must not show a tiled shadow`).toBe("none");
      await bounds(page);
    }
    await show(page,"admin","project","populated");
    const root = page.locator(".studio-workspace-admin");
    await expect(root).toBeVisible();
    const workspace = await root.evaluate(el => {
      const css=getComputedStyle(el);
      return {image:css.backgroundImage, color:css.backgroundColor, shadow:css.boxShadow};
    });
    expect(workspace.image).toBe("none");
    expect(workspace.shadow).toBe("none");
    await bounds(page);
  }
});
