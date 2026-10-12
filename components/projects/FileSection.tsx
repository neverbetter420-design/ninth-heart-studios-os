import {
  deleteProjectFile,
  uploadProjectFile,
} from "@/app/(protected)/(admin)/projects/actions";
import { formatBytes } from "@/lib/files";

export type WorkspaceFile = {
  id: string;
  filename: string;
  visibility: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  downloadUrl: string | null;
};

export function FileSection({
  projectId,
  files,
}: {
  projectId: string;
  files: WorkspaceFile[];
}) {
  return (
    <section className="panel" aria-label="Project files">
      <div className="panel-heading">
        <h3>Files</h3>
        <span className="pipeline-count">{files.length}</span>
      </div>

      <form action={uploadProjectFile} className="mini-form file-upload-form">
        <input type="hidden" name="project_id" value={projectId} />
        <input type="file" name="file" required aria-label="Choose a file to upload" />
        <select name="visibility" defaultValue="client" aria-label="File visibility">
          <option value="client">Client-visible</option>
          <option value="internal">Internal only</option>
        </select>
        <button type="submit" className="mini-button go">
          Upload
        </button>
      </form>

      <ul className="delivery-list">
        {files.length === 0 ? (
          <li className="delivery-row">
            <p className="pipeline-empty">
              No files yet. Contracts, mockups, midnight inspirations — they live here.
            </p>
          </li>
        ) : (
          files.map((f) => (
            <li key={f.id} className="delivery-row">
              <div className="delivery-row-main">
                <p className="delivery-row-title">{f.filename}</p>
                <p className="delivery-row-sub">
                  {formatBytes(f.size_bytes)}
                  {f.size_bytes != null ? " · " : ""}
                  {new Date(f.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <span className="delivery-pill progress">
                {f.visibility === "internal" ? "Internal" : "Client"}
              </span>
              <div className="delivery-actions">
                {f.downloadUrl ? (
                  <a className="mini-button" href={f.downloadUrl} download={f.filename}>
                    Download
                  </a>
                ) : null}
                <form action={deleteProjectFile} className="mini-form">
                  <input type="hidden" name="file_id" value={f.id} />
                  <button type="submit" className="mini-button danger">
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
