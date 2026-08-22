/**
 * Gemini provider adapter (OpenAI-compatible endpoint).
 * Keys are read server-side only and never leave this module.
 */
import { endpointPath } from "./path";

export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

/** Maps a gateway model id ("google/gemini-3.6-flash") to a native Gemini model id. */
export function toGeminiModel(modelId: string): string {
  const override = process.env["GEMINI_MODEL_DEFAULT"]?.trim();
  if (override) return override;
  return modelId.replace(/^google\//, "");
}

export function geminiRequest(url: string, apiKey: string, headers: Headers) {
  const next = new Headers(headers);
  next.delete("Lovable-API-Key");
  next.set("Authorization", `Bearer ${apiKey}`);
  return { url: `${GEMINI_BASE_URL}${endpointPath(url)}`, headers: next };
}

/**
 * Gemini's OpenAI-compatible endpoint rejects tool-call history that has no
 * `thought_signature` ("Function call is missing a thought_signature ..."),
 * which breaks the second step of every tool loop (400 REQUEST_INVALID).
 * The AI SDK cannot produce that signature, so we flatten the tool round-trip
 * into plain text before sending: the model still sees the call and its result,
 * and the continuation streams normally.
 */
export function sanitizeGeminiToolHistory(
  body: BodyInit | null | undefined,
): BodyInit | null | undefined {
  if (typeof body !== "string") return body;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return body;
  }
  const messages = parsed["messages"];
  if (!Array.isArray(messages)) return body;
  if (!messages.some((m) => isRecord(m) && (m["role"] === "tool" || Array.isArray(m["tool_calls"])))) {
    return body;
  }

  const names = new Map<string, string>();
  const next: unknown[] = [];
  for (const message of messages) {
    if (!isRecord(message)) {
      next.push(message);
      continue;
    }
    const role = message["role"];
    if (role === "assistant" && Array.isArray(message["tool_calls"])) {
      const lines: string[] = [];
      for (const call of message["tool_calls"]) {
        if (!isRecord(call)) continue;
        const fn = isRecord(call["function"]) ? call["function"] : null;
        const name = typeof fn?.["name"] === "string" ? fn["name"] : "tool";
        const args = typeof fn?.["arguments"] === "string" ? fn["arguments"] : "{}";
        if (typeof call["id"] === "string") names.set(call["id"], name);
        lines.push(`[tool ${name} dipanggil dengan argumen: ${args}]`);
      }
      const text = typeof message["content"] === "string" ? message["content"] : "";
      next.push({ role: "assistant", content: [text, ...lines].filter(Boolean).join("\n") });
      continue;
    }
    if (role === "tool") {
      const id = typeof message["tool_call_id"] === "string" ? message["tool_call_id"] : "";
      const name = names.get(id) ?? "tool";
      const content =
        typeof message["content"] === "string"
          ? message["content"]
          : JSON.stringify(message["content"] ?? {});
      next.push({
        role: "user",
        content: `[hasil tool ${name} — sudah berhasil dijalankan, JANGAN panggil tool ini lagi]\n${content}`,
      });
      continue;
    }
    next.push(message);
  }

  return JSON.stringify({ ...parsed, messages: next });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
