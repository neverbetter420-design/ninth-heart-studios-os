// Screenshot-only owner review of actual NHS OS components with synthetic reads.
// No live account credentials, Supabase calls, network loads, writes or deployment.
// This is NOT authenticated acceptance of a running production website.
import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { previewCSS, renderNocturne } from "../helpers/nocturne-render.mjs";

test("NHS AT2 owner gallery: seven rooms, desktop and phone, no cropped borders", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One suite captures both dimensions");
  test.setTimeout(240000);
  const folder = "design-preview/nhs-at2-owner-gallery";
  mkdirSync(folder, { recursive: true });
  await page.route("**/*", route => route.abort());
  const rooms = [
    { role:"admin", view:"home", id:"observatory", label:"Admin Observatory" },
    { role:"admin", view:"leads", id:"electric", label:"Lead Intelligence" },
    { role:"admin", view:"clients", id:"rose", label:"Client Management" },
    { role:"admin", view:"pipeline", id:"artist", label:"Project Pipeline" },
    { role:"admin", view:"contracts", id:"archive", label:"Document Archive" },
    { role:"admin", view:"muse", id:"velvet", label:"Muse Studio" },
    { role:"client", view:"home", id:"private", label:"Client Sanctuary" },
  ];
  const sizes = [
    { name:"desktop", width:1440, height:900 },
    { name:"mobile", width:390, height:844 },
  ];
  const reviewed = [];
  for (const size of sizes) {
    await page.setViewportSize({ width:size.width, height:size.height });
    for (const room of rooms) {
      const { html } = await renderNocturne(room.role, "populated", room.view);
      await page.setContent('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + html + '</body></html>');
      await page.addStyleTag({ content:previewCSS });
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator(".nhs-room-identity")).toHaveAttribute("data-room", room.id);
      const before = await page.locator(".main-shell").evaluate(el => {
        const css = getComputedStyle(el, "::before");
        return {position:css.position, size:css.backgroundSize, repeat:css.backgroundRepeat, pointerEvents:css.pointerEvents};
      });
      expect(before.position, room.id + " photo must stay fixed").toBe("fixed");
      expect(before.pointerEvents, room.id + " artwork must not block controls").toBe("none");
      expect(before.size, room.id + " must show complete image").toContain("contain");
      expect(before.repeat, room.id + " must not tile artwork").not.toContain("repeat-y");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
      const filename = size.name + "-" + room.id + ".jpg";
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path:folder + "/" + filename, type:"jpeg", quality:82, fullPage:false, animations:"disabled" });
      reviewed.push({label:room.label, screen:size.name, filename});
    }
  }
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const cards = reviewed.map(({label,screen,filename}) =>
    '<figure><a href="' + esc(filename) + '"><img loading="lazy" src="' + esc(filename) + '" alt="' + esc(label + " · " + screen) + '"></a><figcaption>' + esc(label) + ' · ' + esc(screen) + '</figcaption></figure>'
  ).join("\n");
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>NHS OS · Seven-room art review</title><style>body{background:#070912;color:#f3ecff;font:15px/1.5 system-ui,sans-serif;margin:0;padding:clamp(16px,3vw,48px)}h1{font:400 clamp(25px,4vw,42px) Georgia,serif}p{max-width:74ch;color:#c8c1dc}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:20px}figure{margin:0;background:#141424;border:1px solid #51516d;border-radius:16px;overflow:hidden}img{display:block;width:100%;height:auto}figcaption{padding:12px 15px}a{color:inherit}</style></head><body><h1>NHS OS · The Ninth Atelier</h1>' +
    '<p>Fourteen screenshots of the real app components with synthetic records. Desktop 1440×900 and phone 390×844. Fixed, centered, full-frame artwork and transparent glass. This is an offline, unauthenticated source review, NOT the deployed app. Custom local-only fonts may fall back in CI. No production data.</p><main>' + cards + '</main></body></html>';
  writeFileSync(folder + "/index.html", html);
  writeFileSync(folder + "/README.md", "# NHS OS · Seven-room visual review\n\nOpen index.html to compare 14 source-rendered desktop/mobile screenshots. Images use synthetic data, real app components and verified imported NHS AT2 artwork, without client credentials or external network. Local-only licensed fonts are not bundled into CI. Do not infer production visual or auth acceptance from these screenshots.\n");
});
