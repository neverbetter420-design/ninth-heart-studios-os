import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { boundedText } from "./muse-ai-runner";
import { FREE_MUSE_MODEL } from "./muse-cloudflare-free";

export async function getFreeMuseProvider(signal: AbortSignal) {
  // This release is ONLY for a verified Workers Free account. Cloudflare enforces
  // its account-wide daily neuron cutoff. This flag is an activation attestation,
  // not an automatic billing-plan detector; remove it before changing plans.
  if (process.env.MUSE_CF_FREE_PLAN_CONFIRMED !== "true") throw new Error("free_plan_unverified");
  const { env } = await getCloudflareContext({ async: true });
  const ai: unknown = Reflect.get(env, "MUSE_AI");
  if (!ai || typeof ai !== "object" || !("run" in ai) || typeof ai.run !== "function") throw new Error("free_binding_unavailable");
  const run = ai.run.bind(ai);
  return async (body: Record<string, unknown>): Promise<unknown> => {
    signal.throwIfAborted();
    const result: unknown = await run(FREE_MUSE_MODEL, body, {
      returnRawResponse: true, signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
    });
    if (!(result instanceof Response)) throw new Error("free_model_unavailable");
    if (!result.ok) {
      await result.body?.cancel();
      throw new Error(result.status === 429 ? "free_allowance_unavailable" : "free_model_unavailable");
    }
    const raw: unknown = JSON.parse(await boundedText(result.body, 64000));
    if (!raw || typeof raw !== "object") throw new Error("free_model_invalid");
    if ("success" in raw && raw.success !== true) throw new Error("free_model_unavailable");
    return "result" in raw ? raw.result : raw;
  };
}
