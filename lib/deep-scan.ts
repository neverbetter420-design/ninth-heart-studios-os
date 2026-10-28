import type { DiscoveredBusiness } from "./prospect-scan.ts";

export const DEEP_SCAN_SIZES = [12, 25, 50, 100] as const;
export const DEEP_SCAN_BATCH_SIZE = 6;

export function validDeepSize(input: unknown): input is (typeof DEEP_SCAN_SIZES)[number] {
  return typeof input === "number" && DEEP_SCAN_SIZES.some(size => size === input);
}

/** A fixed slice of stored candidates is safe to retry after a lease expires.
 * Database leasing makes only one attempt active at once.
 */
export function nextDeepScanBatch(
  candidates: DiscoveredBusiness[], position: number,
): DiscoveredBusiness[] {
  if (!Array.isArray(candidates) || candidates.length > 100 ||
    !Number.isInteger(position) || position < 0 || position > candidates.length) {
    throw new Error("Invalid saved Deep Scan position or candidate pool");
  }
  return candidates.slice(position, position + DEEP_SCAN_BATCH_SIZE);
}

export function deepScanPercent(processed: number, total: number): number {
  if (!Number.isFinite(processed) || !Number.isInteger(total) || total < 1) return 0;
  return Math.round(Math.min(total, Math.max(0, processed)) / total * 100);
}

export function expiredDeepLease(status: string, leaseUntil: string | null, nowMs: number): boolean {
  if (status !== "running" || !leaseUntil || !Number.isFinite(nowMs)) return false;
  const expiresAt = Date.parse(leaseUntil);
  return Number.isFinite(expiresAt) && expiresAt < nowMs;
}
