import { PinComposer, type FramePin } from "./FeedbackFrame";
import type { ChangeOrder, FeedbackPin, RevisionRound } from "@/lib/supabase/types";

/**
 * PortalRevisionSection — the client-facing slice of revision control.
 * Read-only tracker ("Round 2 of 3 included"), the visual feedback canvas
 * for the open round, and the client's change-order statuses. Clients can
 * drop pins; everything else is admin territory.
 */
export function PortalRevisionSection({
  projectId,
  rounds,
  activeRound,
  pins,
  changeOrders,
  addPinAction,
}: {
  projectId: string;
  rounds: RevisionRound[];
  activeRound: RevisionRound | null;
  pins: FeedbackPin[];
  changeOrders: ChangeOrder[];
  addPinAction: (formData: FormData) => void | Promise<unknown>;
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

  return (
    <article className="panel detail-panel" aria-label="Revision rounds">
      <h3>Revision rounds</h3>
      {rounds.length === 0 ? (
        <p className="muted-copy">Revision tracking hasn&apos;t started on this project yet.</p>
      ) : (
        <>
          <div className="simple-row">
            <strong>
              {openRound
                ? `Round ${openRound.round_number} of ${openRound.included_rounds} included`
                : "All rounds closed"}
            </strong>
            <span>{openRound ? "Open" : "Done"}</span>
          </div>
          {rounds.length > 1 ? (
            <p className="muted-copy" style={{ marginTop: 4 }}>
              {rounds.filter((r) => r.status === "closed").length} earlier round
              {rounds.filter((r) => r.status === "closed").length === 1 ? "" : "s"} closed.
            </p>
          ) : null}
        </>
      )}

      {activeRound && openRound ? (
        <div style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 8 }}>Pin feedback on the work</h3>
          <PinComposer
            roundId={activeRound.id}
            hiddenFields={[{ name: "project_id", value: projectId }]}
            addPinAction={addPinAction}
            pins={framePins}
            ctaLabel="Drop pin"
          />
          {pins.length > 0 ? (
            <div style={{ marginTop: 10 }}>
              {pins.map((pin, i) => (
                <div className="simple-row" key={pin.id}>
                  <strong>
                    #{i + 1} — {pin.comment}
                  </strong>
                  <span>{pin.resolved ? "Resolved" : "Open"}</span>
                </div>
              ))}
            </div>
          ) : null}
          {openPins.length === 0 && pins.length > 0 ? (
            <p className="muted-copy" style={{ marginTop: 6 }}>
              Everything&apos;s resolved. Suspiciously agreeable — take the win.
            </p>
          ) : null}
        </div>
      ) : null}

      {changeOrders.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 8 }}>Change orders</h3>
          {changeOrders.map((o) => (
            <div className="simple-row" key={o.id}>
              <strong>{o.description.slice(0, 80)}{o.description.length > 80 ? "…" : ""}</strong>
              <span>
                {o.status === "proposed" ? "Awaiting your decision" : o.status}
                {o.fee_impact !== null ? ` · $${o.fee_impact.toFixed(2)}` : ""}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
