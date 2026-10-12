import {
  createLaunchItem,
  deleteLaunchItem,
  toggleLaunchItem,
} from "@/app/(protected)/(admin)/projects/actions";
import { launchItemKindLabel } from "@/lib/delivery";
import type { LaunchItem } from "@/lib/supabase/types";

const KIND_ORDER: LaunchItem["kind"][] = ["payment", "checklist", "followup"];

export function LaunchGateSection({
  projectId,
  items,
}: {
  projectId: string;
  items: LaunchItem[];
}) {
  const done = items.filter((i) => i.done).length;
  return (
    <section className="panel" aria-label="Launch gates">
      <div className="panel-heading">
        <h3>Launch Gates</h3>
        <span className="pipeline-count">{done}/{items.length} cleared</span>
      </div>
      <ul className="delivery-list">
        {items.length === 0 ? (
          <li className="delivery-row">
            <p className="pipeline-empty">No gates defined. Launches love checklists, trust me.</p>
          </li>
        ) : (
          KIND_ORDER.map((kind) => {
            const group = items.filter((i) => i.kind === kind);
            if (group.length === 0) return null;
            return (
              <li key={kind} style={{ padding: 0, borderBottom: 0, display: "block" }}>
                <p
                  className="delivery-row-sub"
                  style={{ padding: "10px 4px 2px", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 9 }}
                >
                  {launchItemKindLabel(kind)}s
                </p>
                <ul className="delivery-list" style={{ padding: 0 }}>
                  {group.map((item) => (
                    <li key={item.id} className="delivery-row">
                      <div className="delivery-row-main">
                        <p
                          className="delivery-row-title"
                          style={item.done ? { textDecoration: "line-through", opacity: 0.55 } : undefined}
                        >
                          {item.label}
                        </p>
                        {item.due_at ? (
                          <p className="delivery-row-sub">
                            Due {new Date(item.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        ) : null}
                      </div>
                      <div className="delivery-actions">
                        <form action={toggleLaunchItem}>
                          <input type="hidden" name="launch_item_id" value={item.id} />
                          <button type="submit" className={`mini-button${item.done ? "" : " go"}`}>
                            {item.done ? "Reopen" : "Clear"}
                          </button>
                        </form>
                        <form action={deleteLaunchItem}>
                          <input type="hidden" name="launch_item_id" value={item.id} />
                          <button type="submit" className="mini-button danger" aria-label={`Delete ${item.label}`}>✕</button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })
        )}
      </ul>
      <form action={createLaunchItem} className="delivery-add-form">
        <input type="hidden" name="project_id" value={projectId} />
        <input type="text" name="label" placeholder="New gate…" required maxLength={160} />
        <select name="kind" defaultValue="checklist" aria-label="Gate kind">
          <option value="payment">Payment gate</option>
          <option value="checklist">Checklist</option>
          <option value="followup">Follow-up</option>
        </select>
        <input type="date" name="due_at" aria-label="Gate due date" />
        <button type="submit" className="mini-button go">Add</button>
      </form>
    </section>
  );
}
