"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";

type CompassView = "now" | "journey" | "connect";

export function AtelierCompass({
  projectId,
  projectName,
  stage,
  progress,
  nextApprovalTitle,
  pendingApprovals,
  approvalsUnavailable,
}: {
  projectId: string;
  projectName: string;
  stage: string;
  progress: number;
  nextApprovalTitle: string | null;
  pendingApprovals: number;
  approvalsUnavailable: boolean;
}) {
  const [view, setView] = useState<CompassView>("now");
  const safeProgress = Math.max(0, Math.min(100, Number.isFinite(progress) ? Math.round(progress) : 0));
  const tabs: { id: CompassView; label: string; symbol: string }[] = [
    { id: "now", label: "Next", symbol: "✧" },
    { id: "journey", label: "Journey", symbol: "◇" },
    { id: "connect", label: "Connect", symbol: "✉" },
  ];

  return (
    <aside className="atelier-action-panel nhs-atelier-compass" aria-labelledby="atelier-action-heading">
      <div className="nhs-atelier-compass__head">
        <span className="atelier-overline">YOUR PRIVATE ATELIER</span>
        <span className="nhs-atelier-compass__spark" aria-hidden="true">✧</span>
      </div>
      <div className="nhs-atelier-compass__controls" role="group" aria-label="Explore your project actions">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={view === tab.id}
            onClick={() => setView(tab.id)}
          >
            <span aria-hidden="true">{tab.symbol}</span> {tab.label}
          </button>
        ))}
      </div>
      <div className="nhs-atelier-compass__scene" aria-live="polite" aria-atomic="true">
        {view === "now" ? (
          <div className="nhs-atelier-compass__view">
            <p className="nhs-atelier-compass__micro">
              {nextApprovalTitle ? "YOUR NEXT DECISION" : "YOUR STUDIO UPDATE"}
            </p>
            <span className="nhs-atelier-compass__illustration" aria-hidden="true">✧</span>
            <h3 id="atelier-action-heading">
              {nextApprovalTitle
                ? "A decision awaits you"
                : approvalsUnavailable
                  ? "Your workspace is ready"
                  : "Stay in the loop"}
            </h3>
            <p className="nhs-atelier-compass__copy">
              {nextApprovalTitle ??
                (approvalsUnavailable
                  ? "Visit your project for the latest updates and requests."
                  : "Everything important is waiting in your project workspace.")}
            </p>
            <Link className="atelier-text-link" href={nextApprovalTitle ? "/portal/approvals" : "/portal/projects/" + projectId}>
              {nextApprovalTitle ? "Review approval" : "View project updates"}
              <span aria-hidden="true">↗</span>
            </Link>
            {pendingApprovals > 1 && (
              <p className="atelier-action-note">{pendingApprovals} decisions in your approvals.</p>
            )}
          </div>
        ) : view === "journey" ? (
          <div className="nhs-atelier-compass__view">
            <p className="nhs-atelier-compass__micro">PROJECT JOURNEY</p>
            <div
              className="nhs-atelier-compass__progress"
              style={{ "--compass-progress": safeProgress + "%" } as CSSProperties}
              role="progressbar"
              aria-label={"Studio-reported progress for " + projectName}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={safeProgress}
            >
              <div className="nhs-atelier-compass__progress-inner">
                <strong>{safeProgress}%</strong>
                <span>REPORTED</span>
              </div>
            </div>
            <h3 id="atelier-action-heading">{stage}</h3>
            <p className="nhs-atelier-compass__copy">
              Explore the project phases, shared milestones, and latest decisions.
            </p>
            <Link className="atelier-text-link" href={"/portal/projects/" + projectId}>
              Open project journey <span aria-hidden="true">↗</span>
            </Link>
          </div>
        ) : (
          <div className="nhs-atelier-compass__view">
            <p className="nhs-atelier-compass__micro">STAY CONNECTED</p>
            <span className="nhs-atelier-compass__illustration" aria-hidden="true">✉</span>
            <h3 id="atelier-action-heading">A beautiful conversation.</h3>
            <p className="nhs-atelier-compass__copy">
              Your messages live in one private place, connected to your projects.
            </p>
            <Link className="atelier-text-link" href="/portal/messages">
              Open messages <span aria-hidden="true">↗</span>
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
