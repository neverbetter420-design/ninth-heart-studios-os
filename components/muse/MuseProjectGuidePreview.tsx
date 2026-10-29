"use client";

import { useMemo, useState } from "react";
import { MUSE_DEMO_PLAN } from "@/lib/muse-project-guide-demo";
import { readyTaskIds } from "@/lib/muse-project-guide";

type View = "guide" | "roadmap" | "approval";
const views: { id: View; label: string }[] = [
  { id: "guide", label: "Guide" },
  { id: "roadmap", label: "Roadmap" },
  { id: "approval", label: "Approval preview" },
];

export function MuseProjectGuidePreview() {
  const [view, setView] = useState<View>("guide");
  const [activePhase, setActivePhase] = useState(0);
  const [selectedId, setSelectedId] = useState("task-1");
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set());
  const [checkedSteps, setCheckedSteps] = useState<Set<string>>(() => new Set());
  const [editedTitles, setEditedTitles] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [demoNotice, setDemoNotice] = useState("");

  const phases = MUSE_DEMO_PLAN.phases;
  const tasks = useMemo(() => phases.flatMap((p) => p.tasks), [phases]);
  const ready = useMemo(
    () => new Set(readyTaskIds(MUSE_DEMO_PLAN, completedIds)),
    [completedIds],
  );
  const selected = tasks.find((t) => t.tempId === selectedId) ?? tasks[0];
  const selectedPhase = phases.findIndex((p) => p.tasks.some((t) => t.tempId === selected.tempId));
  const hasAllSteps = selected.subtasks.every((step) => checkedSteps.has(step.tempId));
  const selectedDone = completedIds.has(selected.tempId);
  const selectedReady = ready.has(selected.tempId);
  const blockedBy = selected.dependsOn
    .filter((id) => !completedIds.has(id))
    .map((id) => editedTitles[id] || tasks.find((t) => t.tempId === id)?.title || "Prior task");
  const percent = Math.round((completedIds.size / tasks.length) * 100);

  const chooseTask = (id: string) => {
    setSelectedId(id);
    setEditing(false);
    const index = phases.findIndex((p) => p.tasks.some((t) => t.tempId === id));
    if (index !== -1) setActivePhase(index);
    setView("guide");
    setDemoNotice("");
  };
  const markComplete = () => {
    if (!selectedReady || !hasAllSteps || selectedDone) return;
    setCompletedIds((prev) => new Set([...prev, selected.tempId]));
    setDemoNotice("Marked complete in this preview only. No project record was changed.");
  };
  const toggleStep = (id: string, checked: boolean) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const resetDemo = () => {
    setCompletedIds(new Set());
    setCheckedSteps(new Set());
    setEditedTitles({});
    setSelectedId("task-1");
    setActivePhase(0);
    setEditing(false);
    setDemoNotice("Preview progress reset. Your actual projects were never affected.");
  };

  return (
    <section className="muse-guide" aria-label="Muse Project Guide interactive demonstration">
      <div className="muse-guide-atmosphere" aria-hidden="true" />
      <header className="muse-guide-hero">
        <div>
          <span className="muse-guide-kicker">Muse / Creative Studio / Project Guide</span>
          <h1>A little magic. <em>A lot of structure.</em></h1>
          <p>From first idea to final launch, one clear decision at a time.</p>
        </div>
        <div className="muse-guide-monogram" aria-hidden="true"><span>✦</span></div>
      </header>
      <div className="muse-guide-ribbon" role="note">
        <span className="muse-guide-status-dot" aria-hidden="true" />
        <strong>Interactive concept</strong>
        <span>Sample data only. No edits, approvals, or tasks are saved to NHS OS.</span>
      </div>
      <div className="muse-guide-stats" aria-label="Sample project progress">
        <div><strong>04</strong><span>Project phases</span></div>
        <div><strong>21</strong><span>Planned tasks</span></div>
        <div><strong>42</strong><span>Guided steps</span></div>
        <div><strong>{percent}%</strong><span>Preview complete</span></div>
      </div>
      <div className="muse-guide-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Demo project completion">
        <span style={{ width: percent + "%" }} />
      </div>
      <nav className="muse-guide-tabs" aria-label="Project Guide views">
        {views.map((item) => (
          <button key={item.id} type="button" aria-current={view === item.id ? "page" : undefined}
            className={view === item.id ? "is-active" : ""} onClick={() => { setView(item.id); setDemoNotice(""); }}>
            {item.label}
          </button>
        ))}
        <button className="muse-guide-reset" type="button" onClick={resetDemo}>Reset demo</button>
      </nav>

      {view === "guide" && (
        <div className="muse-guide-columns">
          <aside className="muse-guide-sidebar" aria-label="Project phases and tasks">
            <p className="muse-guide-overline">YOUR ROADMAP</p>
            <div className="muse-guide-phase-nav">
              {phases.map((phase, index) => (
                <button type="button" key={phase.tempId} aria-pressed={activePhase === index}
                  className={activePhase === index ? "is-active" : ""}
                  onClick={() => { setActivePhase(index); chooseTask(phase.tasks[0].tempId); }}>
                  <span>0{index + 1}</span><strong>{phase.title}</strong>
                </button>
              ))}
            </div>
            <div className="muse-guide-task-menu">
              <p className="muse-guide-overline">PHASE {activePhase + 1} · {phases[activePhase].tasks.length} TASKS</p>
              {phases[activePhase].tasks.map((task) => (
                <button type="button" key={task.tempId} className={selectedId === task.tempId ? "is-selected" : ""}
                  aria-current={selectedId === task.tempId ? "step" : undefined}
                  onClick={() => chooseTask(task.tempId)}>
                  <span aria-hidden="true">{completedIds.has(task.tempId) ? "✓" : ready.has(task.tempId) ? "◉" : "○"}</span>
                  <span>{editedTitles[task.tempId] || task.title}</span>
                </button>
              ))}
            </div>
          </aside>
          <article className="muse-guide-detail" aria-label="Selected task guidance">
            <p className="muse-guide-overline">PHASE 0{selectedPhase + 1} · TASK {selected.position + 1}</p>
            <div className="muse-guide-task-head">
              <h2>{editedTitles[selected.tempId] || selected.title}</h2>
              <span className="muse-guide-state" data-state={selectedDone ? "complete" : selectedReady ? "ready" : "blocked"}>
                {selectedDone ? "Complete" : selectedReady ? "Ready" : "Blocked"}
              </span>
            </div>
            <p className="muse-guide-detail-description">{selected.description}</p>
            <div className="muse-guide-guidance">
              <span className="muse-guide-sparkle" aria-hidden="true">✦</span>
              <div>
                <strong>Muse says</strong>
                <p>{selectedDone
                  ? "Beautiful. One less thing haunting your to-do list."
                  : selectedReady
                    ? "This one is ready. Work through the steps, review your result, then mark it complete."
                    : "Not so fast, genius. Finish the prerequisite before starting this one. Future you will appreciate it."}</p>
              </div>
            </div>
            {blockedBy.length > 0 && (
              <p className="muse-guide-blocked" role="status">Waiting for: {blockedBy.join(", ")}</p>
            )}
            <div className="muse-guide-section-heading">
              <h3>Step by step</h3>
              <span>{selected.subtasks.filter((step) => checkedSteps.has(step.tempId)).length} / {selected.subtasks.length}</span>
            </div>
            <div className="muse-guide-checklist">
              {selected.subtasks.map((step) => (
                <label key={step.tempId} className="muse-guide-check">
                  <input type="checkbox" checked={checkedSteps.has(step.tempId)}
                    disabled={selectedDone || !selectedReady}
                    onChange={(e) => toggleStep(step.tempId, e.target.checked)} />
                  <span><strong>{step.title}</strong><small>{step.instructions}</small></span>
                </label>
              ))}
            </div>
            <div className="muse-guide-actions">
              <button type="button" className="muse-guide-primary"
                disabled={!selectedReady || !hasAllSteps || selectedDone} onClick={markComplete}>
                {selectedDone ? "Completed ✓" : "Mark complete · demo"}
              </button>
              <button type="button" className="muse-guide-secondary"
                onClick={() => { setEditing((prev) => !prev); setDemoNotice(""); }}>
                {editing ? "Close editor" : "Rename task"}
              </button>
            </div>
            {editing && (
              <label className="muse-guide-rename">Task name · this preview only
                <input type="text" maxLength={160} value={editedTitles[selected.tempId] ?? selected.title}
                  onChange={(e) => setEditedTitles((prev) => ({ ...prev, [selected.tempId]: e.target.value }))} />
              </label>
            )}
            {demoNotice && <p className="muse-guide-feedback" role="status">{demoNotice}</p>}
          </article>
        </div>
      )}

      {view === "roadmap" && (
        <section className="muse-guide-roadmap" aria-label="Four-phase project roadmap">
          <div className="muse-guide-view-heading"><span className="muse-guide-overline">THE BIG PICTURE</span><h2>Four phases. One focused next step.</h2>
            <p>Choose any task to open detailed, guided instructions.</p></div>
          <div className="muse-guide-roadmap-grid">
            {phases.map((phase, index) => (
              <article className="muse-guide-roadmap-phase" key={phase.tempId}>
                <span className="muse-guide-phase-index">0{index + 1}</span>
                <h3>{phase.title}</h3>
                <p>{phase.tasks.filter((t) => completedIds.has(t.tempId)).length} of {phase.tasks.length} tasks complete</p>
                <div className="muse-guide-roadmap-tasks">
                  {phase.tasks.map((task) => (
                    <button type="button" key={task.tempId} onClick={() => chooseTask(task.tempId)}>
                      <span aria-hidden="true">{completedIds.has(task.tempId) ? "✓" : "↗"}</span>
                      {editedTitles[task.tempId] || task.title}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {view === "approval" && (
        <section className="muse-guide-approval" aria-label="Sample change review">
          <div className="muse-guide-view-heading">
            <span className="muse-guide-overline">CONTROL BEFORE COMMITMENT</span>
            <h2>Nothing becomes live without your approval.</h2>
            <p>A real approval will show the exact draft version, changes, and content fingerprint before a protected transaction applies it.</p>
          </div>
          <div className="muse-guide-approval-body">
            <div className="muse-guide-approval-list">
              <div><span>Proposed phases</span><strong>4 internal milestones</strong></div>
              <div><span>Proposed tasks</span><strong>21 internal tasks</strong></div>
              <div><span>Proposed subtasks</span><strong>42 guided steps</strong></div>
              <div><span>External actions</span><strong>None</strong></div>
              <div><span>Changes to existing client work</span><strong>None</strong></div>
            </div>
            <aside className="muse-guide-approval-note">
              <span aria-hidden="true">✧</span><h3>Human in charge.</h3>
              <p>The real approval action remains unavailable in this demonstration. Proposed database changes are staged separately for review.</p>
              <button type="button" disabled aria-disabled="true" title="Disabled in synthetic preview">Approve & apply · unavailable</button>
            </aside>
          </div>
        </section>
      )}
      <footer className="muse-guide-footer">
        <span>✦ NHS OS / MUSE PROJECT GUIDE V1</span>
        <span>Read-only design preview · no live data</span>
      </footer>
    </section>
  );
}
