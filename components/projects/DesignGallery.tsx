"use client";

import { useRef, useState } from "react";
import { ProjectSectionLink } from "./ProjectSectionLink";

type PreviewFile = { id: string; filename: string; mime_type: string | null; downloadUrl: string | null };
const previewTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

/** Only approved project-file signed URLs supplied by the scoped server query can be previewed. */
export function DesignGallery({ files, filesHref }: { files: PreviewFile[]; filesHref: string }) {
  const previews = files.filter((file) => file.downloadUrl && previewTypes.has(file.mime_type ?? "")).slice(0, 6);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState(0);
  const [compare, setCompare] = useState(false);
  if (!previews.length) return null;

  const selected = previews[active] ?? previews[0];
  const other = previews.find((_, index) => index !== active);

  function openPreview(index: number) {
    setActive(index);
    setCompare(false);
    dialogRef.current?.showModal();
  }

  return (
    <section className="studio-gallery" aria-label="Design previews">
      <div className="studio-gallery-heading">
        <div><p className="studio-overline">The work, in view</p><h3>Your private design gallery</h3></div>
        <ProjectSectionLink href={filesHref}>All project files <span aria-hidden="true">↗</span></ProjectSectionLink>
      </div>
      <p className="nhs-gallery-intro">Open a design to see it larger. The files visible here are shared with this project.</p>
      <div className="studio-gallery-images">
        {previews.map((file, index) => (
          <button key={file.id} type="button" onClick={() => openPreview(index)} className="studio-gallery-preview nhs-gallery-trigger" aria-label={"Preview " + file.filename}>
            <figure>
              <img src={file.downloadUrl!} alt="" loading="lazy" referrerPolicy="no-referrer" />
              <figcaption>{file.filename}<span aria-hidden="true">View ↗</span></figcaption>
            </figure>
          </button>
        ))}
      </div>
      <dialog ref={dialogRef} className="nhs-gallery-dialog" aria-label="Design preview" onClose={() => setCompare(false)}>
        <div className="nhs-gallery-dialog-head">
          <div><p className="studio-overline">Your design, in detail</p><h3>{selected.filename}</h3></div>
          <button type="button" className="nhs-gallery-close" onClick={() => dialogRef.current?.close()} aria-label="Close design preview">✕ Close</button>
        </div>
        <div className={compare && other ? "nhs-gallery-canvas is-comparing" : "nhs-gallery-canvas"}>
          <figure><img src={selected.downloadUrl!} alt={"Full preview of " + selected.filename} referrerPolicy="no-referrer" /><figcaption>{selected.filename}</figcaption></figure>
          {compare && other ? <figure><img src={other.downloadUrl!} alt={"Comparison preview of " + other.filename} referrerPolicy="no-referrer" /><figcaption>{other.filename}</figcaption></figure> : null}
        </div>
        <div className="nhs-gallery-dialog-actions">
          {previews.length > 1 && <button type="button" onClick={() => setActive((active + previews.length - 1) % previews.length)}>← Previous</button>}
          {previews.length > 1 && <button type="button" onClick={() => setCompare(!compare)} aria-pressed={compare}>{compare ? "Single view" : "Compare two previews"}</button>}
          {previews.length > 1 && <button type="button" onClick={() => setActive((active + 1) % previews.length)}>Next →</button>}
          <a href={selected.downloadUrl!} target="_blank" rel="noopener noreferrer">Open original ↗</a>
        </div>
      </dialog>
    </section>
  );
}
