// Muse Project Guide PG-01: pure draft validation. No database writes or external effects.
export type DraftSubtask = { tempId: string; title: string; instructions: string; position: number; completionCriteria: string[] };
export type DraftTask = { tempId: string; title: string; description: string; priority: "low"|"normal"|"high"|"urgent"; position: number; estimatedMinutes: number|null; completionCriteria: string[]; dependsOn: string[]; subtasks: DraftSubtask[] };
export type DraftPhase = { tempId: string; title: string; position: number; tasks: DraftTask[] };
export type MuseProjectPlan = { schemaVersion: "1.0"; projectId: string; projectRevision: number; summary: string; phases: DraftPhase[]; warnings: string[] };
export type ValidationResult = { ok: boolean; errors: string[]; taskOrder: string[] };
const priorities = new Set(["low","normal","high","urgent"]);
const nonempty = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0;
const unique = (values: (string|number)[]) => new Set(values).size === values.length;
export function validateMuseProjectPlan(plan: MuseProjectPlan): ValidationResult {
  const errors: string[] = [], all = new Map<string,DraftTask>(), order: string[] = [];
  if (plan.schemaVersion !== "1.0") errors.push("Unsupported schemaVersion");
  if (!nonempty(plan.projectId) || !Number.isSafeInteger(plan.projectRevision) || plan.projectRevision < 0) errors.push("Invalid project identity/revision");
  if (!Array.isArray(plan.phases) || !plan.phases.length) errors.push("Plan must contain phases");
  const phases = Array.isArray(plan.phases) ? plan.phases : [];
  if (!unique(phases.map(p=>p.tempId)) || !unique(phases.map(p=>p.position))) errors.push("Duplicate phase ID/position");
  const allIds = new Set<string>();
  for (const phase of phases) {
    if (!nonempty(phase.tempId) || !nonempty(phase.title) || !Number.isInteger(phase.position) || phase.position < 0) errors.push("Invalid phase");
    if (!Array.isArray(phase.tasks)) { errors.push("Invalid task collection"); continue; }
    if (!unique(phase.tasks.map(t=>t.position))) errors.push("Duplicate task position");
    for (const task of phase.tasks) {
      if (!nonempty(task.tempId) || allIds.has(task.tempId)) errors.push("Invalid/duplicate task ID");
      allIds.add(task.tempId); all.set(task.tempId,task);
      if (!nonempty(task.title) || !priorities.has(task.priority) || !Number.isInteger(task.position) || task.position < 0) errors.push("Invalid task");
      if (task.estimatedMinutes !== null && (!Number.isSafeInteger(task.estimatedMinutes) || task.estimatedMinutes < 0)) errors.push("Invalid estimate");
      if (!Array.isArray(task.dependsOn) || !unique(task.dependsOn)) errors.push("Invalid dependencies");
      if (!Array.isArray(task.completionCriteria) || !task.completionCriteria.every(nonempty)) errors.push("Invalid completion criteria");
      if (!Array.isArray(task.subtasks)) { errors.push("Invalid subtasks"); continue; }
      if (!unique(task.subtasks.map(s=>s.tempId)) || !unique(task.subtasks.map(s=>s.position))) errors.push("Duplicate subtask ID/position");
      for (const sub of task.subtasks) {
        if (!nonempty(sub.tempId) || allIds.has(sub.tempId) || !nonempty(sub.title) || !nonempty(sub.instructions) || !Number.isInteger(sub.position) || sub.position < 0 || !Array.isArray(sub.completionCriteria) || !sub.completionCriteria.every(nonempty)) errors.push("Invalid subtask");
        allIds.add(sub.tempId);
      }
    }
  }
  const visited=new Set<string>(), visiting=new Set<string>();
  function visit(id:string):void {
    if (visiting.has(id)) { errors.push("Dependency cycle"); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of all.get(id)?.dependsOn ?? []) {
      if (!all.has(dep)) { errors.push("Unknown dependency: "+dep); continue; }
      if (dep===id) { errors.push("Self dependency"); continue; }
      visit(dep);
    }
    visiting.delete(id); visited.add(id); order.push(id);
  }
  for(const id of all.keys()) visit(id);
  return {ok:errors.length===0,errors:[...new Set(errors)],taskOrder:order};
}
export function readyTaskIds(plan:MuseProjectPlan, completed:ReadonlySet<string>):string[] {
  const validated=validateMuseProjectPlan(plan);
  if(!validated.ok) throw new Error(validated.errors.join("; "));
  const tasks=plan.phases.flatMap(p=>p.tasks);
  return validated.taskOrder.filter(id=>!completed.has(id) && tasks.find(t=>t.tempId===id)!.dependsOn.every(dep=>completed.has(dep)));
}
