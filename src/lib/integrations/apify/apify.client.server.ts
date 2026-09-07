/**
 * Apify client — SERVER ONLY.
 *
 * The API token never leaves the server: it is read from process.env inside
 * the call, never bundled, never stored in the database, never accepted from
 * a client request.
 *
 * Two transports are supported:
 *  - Direct API  : APIFY_API_TOKEN            -> https://api.apify.com/v2
 *  - Lovable gw  : APIFY_API_KEY + LOVABLE_API_KEY -> connector gateway
 */

const DIRECT_BASE = "https://api.apify.com/v2";
const GATEWAY_BASE = "https://connector-gateway.lovable.dev/apify";

export type ApifyRunStatus = "succeeded" | "failed" | "timeout";

export type ApifyRunResult = {
  runId: string | null;
  datasetId: string | null;
  status: ApifyRunStatus;
  items: Record<string, unknown>[];
  durationMs: number;
  error?: string;
};

export class ApifyConfigError extends Error {}
export class ApifyAuthError extends Error {}
export class ApifyTimeoutError extends Error {}

type Transport = {
  base: string;
  headers: Record<string, string>;
};

export function resolveApifyTransport(env: NodeJS.ProcessEnv = process.env): Transport {
  const token = env["APIFY_API_TOKEN"];
  if (token) {
    return { base: DIRECT_BASE, headers: { Authorization: `Bearer ${token}` } };
  }
  const connectionKey = env["APIFY_API_KEY"];
  const lovableKey = env["LOVABLE_API_KEY"];
  if (connectionKey && lovableKey) {
    return {
      base: GATEWAY_BASE,
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectionKey,
      },
    };
  }
  throw new ApifyConfigError(
    "Apify belum dikonfigurasi. Set APIFY_API_TOKEN (server-side) atau hubungkan konektor Apify.",
  );
}

export function apifyActorId(
  key: "googleMaps" | "website" | "social",
  env: NodeJS.ProcessEnv = process.env,
): string {
  const map = {
    googleMaps: [env["APIFY_DEFAULT_ACTOR_GOOGLE_MAPS"], "compass~crawler-google-places"],
    website: [env["APIFY_DEFAULT_ACTOR_WEBSITE_SCRAPER"], "apify~website-content-crawler"],
    social: [env["APIFY_DEFAULT_ACTOR_SOCIAL_SCRAPER"], "apify~instagram-profile-scraper"],
  } as const;
  const [configured, fallback] = map[key];
  return (configured && configured.trim()) || fallback;
}

export type RunApifyActorOptions = {
  actorId: string;
  input: Record<string, unknown>;
  /** Hard limit for the whole run, including polling. */
  timeoutMs?: number;
  maxRetries?: number;
  maxItems?: number;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
};

function normalizeError(status: number, body: string): Error {
  if (status === 401 || status === 403) {
    return new ApifyAuthError(`Apify menolak kredensial [${status}]: ${body.slice(0, 300)}`);
  }
  return new Error(`Apify request gagal [${status}]: ${body.slice(0, 300)}`);
}

/**
 * Runs an actor synchronously and returns its dataset items.
 * Never throws for provider-side failures that we can classify — it returns a
 * failed/timeout result so the caller can persist an honest failure instead of
 * inventing data.
 */
export async function runApifyActor(options: RunApifyActorOptions): Promise<ApifyRunResult> {
  const {
    actorId,
    input,
    timeoutMs = 90_000,
    maxRetries = 1,
    maxItems = 5,
    fetchImpl = fetch,
    env = process.env,
  } = options;

  const transport = resolveApifyTransport(env);
  const started = Date.now();
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(
        `${transport.base}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?limit=${maxItems}`,
        {
          method: "POST",
          headers: { ...transport.headers, "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const error = normalizeError(response.status, body);
        // Auth and client errors never recover on retry.
        if (error instanceof ApifyAuthError || (response.status >= 400 && response.status < 500)) {
          throw error;
        }
        lastError = error;
        continue;
      }

      const payload = (await response.json().catch(() => [])) as unknown;
      const items = Array.isArray(payload)
        ? (payload as Record<string, unknown>[])
        : Array.isArray((payload as { items?: unknown[] })?.items)
          ? ((payload as { items: Record<string, unknown>[] }).items)
          : [];

      return {
        runId: response.headers.get("x-apify-run-id"),
        datasetId: response.headers.get("x-apify-dataset-id"),
        status: "succeeded",
        items,
        durationMs: Date.now() - started,
      };
    } catch (error) {
      if (error instanceof ApifyAuthError) throw error;
      const aborted = error instanceof Error && error.name === "AbortError";
      if (aborted && attempt >= maxRetries) {
        return {
          runId: null,
          datasetId: null,
          status: "timeout",
          items: [],
          durationMs: Date.now() - started,
          error: `Apify timeout setelah ${timeoutMs} ms`,
        };
      }
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    runId: null,
    datasetId: null,
    status: "failed",
    items: [],
    durationMs: Date.now() - started,
    error: lastError instanceof Error ? lastError.message : "Apify gagal tanpa detail",
  };
}
