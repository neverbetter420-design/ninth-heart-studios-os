/** Shared helpers for project file uploads (Phase 4 delivery). */

export const PROJECT_FILES_BUCKET = "project-files";

/** Server-side guard; the bucket enforces its own mime allowlist on top of this. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export type FileVisibility = "client" | "internal";

/**
 * Strip path components and hostile characters so a user-supplied filename
 * is safe to embed in a storage object path.
 */
export function sanitizeFilename(name: string): string {
  const base = name.split("/").pop()?.split("\\").pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "").slice(0, 120);
  return cleaned || "file";
}

/** Object path convention enforced by the storage RLS policies. */
export function projectObjectPath(
  clientId: string,
  projectId: string,
  visibility: FileVisibility,
  filename: string,
): string {
  return `${clientId}/${projectId}/${visibility}/${Date.now()}_${sanitizeFilename(filename)}`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
