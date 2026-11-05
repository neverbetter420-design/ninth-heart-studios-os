import { AtelierSymbol, type AtelierSymbolName } from "./AtelierSymbol";

/** Real-data studio instrument. The NHS mark never replaces the visible label. */
export function MetricCard({
  label, value, detail, tone, symbol,
}: {
  label: string;
  value: string;
  detail: string;
  tone: string;
  symbol?: AtelierSymbolName;
}) {
  const defaultMark: AtelierSymbolName =
    tone === "pink" ? "rose" : tone === "cyan" ? "spark" :
    tone === "green" ? "key" : "skull";
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-glow" />
      <span className="metric-symbol" aria-hidden="true">
        <AtelierSymbol name={symbol ?? defaultMark} size={25} />
      </span>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}
