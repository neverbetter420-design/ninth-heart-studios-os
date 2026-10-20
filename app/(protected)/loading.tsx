export default function WorkspaceLoading() {
  return (
    <div className="content-wrap workspace-loading" role="status" aria-live="polite" aria-busy="true">
      <div className="workspace-loading-header">
        <p className="eyebrow electric">Ninth Heart Studios</p>
        <h2>Opening your workspace…</h2>
        <p className="page-description">Loading your latest projects and activity.</p>
      </div>
      <div className="workspace-loading-metrics" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="panel workspace-loading-metric" key={index}>
            <span className="workspace-skeleton workspace-skeleton-short" />
            <span className="workspace-skeleton workspace-skeleton-medium" />
          </div>
        ))}
      </div>
      <div className="panel workspace-loading-panel" aria-hidden="true">
        <span className="workspace-skeleton workspace-skeleton-medium" />
        <span className="workspace-skeleton" />
        <span className="workspace-skeleton" />
        <span className="workspace-skeleton workspace-skeleton-short" />
      </div>
    </div>
  );
}
