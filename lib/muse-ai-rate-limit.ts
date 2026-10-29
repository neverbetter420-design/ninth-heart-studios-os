import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Fail closed outside Workers or when the binding is missing/unavailable.
// No isolate-local counters: they cannot enforce an owner limit across workers.
export async function checkMuseRateLimit(ownerId: string): Promise<"allowed" | "limited" | "unavailable"> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const binding: unknown = Reflect.get(env, "MUSE_AI_RATE_LIMITER");
    if (!binding || typeof binding !== "object" || !("limit" in binding) || typeof binding.limit !== "function") return "unavailable";
    const result: unknown = await binding.limit({ key: `muse-owner:${ownerId}` });
    if (!result || typeof result !== "object" || !("success" in result) || typeof result.success !== "boolean") return "unavailable";
    return result.success ? "allowed" : "limited";
  } catch { return "unavailable"; }
}
