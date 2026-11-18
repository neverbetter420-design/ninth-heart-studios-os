import { test, expect } from "@playwright/test";
import { previewCSS, renderNocturne } from "../helpers/nocturne-render.mjs";

// This uses real Dashboard and LivingStudioHub component source with synthetic
// records only. It does not authenticate or populate any external account.
test("approved Command Center chapters use a real content boundary, fixed crossfade and no fake metrics", async ({ page }) => {
  const { html } = await renderNocturne("admin", "populated", "home");
  await page.route("**/*", route => route.abort());
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + html + '</body></html>');
    await page.addStyleTag({ content: previewCSS });
    const hero = page.locator('.nocturne-command-center [data-nhs-command-scene="welcome"]');
    const divider = page.locator("#nhs-command-chapter-ii");
    const chapterTwo = page.locator('.nocturne-command-center [data-nhs-command-scene="workroom"]');
    await expect(hero).toBeVisible();
    await expect(divider.getByRole("heading", { name: "The Working Atelier" })).toBeVisible();
    await expect(chapterTwo).toBeVisible();
    await expect(hero.getByText("Studio Pulse")).toBeVisible();
    await expect(chapterTwo.getByText("Next 3 actions")).toBeVisible();
    const geometry = await page.evaluate(() => {
      const hero = document.querySelector('[data-nhs-command-scene="welcome"]');
      const divider = document.getElementById("nhs-command-chapter-ii");
      const work = document.querySelector('[data-nhs-command-scene="workroom"]');
      const shell = document.querySelector(".main-shell");
      const after = getComputedStyle(shell, "::after");
      return {
        heroBottom: hero.getBoundingClientRect().bottom,
        dividerTop: divider.getBoundingClientRect().top,
        dividerBottom: divider.getBoundingClientRect().bottom,
        workTop: work.getBoundingClientRect().top,
        backgroundFixed: after.position,
        backgroundSize: after.backgroundSize,
        backgroundOpacity: after.opacity,
        chapterFallbackArtwork: getComputedStyle(shell, "::before").backgroundImage,
        heroBorderWidth: getComputedStyle(hero).borderTopWidth,
        heroBackground: getComputedStyle(hero).backgroundImage,
        docWidth: document.documentElement.scrollWidth
      };
    });
    expect(geometry.dividerTop).toBeGreaterThanOrEqual(geometry.heroBottom - 2);
    expect(geometry.workTop).toBeGreaterThanOrEqual(geometry.dividerBottom - 2);
    expect(geometry.backgroundFixed).toBe("fixed");
    expect(geometry.backgroundSize).toContain("contain");
    expect(geometry.backgroundOpacity).toBe("0");
    // The previous rejected AT2 Observatory photo is no longer rendered.
    // The known NHS fallback is temporary until the hash-locked art arrives.
    expect(geometry.chapterFallbackArtwork).toContain("data:image/webp");
    expect(geometry.heroBorderWidth).toBe("0px");
    expect(geometry.heroBackground).toBe("none");
    expect(geometry.docWidth).toBeLessThanOrEqual(width);

    // Preview is static SSR. Simulate the client hook's attribute assignment
    // to verify the final stylesheet visibly switches chapters.
    await page.locator(".app-shell").evaluate(el => { el.dataset.nhsCommandChapter = "2"; });
    await expect.poll(() => page.locator(".main-shell").evaluate(el => getComputedStyle(el, "::after").opacity)).toBe("1");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  const duration = await page.locator(".main-shell").evaluate(el => getComputedStyle(el, "::after").transitionDuration);
  expect(duration).toBe("0s");
});
