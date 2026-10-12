type Activity = {
  id: string;
  event_type: string;
  summary: string;
  client_visible: boolean;
  created_at: string;
};

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  return (
    <section className="panel" aria-label="Activity timeline">
      <div className="panel-heading">
        <h3>Timeline</h3>
        <span className="pipeline-count">{activities.length}</span>
      </div>
      <ul className="delivery-list">
        {activities.length === 0 ? (
          <li className="delivery-row">
            <p className="pipeline-empty">Quiet… too quiet. Do something worth logging.</p>
          </li>
        ) : (
          activities.map((a) => (
            <li key={a.id} className="delivery-row">
              <div className="delivery-row-main">
                <p className="delivery-row-title">{a.summary}</p>
                <p className="delivery-row-sub">
                  {new Date(a.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {a.client_visible ? <span className="delivery-pill visible">Client sees this</span> : null}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
