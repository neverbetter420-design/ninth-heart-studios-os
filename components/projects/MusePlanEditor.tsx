"use client";

import { useState, type FormEvent } from "react";
import { parseMuseProjectPlan, type MusePlanPriority, type MusePlanSubtask, type MuseProjectPlan } from "@/lib/muse-project-guide";
import { reviewMuseChanges, type MuseReviewDiff } from "@/lib/muse-plan-review";

type EditableField = keyof MusePlanSubtask;
const initialStep = (): MusePlanSubtask => ({
  title: "New project step", description: "Describe the small, actionable step.",
  definition_of_done: "The step has been checked and recorded.",
  priority: "normal", due_date: null, estimated_minutes: null, client_visible: false,
});
const totalTasks = (p: MuseProjectPlan) =>
  p.tasks.reduce((n, task) => n + 1 + task.subtasks.length, 0);

export function MusePlanEditor({
  original, revision, expiresAt, saving, onCancel, onSave,
}: {
  original: MuseProjectPlan;
  revision: number;
  expiresAt: string;
  saving: boolean;
  onCancel: () => void;
  onSave: (next: MuseProjectPlan, note: string) => Promise<void>;
}) {
  const [edited, setEdited] = useState<MuseProjectPlan>(() => structuredClone(original));
  const [changeNote, setChangeNote] = useState("");
  const [reviewedSignature, setReviewedSignature] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const signature = JSON.stringify(edited);
  let clean: MuseProjectPlan | null = null;
  let diff: MuseReviewDiff | null = null;
  try {
    clean = parseMuseProjectPlan(edited);
    diff = reviewMuseChanges(original, clean);
  } catch { /* Keep incomplete in-progress input local; never submit it. */ }
  const expired = Date.parse(expiresAt) <= Date.now();
  const hasChanges = Boolean(diff?.hasChanges);
  const canReview = !saving && !expired && revision < 25 && !!clean && hasChanges;
  const canSave = canReview && reviewedSignature === signature
    && changeNote.trim().length >= 2 && changeNote.trim().length <= 250;

  function mutateTask(index: number, field: EditableField, value: MusePlanSubtask[EditableField], subIndex?: number) {
    setEdited(current => {
      const next = structuredClone(current);
      const target = subIndex === undefined ? next.tasks[index] : next.tasks[index].subtasks[subIndex];
      (target as unknown as Record<string, unknown>)[field] = value;
      return next;
    });
  }
  function addTask() {
    if (edited.tasks.length >= 12 || totalTasks(edited) >= 48) return;
    setEdited(current => ({
      ...current, tasks: [...current.tasks, { ...initialStep(), subtasks: [] }],
    }));
  }
  function removeTask(index: number) {
    if (edited.tasks.length <= 1) return;
    setEdited(current => ({ ...current, tasks: current.tasks.filter((_, i) => i !== index) }));
  }
  function addStep(index: number) {
    if (totalTasks(edited) >= 48 || edited.tasks[index].subtasks.length >= 8) return;
    setEdited(current => {
      const next = structuredClone(current);
      next.tasks[index].subtasks.push(initialStep());
      return next;
    });
  }
  function removeStep(index: number, subIndex: number) {
    setEdited(current => {
      const next = structuredClone(current);
      next.tasks[index].subtasks.splice(subIndex, 1);
      return next;
    });
  }
  function cancel() {
    if (!hasChanges || window.confirm("Discard these unsaved edits? Your saved revision will remain untouched.")) onCancel();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSave || !clean || !diff) return;
    if (!window.confirm(
      `Save revision ${revision + 1} with ${diff.changes.length} reviewed changes?`
      + (diff.newlyClientVisible ? ` ${diff.newlyClientVisible} items will become client-visible if you later approve the plan.` : "")
      + " No project tasks will be created now."
    )) return;
    await onSave(clean, changeNote.trim());
  }

  function fields(index: number, task: MusePlanSubtask, subIndex?: number) {
    const id = `muse-edit-${index}-${subIndex ?? "parent"}`;
    const set = <K extends EditableField>(field: K, value: MusePlanSubtask[K]) =>
      mutateTask(index, field, value, subIndex);
    return <div className="muse-editor-fields">
      <label htmlFor={id + "-title"}>Title
        <input id={id + "-title"} value={task.title} maxLength={160} minLength={2} required
          disabled={saving} onChange={event => set("title", event.target.value)} />
      </label>
      <label htmlFor={id + "-description"}>What needs doing?
        <textarea id={id + "-description"} value={task.description} minLength={2} maxLength={1200} rows={2} required
          disabled={saving} onChange={event => set("description", event.target.value)} />
      </label>
      <label htmlFor={id + "-done"}>Definition of done
        <textarea id={id + "-done"} value={task.definition_of_done} minLength={2} maxLength={600} rows={2} required
          disabled={saving} onChange={event => set("definition_of_done", event.target.value)} />
      </label>
      <div className="muse-editor-compact">
        <label htmlFor={id + "-priority"}>Priority
          <select id={id + "-priority"} value={task.priority} disabled={saving}
            onChange={event => set("priority", event.target.value as MusePlanPriority)}>
            <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
          </select>
        </label>
        <label htmlFor={id + "-date"}>Due date (optional)
          <input id={id + "-date"} type="date" value={task.due_date ?? ""} disabled={saving}
            onChange={event => set("due_date", event.target.value || null)} />
        </label>
        <label htmlFor={id + "-estimate"}>Focus minutes
          <input id={id + "-estimate"} type="number" min={5} max={1440} step={1} value={task.estimated_minutes ?? ""}
            disabled={saving} onChange={event => set("estimated_minutes",
              event.target.value === "" ? null : Number(event.target.value))} />
        </label>
      </div>
      <label className="muse-editor-visibility" htmlFor={id + "-visible"}>
        <input id={id + "-visible"} type="checkbox" checked={task.client_visible} disabled={saving}
          onChange={event => set("client_visible", event.target.checked)} />
        <span>{task.client_visible ? "Client-visible after approval" : "Studio-only (private)"}</span>
      </label>
    </div>;
  }

  return <form className="muse-plan-editor" onSubmit={submit} aria-label="Edit saved Muse plan revision">
    <div className="muse-editor-heading">
      <div><p className="muse-guide-kicker">PRIVATE EDIT STUDIO</p>
        <h4>Edit revision {revision}</h4>
        <p>Changes stay local until you review and save. Saving never creates tasks or sends messages.</p>
      </div>
      <span className="muse-editor-counter">{totalTasks(edited)} / 48 tasks</span>
    </div>
    <label className="muse-editor-summary" htmlFor="muse-edit-summary">Project summary
      <textarea id="muse-edit-summary" rows={3} required minLength={2} maxLength={800}
        disabled={saving} value={edited.summary}
        onChange={event => setEdited(current => ({ ...current, summary: event.target.value }))} />
    </label>
    <div className="muse-editor-task-list">
      {edited.tasks.map((task, index) => <details className="muse-editor-task" key={index} open={index === 0 ? undefined : undefined} >
        <summary><span>Task {index + 1} · {task.title || "Untitled"}</span>
          <small>{task.subtasks.length} steps · {task.client_visible ? "Client-visible" : "Private"}</small>
        </summary>
        <div className="muse-editor-task-body">
          {fields(index, task)}
          <div className="muse-editor-task-actions">
            <button type="button" className="mini-button" disabled={saving || edited.tasks.length <= 1}
              onClick={() => removeTask(index)}>Remove task</button>
          </div>
          <div className="muse-editor-subtasks">
            <p className="muse-guide-kicker">STEPS</p>
            {task.subtasks.map((step, stepIndex) => <details key={stepIndex} className="muse-editor-step">
              <summary>Step {stepIndex + 1} · {step.title || "Untitled"}</summary>
              <div className="muse-editor-step-body">
                {fields(index, step, stepIndex)}
                <button type="button" className="mini-button" disabled={saving} onClick={() => removeStep(index, stepIndex)}>Remove step</button>
              </div>
            </details>)}
            <button type="button" className="mini-button" disabled={saving || task.subtasks.length >= 8 || totalTasks(edited) >= 48}
              onClick={() => addStep(index)}>+ Add step</button>
          </div>
        </div>
      </details>)}
    </div>
    <button type="button" className="mini-button" disabled={saving || edited.tasks.length >= 12 || totalTasks(edited) >= 48}
      onClick={addTask}>+ Add task</button>
    <div className="muse-editor-review">
      <div className="muse-editor-heading">
        <div><p className="muse-guide-kicker">BEFORE / AFTER</p><h4>Review your changes</h4></div>
        <span>{diff ? diff.changes.length + " changes" : "Needs valid fields"}</span>
      </div>
      {diff ? <>
        <p className="muse-plan-review-note">Tasks {diff.oldTaskCount} → {diff.newTaskCount} · Client-visible {diff.oldVisible} → {diff.newVisible}</p>
        {diff.newlyClientVisible > 0 && <p className="muse-editor-warning" role="status">
          {diff.newlyClientVisible} additional {diff.newlyClientVisible === 1 ? "item is" : "items are"} marked client-visible.
          They will only become visible if you later approve and create these tasks.
        </p>}
        {diff.hasChanges ? <>
          <button type="button" className="mini-button" disabled={saving} onClick={() => setShowDiff(!showDiff)}>
            {showDiff ? "Hide detailed changes" : "Show detailed changes"}
          </button>
          {showDiff && <ol className="muse-editor-diff-list">{diff.changes.map((change, index) =>
            <li key={index}><strong>{change.field}</strong>
              <span><b>Before:</b> {change.before}</span><span><b>After:</b> {change.after}</span>
            </li>)}</ol>}
        </> : <p className="muse-plan-review-note">No changes to save.</p>}
      </> : <p className="muse-editor-warning" role="alert">Complete valid titles, descriptions, dates and estimates before reviewing.</p>}
      <label htmlFor="muse-edit-note">Why did this revision change?
        <input id="muse-edit-note" required minLength={2} maxLength={250} disabled={saving} value={changeNote}
          onChange={event => setChangeNote(event.target.value)} placeholder="e.g. Move the booking page ahead of the menu" />
      </label>
      <button type="button" className="mini-button" disabled={!canReview}
        onClick={() => { setReviewedSignature(signature); setShowDiff(true); }}>
        {reviewedSignature === signature ? "✓ Reviewed this exact edit" : "Mark these changes reviewed"}
      </button>
      {reviewedSignature && reviewedSignature !== signature && <p className="muse-editor-warning" role="status">
        The draft changed after review. Review the updated changes again before saving.
      </p>}
      {expired && <p className="muse-editor-warning" role="alert">This plan has expired. Reload a new saved draft; no edits can be saved.</p>}
    </div>
    <div className="muse-plan-approval">
      <button type="button" className="mini-button" disabled={saving} onClick={cancel}>Cancel edits</button>
      <button type="submit" className="mini-button go" disabled={!canSave}>
        {saving ? "Saving reviewed revision…" : `Save revision ${revision + 1} · no tasks created`}
      </button>
    </div>
  </form>;
}
