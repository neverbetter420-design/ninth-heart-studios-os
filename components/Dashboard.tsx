import { activity, metrics, nextActions, opportunities, projects } from "@/lib/mock-data";
import { MetricCard } from "./MetricCard";
import { PageHeader } from "./PageHeader";

export function Dashboard() {
  return (
    <div className="content-wrap">
      <PageHeader
        eyebrow="Command Center"
        title="Good evening, Hailey."
        description="The studio pulse at a glance. Human replies outrank busywork, because apparently software needed to be taught manners."
        action="+ Quick capture"
      />

      <section className="metric-grid" aria-label="Studio metrics">
        {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </section>

      <section className="dashboard-grid">
        <div className="panel action-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow electric">Priority engine</p>
              <h3>Next 3 actions</h3>
            </div>
            <span className="live-pill"><i /> Live logic</span>
          </div>

          <div className="action-list">
            {nextActions.map((item, index) => (
              <article className="action-row" key={item.id}>
                <div className={`priority-number priority-${item.priority}`}>{index + 1}</div>
                <div className="action-copy">
                  <span className="action-title">{item.title}</span>
                  <strong>{item.subject}</strong>
                  <small>{item.meta}</small>
                </div>
                <button className="ghost-button">{item.action}</button>
              </article>
            ))}
          </div>
        </div>

        <aside className="panel muse-panel">
          <div className="muse-hero">
            <span className="muse-orb large" />
            <div>
              <p className="eyebrow electric">Muse</p>
              <h3>Studio intelligence</h3>
            </div>
          </div>
          <p className="muse-copy">
            Three leads need attention. One actual human replied, so naturally that comes before reorganizing a template library for the sixth time.
          </p>
          <div className="muse-suggestion">
            <span>Suggested focus</span>
            <strong>Reply to Black Diamond Tavern</strong>
            <small>Momentum is highest right now.</small>
          </div>
          <button className="secondary-button wide">Open Muse</button>
        </aside>

        <div className="panel project-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Delivery</p>
              <h3>Project pulse</h3>
            </div>
            <button className="text-button">View pipeline →</button>
          </div>
          <div className="project-list">
            {projects.map((project) => (
              <div className="project-row" key={project.name}>
                <div className="project-copy">
                  <strong>{project.name}</strong>
                  <span>{project.stage} · {project.due}</span>
                </div>
                <div className="progress-track" aria-label={`${project.progress}% complete`}>
                  <span style={{ width: `${project.progress}%` }} />
                </div>
                <b>{project.progress}%</b>
              </div>
            ))}
          </div>
        </div>

        <div className="panel radar-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow electric">Opportunity Radar</p>
              <h3>Best matches</h3>
            </div>
            <span className="beta-pill">Preview</span>
          </div>
          <div className="radar-list">
            {opportunities.map((item) => (
              <div className="radar-row" key={item.title}>
                <div>
                  <small>{item.source}</small>
                  <strong>{item.title}</strong>
                </div>
                <div className="score-ring"><span>{item.score}</span></div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">System</p>
              <h3>Recent activity</h3>
            </div>
          </div>
          <div className="activity-list">
            {activity.map((item) => (
              <div className="activity-row" key={`${item.time}-${item.text}`}>
                <span className="activity-dot" />
                <p>{item.text}</p>
                <time>{item.time}</time>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
