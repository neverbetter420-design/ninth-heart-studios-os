"use client";

import { useState } from "react";
import { parseMuseProjectPlan, type MuseProjectPlan } from "@/lib/muse-project-guide";
import { reviewMuseChanges, type MuseReviewDiff } from "@/lib/muse-plan-review";

type HistoryEntry = {
  revision: number; change_summary: string; created_at: string;
  summary: string; task_count: number; client_visible: number;
};
type SelectedRevision = HistoryEntry & { plan: MuseProjectPlan };
const parseIndex = (response: Record<string, unknown>, planId: string, projectId: string, revision: number): HistoryEntry[] => {
  if (response.plan_id !== planId || response.project_id !== projectId ||
    response.current_revision !== revision || !Array.isArray(response.revisions) ||
    response.revisions.length !== revision || revision < 1 || revision > 25) throw new Error("Invalid history receipt.");
  return response.revisions.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid history item.");
    const item = raw as Record<string, unknown>;
    if (item.revision !== revision - index ||
      typeof item.change_summary !== "string" || item.change_summary.length < 2 || item.change_summary.length > 250 ||
      typeof item.created_at !== "string" || !Number.isFinite(Date.parse(item.created_at)) ||
      typeof item.summary !== "string" || item.summary.length < 2 ||
      !Number.isSafeInteger(item.task_count) || Number(item.task_count) < 1 || Number(item.task_count) > 48 ||
      !Number.isSafeInteger(item.client_visible) || Number(item.client_visible) < 0 ||
      Number(item.client_visible) > Number(item.task_count)) throw new Error("Invalid history item.");
    return {
      revision: item.revision as number, change_summary: item.change_summary,
      created_at: item.created_at, summary: item.summary,
      task_count: item.task_count as number, client_visible: item.client_visible as number,
    };
  });
};

export function MuseRevisionHistory({
  planId, projectId, currentRevision, currentPlan, disabled, call, onRestore,
}: {
  planId: string; projectId: string; currentRevision: number;
  currentPlan: MuseProjectPlan; disabled: boolean;
  call: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  onRestore: (snapshot: MuseProjectPlan, revision: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<HistoryEntry[] | null>(null);
  const [selected, setSelected] = useState<SelectedRevision | null>(null);
  const [loading, setLoading] = useState<"index" | "revision" | null>(null);
  const [error, setError] = useState("");

  async function load() {
    if (disabled || loading) return;
    setLoading("index"); setError(""); setSelected(null); setRows(null);
    try {
      const response = await call({ action: "load_history", project_id: projectId, plan_id: planId });
      setRows(parseIndex(response, planId, projectId, currentRevision));
      setOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Saved revision history is unavailable.");
    } finally { setLoading(null); }
  }

  async function view(entry: HistoryEntry) {
    if (disabled || loading || !rows) return;
    setLoading("revision"); setError(""); setSelected(null);
    try {
      const response = await call({ action: "load_revision", project_id: projectId,
        plan_id: planId, revision: entry.revision });
      if (response.plan_id !== planId || response.project_id !== projectId ||
        response.revision !== entry.revision || response.current_revision !== currentRevision ||
        response.created_at !== entry.created_at || response.change_summary !== entry.change_summary) {
        throw new Error("Historic revision receipt does not match the index.");
      }
      const plan = parseMuseProjectPlan(response.plan);
      const count = plan.tasks.reduce((n, task) => n + 1 + task.subtasks.length, 0);
      const visible = plan.tasks.reduce((n, task) => n + Number(task.client_visible) +
        task.subtasks.filter(child => child.client_visible).length, 0);
      if (plan.summary !== entry.summary || count !== entry.task_count || visible !== entry.client_visible) {
        throw new Error("Historic revision differs from its saved index.");
      }
      setSelected({ ...entry, plan });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load that revision.");
    } finally { setLoading(null); }
  }

  let comparison: MuseReviewDiff | null = null;
  if (selected) {
    try { comparison = reviewMuseChanges(currentPlan, selected.plan); }
    catch { comparison = null; }
  }
  function restore() {
    if (disabled || loading || !selected || !comparison?.hasChanges || currentRevision >= 25 ||
      selected.revision >= currentRevision) return;
    if (!window.confirm(`Load historical revision ${selected.revision} into the editor? This will NOT overwrite history, create tasks or save anything. Review and save as revision ${currentRevision + 1} only if you approve the changes.`)) return;
    onRestore(structuredClone(selected.plan), selected.revision);
  }

  return <section className="muse-history" aria-label="Saved Muse revision history">
    <div className="muse-history-heading">
      <div><p className="muse-guide-kicker">IMMUTABLE PLAN HISTORY</p><h5>Earlier drafts, safely preserved.</h5></div>
      <button type="button" className="mini-button" disabled={disabled || !!loading}
        onClick={() => {
          if (open) { setOpen(false); setSelected(null); }
          else if (rows) setOpen(true);
          else void load();
        }}>{loading === "index" ? "Loading revisions…" : open ? "Hide history" : "View revision history"}</button>
    </div>
    {error && <p className="muse-editor-warning" role="alert">{error}
      <button type="button" className="mini-button" disabled={disabled || !!loading} onClick={() => void load()}>
        Retry history
      </button>
    </p>}
    {open && rows && <div className="muse-history-content">
      <p className="muse-plan-review-note">Read-only history · {rows.length} saved {rows.length === 1 ? "revision" : "revisions"}.
        Returning to an earlier version always creates a new reviewed revision, never overwrites the original.</p>
      <ol className="muse-history-list">{rows.map(row => <li key={row.revision}>
        <div><strong>Revision {row.revision}{row.revision === currentRevision ? " · Current" : ""}</strong>
          <small>{new Date(row.created_at).toLocaleString()} · {row.task_count} tasks · {row.client_visible} client-visible</small>
          <p>{row.change_summary}</p>
        </div>
        <button type="button" className="mini-button" disabled={disabled || !!loading}
          onClick={() => void view(row)}>{loading === "revision" ? "Checking…" : "Compare"}</button>
      </li>)}</ol>
      {selected && <div className="muse-history-compare" aria-live="polite">
        <div><p className="muse-guide-kicker">COMPARE AGAINST CURRENT · REVISION {currentRevision}</p>
          <h5>Revision {selected.revision}: {selected.summary}</h5></div>
        {comparison ? <>
          <p className="muse-plan-review-note">{comparison.changes.length} differences from current ·
            {comparison.newVisible} client-visible in selected version</p>
          {comparison.newlyClientVisible > 0 && <p className="muse-editor-warning" role="status">
            Restoring these values would mark {comparison.newlyClientVisible} additional
            {comparison.newlyClientVisible === 1 ? " item" : " items"} client-visible if later approved.
          </p>}
          {comparison.hasChanges ? <ol className="muse-editor-diff-list">{comparison.changes.map((change,index)=>
            <li key={index}><strong>{change.field}</strong>
              <span><b>Current:</b> {change.before}</span><span><b>Selected:</b> {change.after}</span>
            </li>)}</ol> : <p className="muse-plan-review-note">This snapshot has the same task content as the current draft.</p>}
          <button type="button" className="mini-button go" disabled={disabled || !!loading ||
            !comparison.hasChanges || selected.revision >= currentRevision || currentRevision >= 25}
            onClick={restore}>Open as new reviewed revision · No overwrite</button>
        </> : <p role="alert" className="muse-editor-warning">Invalid comparison. Restoration is blocked.</p>}
      </div>}
    </div>}
  </section>;
}
