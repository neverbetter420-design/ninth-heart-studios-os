import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const resources = {
  messages: {
    title: "Messages",
    description: "All the conversations about your projects, in one place.",
    table: "messages",
    columns: "id, project_id, body, created_at",
    sort: "created_at",
    anchor: "messages",
    empty: "No messages yet. Open a project to start the conversation.",
  },
  files: {
    title: "Files",
    description: "Find your project files and upload new ones inside the relevant project.",
    table: "files",
    columns: "id, project_id, filename, created_at",
    sort: "created_at",
    anchor: "files",
    empty: "No shared files yet.",
  },
  approvals: {
    title: "Approvals",
    description: "See what needs your decision and review previous sign-offs.",
    table: "approvals",
    columns: "id, project_id, title, status, requested_at",
    sort: "requested_at",
    anchor: "pending-approvals",
    empty: "Nothing is waiting for your approval.",
  },
  contracts: {
    title: "Contracts",
    description: "Review and sign agreements shared with your projects.",
    table: "contracts",
    columns: "id, project_id, title, status, created_at",
    sort: "created_at",
    anchor: "contracts",
    empty: "No contracts have been shared yet.",
  },
  forms: {
    title: "Forms",
    description: "Complete your project forms and check what you already submitted.",
    table: "form_submissions",
    columns: "id, project_id, status, created_at",
    sort: "created_at",
    anchor: "forms",
    empty: "No forms assigned yet.",
  },
} as const;

export type PortalResourceKind = keyof typeof resources;

type ResourceRow = {
  id: string;
  project_id: string;
  title?: string | null;
  body?: string | null;
  filename?: string | null;
  status?: string | null;
  created_at?: string | null;
  requested_at?: string | null;
};

function itemTitle(kind: PortalResourceKind, item: ResourceRow): string {
  if (kind === "messages") return "Project message";
  if (kind === "files") return item.filename ?? "Shared file";
  if (kind === "forms") return "Project form";
  return item.title ?? "Project item";
}

function detail(kind: PortalResourceKind, item: ResourceRow): string {
  if (kind === "messages") return item.body ?? "";
  if (kind === "files") return "Open the project to download or upload files.";
  if (kind === "forms") return "Open the project to review or complete the form.";
  return "Status: " + (item.status ?? "unknown").replaceAll("_", " ");
}

export async function PortalResourcePage({ kind }: { kind: PortalResourceKind }) {
  const { profile } = await requireUser();
  if (profile.role !== "client") redirect("/");
  const supabase = await createClient();
  const config = resources[kind];

  // Each query runs as the current user; project membership and the resource
  // tables' RLS policies restrict results to this client's own workspace.
  const { data: visibleProjects, error: projectError } = await supabase
    .from("projects")
    .select("id, name")
    .order("updated_at", { ascending: false });
  const projects = (visibleProjects ?? []) as { id: string; name: string }[];
  const names = new Map(projects.map((project) => [project.id, project.name]));
  const ids = projects.map((project) => project.id);
  const { data: visibleResources, error } = ids.length
    ? await supabase
        .from(config.table)
        .select(config.columns as string)
        .in("project_id", ids)
        .order(config.sort, { ascending: false })
        .limit(100)
    : { data: [], error: null };
  const entries = (visibleResources ?? []) as ResourceRow[];

  return (
    <div className="content-wrap">
      <div className="lead-detail-backline" style={{ marginBottom: 12 }}>
        <Link href="/portal" className="text-button">← Client overview</Link>
      </div>
      <header className="page-header">
        <div>
          <p className="eyebrow electric">Client workspace</p>
          <h2>{config.title}</h2>
          <p className="page-description">{config.description}</p>
        </div>
      </header>
      {projectError || error ? (
        <section className="panel empty-state" role="alert">
          <h3>We couldn't load this section.</h3>
          <p>{projectError?.message ?? error?.message}</p>
        </section>
      ) : entries.length === 0 ? (
        <section className="panel empty-state">
          <h3>{config.empty}</h3>
          <p>Your workspace is connected. New items will appear here when they're shared.</p>
          <Link className="secondary-button inline-button" href="/portal/projects">View my projects</Link>
        </section>
      ) : (
        <section className="portal-resource-list" aria-label={config.title}>
          {entries.map((item) => (
            <article className="panel portal-resource-item" key={item.id}>
              <h3>{itemTitle(kind, item)}</h3>
              <p>{detail(kind, item)}</p>
              <div className="portal-resource-meta">
                <span>{names.get(item.project_id) ?? "Your project"} · {item.status ?? "Shared"}</span>
                <Link href={"/portal/projects/" + item.project_id + "#" + config.anchor}>
                  {kind === "approvals" ? "Review decision →" : "Open in project →"}
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
