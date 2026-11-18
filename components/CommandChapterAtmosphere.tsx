"use client";

import { useEffect } from "react";

/**
 * Purely decorative section-linked atmosphere for Admin Observatory.
 * The section boundary, not a percentage of arbitrary document height,
 * controls the chapter change. No auth, data, navigation or writes.
 */
export function CommandChapterAtmosphere() {
  useEffect(() => {
    const divider = document.getElementById("nhs-command-chapter-ii");
    const shell = divider?.closest<HTMLElement>(".app-shell");
    if (!divider || !shell) return;

    let scheduled = false;
    let frame = 0;
    const update = () => {
      const boundary = divider.getBoundingClientRect().top;
      shell.dataset.nhsCommandChapter = boundary <= window.innerHeight * 0.46 ? "2" : "1";
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      frame = window.requestAnimationFrame(() => {
        scheduled = false;
        update();
      });
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.cancelAnimationFrame(frame);
      delete shell.dataset.nhsCommandChapter;
    };
  }, []);

  return null;
}
