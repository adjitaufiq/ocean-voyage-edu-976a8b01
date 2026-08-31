/**
 * First-party acquisition attribution (privacy-conscious).
 *
 * - First touch is stored once in localStorage and never overwritten.
 * - Last touch is refreshed per session in sessionStorage.
 * - The visitor id is a random first-party id, not a fingerprint. No IP, no
 *   personal data, no cross-site identifiers are collected.
 *
 * Fully SSR-safe: every accessor no-ops on the server.
 */

export type AcquisitionChannel =
  | "Google Organic"
  | "Bing Organic"
  | "ChatGPT"
  | "Other AI Referral"
  | "Direct"
  | "Social"
  | "Referral"
  | "Campaign"
  | "Unknown";

export type TouchPoint = {
  channel: AcquisitionChannel;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  referrer: string;
  page: string;
  at: string;
};

export type AttributionPayload = {
  visitorId: string;
  firstTouch: TouchPoint;
  lastTouch: TouchPoint;
  firstContentPath: string;
  firstContentTitle: string;
};

const FIRST_KEY = "kerjaku_attr_first_v1";
const LAST_KEY = "kerjaku_attr_last_v1";
const VISITOR_KEY = "kerjaku_visitor_id";
const CONTENT_KEY = "kerjaku_attr_content_v1";

const AI_HOSTS: { match: RegExp; channel: AcquisitionChannel; source: string }[] = [
  { match: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/, channel: "ChatGPT", source: "chatgpt" },
  { match: /(^|\.)perplexity\.ai$/, channel: "Other AI Referral", source: "perplexity" },
  { match: /(^|\.)copilot\.microsoft\.com$/, channel: "Other AI Referral", source: "copilot" },
  { match: /(^|\.)gemini\.google\.com$/, channel: "Other AI Referral", source: "gemini" },
  { match: /(^|\.)claude\.ai$/, channel: "Other AI Referral", source: "claude" },
  { match: /(^|\.)you\.com$/, channel: "Other AI Referral", source: "you.com" },
  { match: /(^|\.)grok\.com$|(^|\.)x\.ai$/, channel: "Other AI Referral", source: "grok" },
];

const SOCIAL = /(facebook|instagram|linkedin|twitter|x\.com|tiktok|threads|youtube|whatsapp|t\.co)/;

const CONTENT_PREFIXES = ["/insight", "/build", "/products", "/portfolio", "/jasa", "/cara-"];

function hostOf(referrer: string): string {
  try {
    return new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Classify a visit. Never guesses when there is no observable signal. */
export function classify(
  utm: { source: string; medium: string },
  referrer: string,
  currentHost: string,
): { channel: AcquisitionChannel; source: string } {
  const host = hostOf(referrer);

  if (host && host === currentHost.replace(/^www\./, "")) {
    // Internal navigation carries no acquisition signal of its own.
    if (utm.source) return { channel: "Campaign", source: utm.source };
    return { channel: "Unknown", source: "" };
  }

  for (const ai of AI_HOSTS) {
    if (ai.match.test(host)) return { channel: ai.channel, source: ai.source };
  }
  if (/^(chatgpt|openai|perplexity|copilot|gemini|claude|bard)/i.test(utm.source)) {
    return { channel: utm.source.toLowerCase().startsWith("chatgpt") ? "ChatGPT" : "Other AI Referral", source: utm.source };
  }

  if (host) {
    if (/(^|\.)google\./.test(host)) {
      return {
        channel: /cpc|paid|ppc/i.test(utm.medium) ? "Campaign" : "Google Organic",
        source: utm.source || "google",
      };
    }
    if (/(^|\.)bing\./.test(host)) return { channel: "Bing Organic", source: utm.source || "bing" };
    if (SOCIAL.test(host)) return { channel: "Social", source: utm.source || host };
    if (utm.source) return { channel: "Campaign", source: utm.source };
    return { channel: "Referral", source: host };
  }

  if (utm.source) return { channel: "Campaign", source: utm.source };
  return { channel: "Direct", source: "direct" };
}

function readJson<T>(storage: Storage | undefined, key: string): T | null {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(storage: Storage | undefined, key: string, value: unknown) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — attribution is best-effort */
  }
}

function currentTouch(path: string): TouchPoint {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source") ?? "";
  const utmMedium = params.get("utm_medium") ?? "";
  const referrer = document.referrer ?? "";
  const { channel, source } = classify(
    { source: utmSource, medium: utmMedium },
    referrer,
    window.location.hostname,
  );
  return {
    channel,
    source,
    medium: utmMedium,
    campaign: params.get("utm_campaign") ?? "",
    content: params.get("utm_content") ?? "",
    term: params.get("utm_term") ?? "",
    referrer: referrer.slice(0, 500),
    page: path,
    at: new Date().toISOString(),
  };
}

export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `v-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return "";
  }
}

/** Initialise attribution on first render. Safe to call repeatedly. */
export function initAttribution(path: string) {
  if (typeof window === "undefined") return;
  getVisitorId();
  const touch = currentTouch(path);

  const first = readJson<TouchPoint>(window.localStorage, FIRST_KEY);
  if (!first) writeJson(window.localStorage, FIRST_KEY, touch);

  // Last touch only updates when this visit carries a real external signal.
  if (touch.channel !== "Unknown") writeJson(window.sessionStorage, LAST_KEY, touch);
  trackAttributionPage(path);
}

/** Remember the first meaningful content page the visitor read. */
export function trackAttributionPage(path: string) {
  if (typeof window === "undefined") return;
  const existing = readJson<{ path: string; title: string }>(window.sessionStorage, CONTENT_KEY);
  if (existing) return;
  if (!CONTENT_PREFIXES.some((prefix) => path.startsWith(prefix))) return;
  writeJson(window.sessionStorage, CONTENT_KEY, {
    path,
    title: (document.title ?? "").split("|")[0]?.trim().slice(0, 160) ?? "",
  });
}

/** Snapshot attached to leads and events. */
export function getAttribution(): AttributionPayload {
  const fallback: TouchPoint = {
    channel: "Unknown",
    source: "",
    medium: "",
    campaign: "",
    content: "",
    term: "",
    referrer: "",
    page: "",
    at: new Date().toISOString(),
  };
  if (typeof window === "undefined") {
    return {
      visitorId: "",
      firstTouch: fallback,
      lastTouch: fallback,
      firstContentPath: "",
      firstContentTitle: "",
    };
  }
  const first = readJson<TouchPoint>(window.localStorage, FIRST_KEY) ?? fallback;
  const last = readJson<TouchPoint>(window.sessionStorage, LAST_KEY) ?? first;
  const content = readJson<{ path: string; title: string }>(window.sessionStorage, CONTENT_KEY);
  return {
    visitorId: getVisitorId(),
    firstTouch: first,
    lastTouch: last,
    firstContentPath: content?.path ?? "",
    firstContentTitle: content?.title ?? "",
  };
}
