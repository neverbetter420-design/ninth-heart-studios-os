import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { projectGuideEnabled, parseMuseProjectPlan, UUID_PATTERN } from "@/lib/muse-project-guide-runtime";
import { MuseProjectGuidePreview } from "@/components/muse/MuseProjectGuidePreview";
import { MuseProjectGuideConnected } from "@/components/muse/MuseProjectGuideConnected";
import "@/app/muse-project-guide.css";

export const dynamic = "force-dynamic";

type Search = { mode?: string; project?: string; result?: string };
type Project = { id: string; name: string; muse_revision: number };
type Work = { id: string; title: string; status: string; position: number | null; phase: string | null; blockedBy: string[]; subtaskCount: number; subtaskComplete: number; ready: boolean };

export default async function MuseProjectGuidePage({ searchParams }: { searchParams?: Promise<Search> }) {
  await requireAdmin();
  const params = searchParams ? await searchParams : {};
  const enabled = projectGuideEnabled();
  if (!enabled || params.mode !== "connected") {
    return (
      <div className="content-wrap studio-page">
        <div style={{ marginBottom: 10 }}>
          <Link href="/muse" className="management-text-link">← Back to Muse</Link>
        </div>
        <MuseProjectGuidePreview />
        {params.mode === "connected" && !enabled && (
          <p className="muse-guide-feedback" role="note">Connected planning is disabled in this environment. This is an isolated demonstration and never changes client work.</p>
        )}
      </div>
    );
  }

  const supabase = await createClient();
  const { data: rawProjects, error: listError } = await supabase.from("projects")
    .select("id,name").order("updated_at",{ascending:false}).limit(50);
  const projects: Project[] = (rawProjects ?? []).map(p => ({id:p.id,name:p.name,muse_revision:0}));
  const requestedId = UUID_PATTERN.test(params.project ?? "") ? params.project! : null;
  let selected: Project | null = null;
  let unavailable = !!listError;
  let draft: {
    id: string; project_id: string; status: string; plan_version: number;
    base_project_revision: number; plan: NonNullable<ReturnType<typeof parseMuseProjectPlan>>;
    approved_hash: string | null;
  } | null = null;
  let review: {plan_version:number; plan_digest:string; plan:NonNullable<ReturnType<typeof parseMuseProjectPlan>>} | null = null;
  let work: Work[] = [];

  if (requestedId && !unavailable) {
    const {data, error} = await supabase.from("projects").select("id,name,muse_revision").eq("id",requestedId).maybeSingle();
    if (error) unavailable = true;
    else if (data) {
      selected = data as Project;
      if (!projects.some(p=>p.id===data.id)) projects.push(data as Project);
      const {data: rows, error: draftError} = await supabase.from("muse_project_plan_drafts")
        .select("id,project_id,status,plan_version,base_project_revision,plan,approved_hash")
        .eq("project_id",requestedId).order("created_at",{ascending:false}).limit(1);
      if (draftError) unavailable=true;
      else if (rows?.length) {
        const row=rows[0];
        const parsed=parseMuseProjectPlan(row.plan);
        if (!parsed || parsed.projectId!==requestedId || parsed.projectRevision!==row.base_project_revision) unavailable=true;
        else draft={...row,plan:parsed};
      }
    }
  }
  if (draft && draft.status === "pending_approval" && !unavailable) {
    const {data: rows,error} = await supabase.rpc("muse_review_project_plan",{p_draft_id:draft.id});
    const value = Array.isArray(rows) ? rows[0] : null;
    const parsed=parseMuseProjectPlan(value?.plan);
    if (error || !value || !parsed || parsed.projectId !== draft.project_id ||
      value.plan_version !== draft.plan_version || !/^[a-f0-9]{64}$/.test(value.plan_digest ?? "")) unavailable=true;
    else review={plan_version:value.plan_version,plan_digest:value.plan_digest,plan:parsed};
  }

  if (draft?.status==="applied" && selected && !unavailable) {
    const [taskResult,phaseResult,subResult,depResult] = await Promise.all([
      supabase.from("tasks").select("id,title,status,muse_position,muse_phase_id").eq("project_id",selected.id).not("muse_phase_id","is",null),
      supabase.from("milestones").select("id,title").eq("project_id",selected.id).eq("muse_internal",true),
      supabase.from("muse_project_subtasks").select("task_id,status").eq("project_id",selected.id),
      supabase.from("muse_task_dependencies").select("task_id,depends_on_task_id").eq("project_id",selected.id),
    ]);
    if ([taskResult,phaseResult,subResult,depResult].some(r=>r.error)) unavailable=true;
    else {
      const tasks=taskResult.data ?? [];
      const phases=new Map((phaseResult.data ?? []).map(p=>[p.id,p.title]));
      const index=new Map(tasks.map(t=>[t.id,t]));
      const deps=depResult.data ?? [];
      work=tasks.map(t=>{
        const previous=deps.filter(d=>d.task_id===t.id).map(d=>index.get(d.depends_on_task_id));
        const outstanding=previous.filter(p=>p?.status!=="complete");
        const steps=(subResult.data ?? []).filter(s=>s.task_id===t.id);
        return {
          id:t.id,title:t.title,status:t.status,position:t.muse_position,phase:phases.get(t.muse_phase_id!)??null,
          blockedBy:outstanding.map(p=>p?.title??"Unknown predecessor"),
          subtaskCount:steps.length,subtaskComplete:steps.filter(s=>s.status==="complete").length,
          ready:outstanding.length===0 && t.status!=="blocked" && t.status!=="complete",
        };
      }).sort((a,b)=>Number(b.ready)-Number(a.ready)||(a.position??0)-(b.position??0));
    }
  }

  return (
    <div className="content-wrap studio-page">
      <div style={{marginBottom:10}}><Link className="management-text-link" href="/muse">← Back to Muse</Link></div>
      <MuseProjectGuideConnected
        projects={projects} selected={selected} draft={draft} review={review}
        work={work} result={params.result ?? ""} unavailable={unavailable}
      />
    </div>
  );
}
