/**
 * KERJAKU CENTRAL AI GATEWAY
 *
 * Every AI feature calls `createAiModel(feature)` and receives a normal AI SDK
 * language model. Provider orchestration (Gemini key pool 1-5 round-robin,
 * cooldown, error classification, Lovable AI fallback) happens inside a routing
 * `fetch`, so streaming, tools, structured output and every downstream contract
 * stay exactly as they were.
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { classifyHttpError, classifyThrownError, shouldRetrySameKey, shouldRotate } from "./errors";
import { GEMINI_BASE_URL, geminiRequest, toGeminiModel } from "./providers/gemini";
import {
  lovableApiKey,
  lovableFallbackEnabled,
  lovableModel,
  lovableRequest,
} from "./providers/lovable";
import { getGeminiPool } from "./provider-state";
import type { AiFeature } from "./types";

export const DEFAULT_AI_MODEL = "google/gemini-3.6-flash";

/** Optional per-feature model override; falls back to the shared default. */
const FEATURE_MODEL_ENV: Partial<Record<AiFeature, string>> = {
  CHATBOT: "GEMINI_MODEL_CHATBOT",
  TELEGRAM: "GEMINI_MODEL_TELEGRAM",
  ORDER_BRIEF: "GEMINI_MODEL_BRIEF",
  PROPOSAL: "GEMINI_MODEL_PROPOSAL",
  AI_ASSISTANT: "GEMINI_MODEL_ASSISTANT",
};

export function modelForFeature(feature: AiFeature, explicit?: string): string {
  if (explicit) return explicit;
  const envName = FEATURE_MODEL_ENV[feature];
  const override = envName ? process.env[envName]?.trim() : undefined;
  return override && override.length > 0 ? override : DEFAULT_AI_MODEL;
}

function withModel(body: BodyInit | null | undefined, model: string): BodyInit | null | undefined {
  if (typeof body !== "string") return body;
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (typeof parsed["model"] !== "string") return body;
    return JSON.stringify({ ...parsed, model });
  } catch {
    return body;
  }
}

function log(entry: Record<string, unknown>) {
  // Metadata only — never prompts, customer data, or credentials.
  console.info(`[ai-gateway] ${JSON.stringify(entry)}`);
}

async function peekError(response: Response): Promise<string> {
  try {
    return (await response.clone().text()).slice(0, 400);
  } catch {
    return "";
  }
}

/** Builds the routing fetch used by the OpenAI-compatible provider. */
export function createRoutingFetch(feature: AiFeature, requestId = crypto.randomUUID()) {
  return async function routingFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const baseHeaders = new Headers(init?.headers);
    const requestedModel = (() => {
      if (typeof init?.body !== "string") return DEFAULT_AI_MODEL;
      try {
        const parsed = JSON.parse(init.body) as { model?: unknown };
        return typeof parsed.model === "string" ? parsed.model : DEFAULT_AI_MODEL;
      } catch {
        return DEFAULT_AI_MODEL;
      }
    })();

    const pool = getGeminiPool();
    const order = pool.acquireOrder();
    const started = Date.now();

    for (const { index, key } of order) {
      const target = geminiRequest(url, key, baseHeaders);
      const body = withModel(init?.body, toGeminiModel(requestedModel));
      let attempt = 0;

      // At most 2 attempts on a single key (one short retry for transient errors).
      while (attempt < 2) {
        attempt += 1;
        pool.markAttempt(index);
        try {
          const response = await fetch(target.url, { ...init, headers: target.headers, body });
          if (response.ok) {
            pool.markSuccess(index);
            log({
              requestId,
              feature,
              provider: "gemini",
              keyIndex: index,
              attempt,
              status: response.status,
              latencyMs: Date.now() - started,
              result: "success",
            });
            return response;
          }

          const detail = await peekError(response);
          const errorClass = classifyHttpError(response.status, detail);
          console.error("[ai-gateway-debug]", response.status, detail);
          log({
            requestId,
            feature,
            provider: "gemini",
            keyIndex: index,
            attempt,
            status: response.status,
            errorClass,
            result: "error",
          });

          if (!shouldRotate(errorClass)) {
            // Invalid request: another API key cannot fix it — return as-is.
            return response;
          }
          if (shouldRetrySameKey(errorClass) && attempt < 2) continue;
          pool.markFailure(index, errorClass);
          break;
        } catch (error) {
          const errorClass = classifyThrownError(error);
          log({ requestId, feature, provider: "gemini", keyIndex: index, attempt, errorClass });
          if (shouldRetrySameKey(errorClass) && attempt < 2) continue;
          pool.markFailure(index, errorClass);
          break;
        }
      }
    }

    // All usable Gemini keys failed or none configured -> Lovable AI fallback.
    const fallbackKey = lovableApiKey();
    if (!lovableFallbackEnabled() || !fallbackKey) {
      log({ requestId, feature, result: "unavailable", fallback: false });
      return new Response(
        JSON.stringify({ error: { message: "AI service temporarily unavailable" } }),
        { status: 503, headers: { "content-type": "application/json" } },
      );
    }

    pool.markFallbackUsed();
    const target = lovableRequest(url, fallbackKey, baseHeaders);
    const body = withModel(init?.body, lovableModel(requestedModel));
    try {
      const response = await fetch(target.url, { ...init, headers: target.headers, body });
      log({
        requestId,
        feature,
        provider: "lovable",
        status: response.status,
        fallback: true,
        latencyMs: Date.now() - started,
        result: response.ok ? "success" : "error",
      });
      return response;
    } catch (error) {
      log({
        requestId,
        feature,
        provider: "lovable",
        fallback: true,
        errorClass: classifyThrownError(error),
        result: "error",
      });
      return new Response(
        JSON.stringify({ error: { message: "AI service temporarily unavailable" } }),
        { status: 503, headers: { "content-type": "application/json" } },
      );
    }
  };
}

/**
 * Returns a language model for a feature. Provider/key selection is invisible
 * to the caller — the same OpenAI-compatible contract is preserved.
 */
export function createAiModel(feature: AiFeature, model?: string) {
  const provider = createOpenAICompatible({
    name: "kerjaku-ai",
    baseURL: GEMINI_BASE_URL,
    fetch: createRoutingFetch(feature),
  });
  return provider(modelForFeature(feature, model));
}

/** Secret-free pool diagnostics for admin observability. */
export function aiPoolSnapshot() {
  return getGeminiPool().snapshot();
}

/** True when at least one Gemini key or the Lovable fallback is configured. */
export function isAiConfigured(): boolean {
  return getGeminiPool().configuredCount > 0 || (lovableFallbackEnabled() && !!lovableApiKey());
}
