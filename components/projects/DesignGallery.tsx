import { ProjectSectionLink } from "./ProjectSectionLink";

type PreviewFile = { id: string; filename: string; mime_type: string | null; downloadUrl: string | null };
const previewTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

/** Only render images already readable through the caller's scoped file query. */
export function DesignGallery({ files, filesHref }: { files: PreviewFile[]; filesHref: string }) {
  const previews = files.filter((file) => file.downloadUrl && previewTypes.has(file.mime_type ?? "")).slice(0, 3);
  if (!previews.length) return null;
  return (
    <section className="studio-gallery" aria-label="Design previews">
      <div className="studio-gallery-heading">
        <div><p className="studio-overline">The work, in view</p><h3>Design previews</h3></div>
        <ProjectSectionLink href={filesHref}>All project files <span aria-hidden="true">↗</span></ProjectSectionLink>
      </div>
      <div className="studio-gallery-images">
        {previews.map((file) => (
          <a key={file.id} href={file.downloadUrl!} target="_blank" rel="noopener noreferrer" className="studio-gallery-preview">
            <figure>
              <img src={file.downloadUrl!} alt={`Preview of ${file.filename}`} loading="lazy" referrerPolicy="no-referrer" />
              <figcaption>{file.filename}<span aria-hidden="true">↗</span></figcaption>
            </figure>
          </a>
        ))}
      </div>
    </section>
  );
}
