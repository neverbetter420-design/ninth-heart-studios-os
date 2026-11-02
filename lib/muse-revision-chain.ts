import { parseMuseProjectPlan, type MuseProjectPlan } from "./muse-project-guide.ts";

type RevisionSnapshot = { revision: number; plan: unknown };

/**
 * Fail closed before reopening a saved Muse draft. A latest matching snapshot
 * alone is not enough: every immutable revision must be present and parseable.
 * Rows must be fetched for the exact owner/plan, newest revision first.
 *
 * Pure validation only. No database writes, AI calls, or external requests.
 */
export function assertMuseRevisionChain(
  rows: readonly RevisionSnapshot[],
  currentRevision: number,
  savedPlan: MuseProjectPlan,
): void {
  if (!Array.isArray(rows) || !Number.isSafeInteger(currentRevision) ||
      currentRevision < 1 || currentRevision > 25 ||
      rows.length !== currentRevision) {
    throw new Error("incomplete_muse_history");
  }

  const current = parseMuseProjectPlan(savedPlan);
  for (let index = 0; index < rows.length; index++) {
    const entry = rows[index];
    if (!entry || entry.revision !== currentRevision - index) {
      throw new Error("noncontiguous_muse_history");
    }
    const historical = parseMuseProjectPlan(entry.plan);
    if (index === 0 && JSON.stringify(historical) !== JSON.stringify(current)) {
      throw new Error("muse_history_latest_mismatch");
    }
  }
}
