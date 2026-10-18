import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Project = { id: string; name: string };
type DocumentRow = {
  id: string;
  title: string;
  kind: string | null;
  project_id: string;
  created_at: string;
};

export default async function ClientDocumentsPage() {
  const { profile } = await requireUser();
  if (profile.role !== "client") redirect("/");

  const supabase = await createClient();
  // Projects and documents use the caller's session and existing Supabase RLS.
  // Never use a service-role key or fetch a document from an arbitrary ID.
  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select("id, name")
    .order("updated_at", { ascending: false });

  const projects = (projectData ?? []) as Project[];
  const projectNames = new Map(projects.map((p) => [p.id, p.name]));
  const { data: rawDocuments, error: documentError } = projectError || projects.length === 0
    ? { data: [] as DocumentRow[], error: null }
    : await supabase
        .from("documents")
        .select("id, title, kind, project_id, created_at")
        .in("project_id", projects.map((p) => p.id))
        .order("created_at", { ascending: false })
        .limit(100);
  const documents = (rawDocuments ?? []) as DocumentRow[];

  return (
    <div className="content-wrap atelier-documents-page">
      <Link href="/portal" className="atelier-text-link">← Your Atelier</Link>

      <header className="atelier-documents-heading">
        <p className="atelier-overline">Client Atelier · Paperwork, simplified</p>
        <h2>Everything in writing.</h2>
        <p>Your shared documents, agreements, and forms. Organized by purpose, not buried inside project pages.</p>
      </header>

      <nav className="atelier-document-directory" aria-label="Document categories">
        <a href="#shared-documents" className="atelier-document-destination">
          <span className="atelier-doc-icon" aria-hidden="true">▤</span>
          <strong>Shared documents</strong>
          <small>Files and project notes</small>
          <span className="atelier-doc-arrow" aria-hidden="true">↗</span>
        </a>
        <Link href="/portal/contracts" className="atelier-document-destination">
          <span className="atelier-doc-icon" aria-hidden="true">✒</span>
          <strong>Contracts</strong>
          <small>Review and sign agreements</small>
          <span className="atelier-doc-arrow" aria-hidden="true">↗</span>
        </Link>
        <Link href="/portal/forms" className="atelier-document-destination">
          <span className="atelier-doc-icon" aria-hidden="true">◇</span>
          <strong>Forms</strong>
          <small>Complete your paperwork</small>
          <span className="atelier-doc-arrow" aria-hidden="true">↗</span>
        </Link>
      </nav>

      <section id="shared-documents" className="atelier-shared-documents" aria-labelledby="shared-document-heading">
        <div className="atelier-section-heading">
          <div>
            <p className="atelier-overline">Your shared collection</p>
            <h3 id="shared-document-heading">Project documents</h3>
          </div>
          <Link href="/portal/files">Visit project files <span aria-hidden="true">→</span></Link>
        </div>

        {projectError || documentError ? (
          <div className="atelier-notice" role="alert">
            <h3>Documents aren't available right now.</h3>
            <p>Please refresh the page or contact the studio if the problem continues.</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="atelier-empty">
            <span aria-hidden="true">◇</span>
            <h3>No documents shared yet.</h3>
            <p>Documents will appear here once the studio shares them with your project.</p>
            <Link className="atelier-text-link" href="/portal/projects">Explore your projects →</Link>
          </div>
        ) : (
          <ul className="atelier-document-list">
            {documents.map((document) => (
              <li key={document.id} className="atelier-document-row">
                <span className="atelier-document-file-icon" aria-hidden="true">▤</span>
                <div className="atelier-document-row-main">
                  <strong>{document.title}</strong>
                  <small>{projectNames.get(document.project_id) ?? "Your project"} · {(document.kind ?? "Document").replaceAll("_", " ")}</small>
                </div>
                <Link
                  href={`/portal/projects/${document.project_id}?section=documents#documents`}
                  className="atelier-document-open"
                >
                  View in project <span aria-hidden="true">↗</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
