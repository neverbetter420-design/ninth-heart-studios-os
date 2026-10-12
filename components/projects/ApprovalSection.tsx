import {
  decideApproval,
  requestApproval,
} from "@/app/(protected)/(admin)/projects/actions";

type Approval = {
  id: string;
  title: string;
  status: string;
  requested_at: string;
  decided_at: string | null;
  client_comment: string | null;
};

export function ApprovalSection({
  projectId,
  approvals,
}: {
  projectId: string;
  approvals: Approval[];
}) {
  const pending = approvals.filter((a) => a.status === "pending");
  const decided = approvals.filter((a) => a.status !== "pending");

  return (
    <section className="panel" aria-label="Approvals">
      <div className="panel-heading">
        <h3>Approvals</h3>
        <span className="pipeline-count">{pending.length} pending</span>
      </div>
      <ul className="delivery-list">
        {approvals.length === 0 ? (
          <li className="delivery-row">
            <p className="pipeline-empty">Nothing awaiting sign-off. Enjoy it while it lasts.</p>
          </li>
        ) : (
          <>
            {pending.map((a) => (
              <li key={a.id} className="delivery-row">
                <div className="delivery-row-main">
                  <p className="delivery-row-title">{a.title}</p>
                  <p className="delivery-row-sub">
                    Requested {new Date(a.requested_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
                <span className="delivery-pill progress">Pending</span>
                <div className="delivery-actions">
                  <form action={decideApproval} className="mini-form">
                    <input type="hidden" name="approval_id" value={a.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <button type="submit" className="mini-button go">Approve</button>
                  </form>
                  <form action={decideApproval} className="mini-form">
                    <input type="hidden" name="approval_id" value={a.id} />
                    <input type="hidden" name="decision" value="declined" />
                    <button type="submit" className="mini-button danger">Changes</button>
                  </form>
                </div>
              </li>
            ))}
            {decided.map((a) => (
              <li key={a.id} className="delivery-row">
                <div className="delivery-row-main">
                  <p className="delivery-row-title">{a.title}</p>
                  {a.client_comment ? (
                    <p className="delivery-row-sub">“{a.client_comment}”</p>
                  ) : null}
                </div>
                <span className={a.status === "approved" ? "delivery-pill done" : "delivery-pill blocked"}>
                  {a.status === "approved" ? "Approved" : "Changes requested"}
                </span>
              </li>
            ))}
          </>
        )}
      </ul>
      <form action={requestApproval} className="delivery-add-form">
        <input type="hidden" name="project_id" value={projectId} />
        <input type="text" name="title" placeholder="Request approval for…" required maxLength={160} />
        <button type="submit" className="mini-button go">Request</button>
      </form>
    </section>
  );
}
