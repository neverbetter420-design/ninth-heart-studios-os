import {
  closeRevisionRound,
  convertPinToChangeOrder,
  createChangeOrder,
  decideChangeOrder,
  createFeedbackPin,
  proposeChangeOrder,
  resolveFeedbackPin,
  startRevisionRound,
} from "@/app/(protected)/(admin)/projects/actions";
import { PinComposer, type FramePin } from "./FeedbackFrame";
import type { ScopeCreepVerdict } from "@/lib/muse";
import type { ChangeOrder, FeedbackPin, RevisionRound } from "@/lib/supabase/types";

function roundLabel(round: RevisionRound): string {
  const used = round.round_number;
  const allowed = round.included_rounds;
  return `Round ${used} of ${allowed} included`;
}

function orderPill(status: ChangeOrder["status"]): string {
  if (status === "approved") return "delivery-pill done";
  if (status === "proposed") return "delivery-pill progress";
  if (status === "declined") return "delivery-pill blocked";
  return "delivery-pill";
}

export function RevisionSection({
  projectId,
  rounds,
  activeRound,
  pins,
  changeOrders,
  scopeVerdicts,
}: {
  projectId: string;
  rounds: RevisionRound[];
  activeRound: RevisionRound | null;
  pins: FeedbackPin[];
  changeOrders: ChangeOrder[];
  scopeVerdicts: ScopeCreepVerdict[];
}) {
  const openRound = rounds.find((r) => r.status === "open") ?? null;
  const framePins: FramePin[] = pins.map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    comment: p.comment,
    resolved: p.resolved,
    page_url: p.page_url,
    created_at: p.created_at,
  }));
  const openPins = pins.filter((p) => !p.resolved);
  const flagged = scopeVerdicts.filter((v) => !v.inScope);

  return (
    <section className="panel" aria-label="Revision control">
      <div className="panel-heading">
        <h3>Revision control</h3>
        <span className="pipeline-count">
          {openRound ? roundLabel(openRound) : rounds.length === 0 ? "Not started" : "All rounds closed"}
        </span>
      </div>

      {/* Tracker */}
      {rounds.length > 0 ? (
        <ul className="delivery-list" style={{ marginBottom: 12 }}>
          {rounds.map((r) => (
            <li key={r.id} className="delivery-row">
              <div className="delivery-row-main">
                <p className="delivery-row-title">
                  Round {r.round_number}
                  {r.round_number > r.included_rounds ? " — beyond package" : ""}
                </p>
                <p className="delivery-row-sub">
                  Opened {new Date(r.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {r.status === "closed" && r.closed_at
                    ? ` · Closed ${new Date(r.closed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                    : ""}
                </p>
              </div>
              <span className={r.status === "open" ? "delivery-pill progress" : "delivery-pill done"}>
                {r.status === "open" ? "Open" : "Closed"}
              </span>
              {r.status === "open" ? (
                <form action={closeRevisionRound} className="mini-form">
                  <input type="hidden" name="round_id" value={r.id} />
                  <button type="submit" className="mini-button">Close round</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="pipeline-empty" style={{ marginBottom: 12 }}>
          No revision rounds yet. Start one and the client can pin feedback straight onto the work.
        </p>
      )}

      <form action={startRevisionRound} className="delivery-add-form" style={{ marginBottom: 16 }}>
        <input type="hidden" name="project_id" value={projectId} />
        <input
          type="number"
          name="included_rounds"
          min={0}
          max={25}
          defaultValue={openRound?.included_rounds ?? 3}
          aria-label="Rounds included in the package"
          style={{ width: 90 }}
        />
        <button type="submit" className="mini-button go">
          {rounds.length === 0 ? "Start revision tracking" : "Open next round"}
        </button>
        <span className="delivery-row-sub">rounds included in package</span>
      </form>

      {/* Visual feedback */}
      {activeRound ? (
        <>
          <div className="panel-heading" style={{ marginTop: 4 }}>
            <h3>Visual feedback — round {activeRound.round_number}</h3>
            <span className="pipeline-count">{openPins.length} open</span>
          </div>
          <PinComposer
            roundId={activeRound.id}
            hiddenFields={[]}
            addPinAction={createFeedbackPin}
            pins={framePins}
            ctaLabel="Drop pin"
          />

          <ul className="delivery-list" style={{ marginTop: 12 }}>
            {pins.length === 0 ? (
              <li className="delivery-row">
                <p className="pipeline-empty">No pins yet. The void stares back, unmarked.</p>
              </li>
            ) : (
              pins.map((pin, i) => (
                <li key={pin.id} className="delivery-row">
                  <div className="delivery-row-main">
                    <p className="delivery-row-title">
                      #{i + 1} — {pin.comment}
                    </p>
                    <p className="delivery-row-sub">
                      {pin.page_url || "Deliverable"} · {pin.x}%, {pin.y}% ·{" "}
                      {new Date(pin.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <span className={pin.resolved ? "delivery-pill done" : "delivery-pill progress"}>
                    {pin.resolved ? "Resolved" : "Open"}
                  </span>
                  <div className="delivery-actions">
                    <form action={resolveFeedbackPin} className="mini-form">
                      <input type="hidden" name="pin_id" value={pin.id} />
                      <input type="hidden" name="resolved" value={pin.resolved ? "false" : "true"} />
                      <button type="submit" className="mini-button">
                        {pin.resolved ? "Reopen" : "Resolve"}
                      </button>
                    </form>
                    <form action={convertPinToChangeOrder} className="mini-form">
                      <input type="hidden" name="pin_id" value={pin.id} />
                      <button type="submit" className="mini-button danger" title="Turn this feedback into a priced change order">
                        → Change order
                      </button>
                    </form>
                  </div>
                </li>
              ))
            )}
          </ul>
        </>
      ) : null}

      {/* Change orders */}
      <div className="panel-heading" style={{ marginTop: 16 }}>
        <h3>Change orders</h3>
        <span className="pipeline-count">
          {changeOrders.filter((o) => o.status === "proposed").length} proposed
        </span>
      </div>
      <ul className="delivery-list">
        {changeOrders.length === 0 ? (
          <li className="delivery-row">
            <p className="pipeline-empty">None yet. Scope is holding — suspicious, but fine.</p>
          </li>
        ) : (
          changeOrders.map((o) => (
            <li key={o.id} className="delivery-row">
              <div className="delivery-row-main">
                <p className="delivery-row-title">{o.description}</p>
                <p className="delivery-row-sub">
                  {o.fee_impact !== null ? `$${o.fee_impact.toFixed(2)}` : "Fee TBD"}
                  {o.timeline_impact ? ` · ${o.timeline_impact}` : ""}
                  {o.source_pin_id ? " · from feedback pin" : ""}
                </p>
              </div>
              <span className={orderPill(o.status)}>{o.status}</span>
              <div className="delivery-actions">
                {o.status === "draft" ? (
                  <form action={proposeChangeOrder} className="mini-form">
                    <input type="hidden" name="change_order_id" value={o.id} />
                    <button type="submit" className="mini-button go">Propose</button>
                  </form>
                ) : null}
                {o.status === "draft" || o.status === "proposed" ? (
                  <>
                    <form action={decideChangeOrder} className="mini-form">
                      <input type="hidden" name="change_order_id" value={o.id} />
                      <input type="hidden" name="decision" value="approved" />
                      <button type="submit" className="mini-button go">Approve</button>
                    </form>
                    <form action={decideChangeOrder} className="mini-form">
                      <input type="hidden" name="change_order_id" value={o.id} />
                      <input type="hidden" name="decision" value="declined" />
                      <button type="submit" className="mini-button danger">Decline</button>
                    </form>
                  </>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>
      <form action={createChangeOrder} className="delivery-add-form">
        <input type="hidden" name="project_id" value={projectId} />
        <input type="text" name="description" placeholder="Draft a change order…" required maxLength={4000} />
        <input type="number" name="fee_impact" placeholder="$ fee" min={0} step={0.01} style={{ width: 100 }} />
        <input type="text" name="timeline_impact" placeholder="Timeline impact…" maxLength={200} style={{ width: 160 }} />
        <button type="submit" className="mini-button go">Draft</button>
      </form>

      {/* Scope-creep guard */}
      <div className="panel-heading" style={{ marginTop: 16 }}>
        <h3>Scope watch — Muse</h3>
        <span className="pipeline-count">
          {flagged.length > 0 ? `${flagged.length} flagged` : "All clear"}
        </span>
      </div>
      {scopeVerdicts.length === 0 ? (
        <p className="pipeline-empty">No recent client messages or open pins to scan.</p>
      ) : (
        <ul className="delivery-list">
          {scopeVerdicts.map((v) => (
            <li key={v.requestId} className="delivery-row">
              <div className="delivery-row-main">
                <p className="delivery-row-title">
                  “{v.requestText.slice(0, 120)}{v.requestText.length > 120 ? "…" : ""}”
                </p>
                {v.flags.map((f, i) => (
                  <p key={i} className="delivery-row-sub">• {f.detail}</p>
                ))}
              </div>
              <span className={v.inScope ? "delivery-pill done" : "delivery-pill blocked"}>
                {v.inScope ? "In scope" : `Out of scope (${v.confidence})`}
              </span>
              {!v.inScope && v.suggestedChangeOrder ? (
                <form action={createChangeOrder} className="mini-form">
                  <input type="hidden" name="project_id" value={projectId} />
                  <input type="hidden" name="description" value={v.suggestedChangeOrder.description} />
                  <button type="submit" className="mini-button danger" title="Create a draft change order from this flag">
                    Draft change order
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
