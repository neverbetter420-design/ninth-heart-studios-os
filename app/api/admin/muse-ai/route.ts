import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createMuseReader } from "@/lib/muse-ai-tools";
import { ALLOWED_MODELS, boundedText, runMuseConversation, safePage, type ModelResponse } from "@/lib/muse-ai-runner";
import { checkMuseRateLimit } from "@/lib/muse-ai-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const error = (message: string, status: number, extra: Record<string, string> = {}) =>
  NextResponse.json({ error: message }, { status, headers: { ...HEADERS, ...extra } });

export async function POST(request: NextRequest) {
  // Independent route authorization, before any provider or business-data access.
  const auth = await getCurrentAuth();
  if (!auth.user) return error("Sign in to use Muse AI.", 401);
  if (!auth.profile?.active || auth.profile.role !== "admin") return error("Admin access required.", 403);
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return error("Invalid request origin.", 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return error("Send a JSON request.", 415);
  if (Number(request.headers.get("content-length") || 0) > 12000) return error("Request too large.", 413);

  let payload: Record<string, unknown>;
  try {
    const raw = await boundedText(request.body, 12000);
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid_body");
    payload = body as Record<string, unknown>;
  } catch (cause) {
    return cause instanceof Error && cause.message === "body_too_large" ? error("Request too large.", 413) : error("Invalid request body.", 400);
  }
  const question = typeof payload.question === "string" ? payload.question.trim() : "";
  if (question.length < 2 || question.length > 1000) return error("Ask a question between 2 and 1,000 characters.", 400);
  if (process.env.MUSE_AI_ENABLED !== "true") return error("Muse AI is in private preview and has not been enabled yet.", 503);
  const key = process.env.OPENAI_API_KEY;
  if (!key) return error("Muse AI is not configured yet.", 503);
  const model = process.env.OPENAI_MUSE_MODEL || "gpt-6.1-sol";
  if (!ALLOWED_MODELS.includes(model)) return error("Muse model configuration is invalid.", 503);
  const limit = await checkMuseRateLimit(auth.user.id);
  if (limit === "limited") return error("Muse needs a short breather. Try again in a minute.", 429, { "Retry-After": "60" });
  if (limit !== "allowed") return error("Muse request controls are unavailable. Please try again later.", 503);

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(45000)]);
  const page = safePage(payload.page), now = new Date().toISOString();
  try {
    const read = createMuseReader(await createClient(), { page, now, signal });
    const answer = await runMuseConversation({ question, history: payload.history, page, now, model, read,
      ask: async body => {
        signal.throwIfAborted();
        const result = await fetch("https://api.openai.com/v1/responses", {
          method: "POST", cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!result.ok) { await result.body?.cancel(); throw new Error("model_unavailable"); }
        return JSON.parse(await boundedText(result.body, 128000)) as ModelResponse;
      },
    });
    return NextResponse.json(answer, { headers: HEADERS });
  } catch {
    // No credentials, upstream headers, client records or stack traces in errors.
    return error("Muse couldn't complete this answer. Try a smaller question.", 502);
  }
}
