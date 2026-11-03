import Image from "next/image";
import Link from "next/link";
import { AtelierSymbol, type AtelierSymbolName } from "./AtelierSymbol";

/** Presentation only. All values and destinations come from the existing server Dashboard. */
type StudioPassage = {
  href: string;
  label: string;
  symbol: AtelierSymbolName;
  tone: string;
};
type StudioMetric = {
  label: string;
  value: string;
  detail: string;
  tone: "violet" | "pink" | "cyan";
};
type StudioProject = { progress: number };

export function LivingStudioHub({
  passages,
  metrics,
  projects,
}: {
  passages: readonly StudioPassage[];
  metrics: readonly StudioMetric[];
  projects: readonly StudioProject[];
}) {
  const validProgress = projects
    .map((project) => project.progress)
    .filter((progress) => Number.isFinite(progress));
  const recentProgress = validProgress.length
    ? Math.round(
        validProgress.reduce(
          (sum, progress) => sum + Math.max(0, Math.min(100, progress)),
          0,
        ) / validProgress.length,
      )
    : null;

  return (
    <section className="living-studio" aria-labelledby="living-studio-title">
      <div className="living-studio__intro">
        <span className="living-studio__eyebrow">01 / Your command map</span>
        <h3 id="living-studio-title">A living<br /><em>studio.</em></h3>
        <p>Your rooms, priorities and momentum. Nothing buried in another card.</p>
        <span className="living-studio__flourish" aria-hidden="true">
          <AtelierSymbol name="rose" size={20} />
          <span />
          <AtelierSymbol name="spark" size={15} />
        </span>
      </div>

      <nav className="living-orbit" aria-label="Studio command hub">
        <span className="living-orbit__ring living-orbit__ring--outer" aria-hidden="true" />
        <span className="living-orbit__ring living-orbit__ring--inner" aria-hidden="true" />
        <div className="living-orbit__core">
          <Image
            src="/brand/nhs-original-logo.webp"
            alt="Ninth Heart Studios"
            width={104}
            height={104}
            unoptimized
          />
          <span>STUDIO OS</span>
        </div>
        {passages.map((passage) => (
          <Link
            key={passage.href}
            href={passage.href}
            className={`living-orbit__link living-orbit__link--${passage.tone}`}
          >
            <span className="living-orbit__symbol" aria-hidden="true">
              <AtelierSymbol name={passage.symbol} size={25} />
            </span>
            <span className="living-orbit__label">{passage.label}</span>
          </Link>
        ))}
      </nav>

      <aside className="living-status" aria-label="Current studio status">
        <span className="living-status__eyebrow">02 / Studio pulse</span>
        <dl className="living-status__metrics">
          {metrics.map((metric) => (
            <div key={metric.label} className={`living-status__metric living-status__metric--${metric.tone}`}>
              <dt>{metric.label}</dt>
              <dd><strong>{metric.value}</strong><span>{metric.detail}</span></dd>
            </div>
          ))}
        </dl>
        <div className="living-status__progress">
          <div className="living-status__progress-heading">
            <span>Recent project progress</span>
            <strong>{recentProgress === null ? "—" : `${recentProgress}%`}</strong>
          </div>
          {recentProgress === null ? (
            <p>No recent projects. <Link href="/projects">Open pipeline</Link></p>
          ) : (
            <>
              <div
                className="living-status__track"
                role="progressbar"
                aria-label="Average progress of up to four recent projects"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={recentProgress}
              >
                <span style={{ width: `${recentProgress}%` }} />
              </div>
              <small>Average of {validProgress.length} recent {validProgress.length === 1 ? "project" : "projects"}</small>
            </>
          )}
        </div>
      </aside>
    </section>
  );
}
