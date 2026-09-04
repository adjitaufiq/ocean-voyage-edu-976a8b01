/**
 * Data Reverification — server-only.
 *
 * Brings legacy prospects (created before the Contact Data Provenance system)
 * up to the new standard: it infers the origin of each contact channel from
 * data the row already carries, records a source type + evidence URL, checks
 * whether the website actually responds, checks that the social profile looks
 * like a business profile, then refreshes the ICP score and verification
 * status. Nothing is ever deleted — only empty provenance fields are filled,
 * and every run is written to the prospect activity trail.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  contactQuality,
  normalizeDomain,
  scoreProspect,
  VERIFICATION_LABELS,
  type ContactSourceType,
} from "@/lib/admin/prospecting";
import { fetchIcpConfig, logProspectActivity } from "@/lib/prospecting.server";

type Client = SupabaseClient<Database>;

const REVERIFY_COLUMNS =
  "id, business_name, industry, city, website, website_domain, contact_name, contact_title, contact_email, contact_whatsapp, contact_phone, social_media, source, source_detail, research_summary, pain_signals, evidence, verified, verified_at, phone_source, phone_source_url, email_source, email_source_url, website_source, website_source_url, social_source, social_source_url, google_maps_url";

type ReverifyRow = {
  id: string;
  business_name: string;
  website: string | null;
  contact_email: string | null;
  contact_whatsapp: string | null;
  contact_phone: string | null;
  social_media: string | null;
  source: string | null;
  source_detail: string | null;
  phone_source: string | null;
  phone_source_url: string | null;
  email_source: string | null;
  email_source_url: string | null;
  website_source: string | null;
  website_source_url: string | null;
  social_source: string | null;
  social_source_url: string | null;
  google_maps_url: string | null;
  verified: boolean | null;
  [key: string]: unknown;
};

export type ReverifyProspectResult = {
  id: string;
  businessName: string;
  changed: boolean;
  contactScore: number;
  status: string;
  statusLabel: string;
  fitScore: number;
  websiteAlive: boolean | null;
  socialValid: boolean | null;
  notes: string[];
};

export type ReverifyResult = {
  scanned: number;
  updated: number;
  salesReady: number;
  needVerification: number;
  results: ReverifyProspectResult[];
};

function toUrl(value: string | null | undefined): URL | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return url.hostname.includes(".") ? url : null;
  } catch {
    return null;
  }
}

/** Maps a URL host onto the provenance vocabulary. */
function sourceFromUrl(value: string | null | undefined): ContactSourceType | null {
  const url = toUrl(value);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host.includes("instagram.")) return "instagram";
  if (host.includes("linkedin.")) return "linkedin";
  if (host.includes("facebook.") || host.includes("fb.")) return "facebook";
  if (host.includes("google.") && url.pathname.includes("/maps")) return "google_maps";
  if (host.includes("maps.app.goo.gl") || host.includes("goo.gl/maps")) return "google_maps";
  if (host.includes("business.google.")) return "google_business";
  return "official_website";
}

const SOCIAL_HOSTS = ["instagram.", "linkedin.", "facebook.", "fb.", "tiktok.", "x.com", "twitter."];

/** A social handle counts only when it resolves to a real profile URL. */
function socialLooksValid(row: ReverifyRow): boolean | null {
  const raw = (row.social_media ?? "").trim();
  if (!raw) return null;
  const url = toUrl(raw);
  if (!url) return false;
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (!SOCIAL_HOSTS.some((candidate) => host.includes(candidate))) return false;
  // A bare platform homepage is not a business profile.
  return url.pathname.replace(/\/+$/, "").length > 1;
}

/** Live-checks the website. Network failures return false, not an exception. */
async function websiteAlive(website: string | null): Promise<boolean | null> {
  const url = toUrl(website);
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "KerjakuProspectVerifier/1.0" },
    });
    return response.status < 400;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function reverifyRow(
  supabase: Client,
  row: ReverifyRow,
  config: Awaited<ReturnType<typeof fetchIcpConfig>>,
  actor: { userId: string; email?: string | null },
): Promise<ReverifyProspectResult> {
  const notes: string[] = [];
  const update: Record<string, unknown> = {};
  const setIfEmpty = (column: string, current: string | null, value: string | null, note: string) => {
    if ((current ?? "").trim() || !value) return;
    update[column] = value;
    notes.push(note);
  };

  const mapsUrl =
    row.google_maps_url ??
    (sourceFromUrl(row.source_detail) === "google_maps" ? (row.source_detail as string) : null);
  setIfEmpty("google_maps_url", row.google_maps_url, mapsUrl, "Google Maps URL dipulihkan");

  const detailSource = sourceFromUrl(row.source_detail);
  const legacySource: ContactSourceType | null =
    row.source === "google_business" || row.source === "google_search"
      ? "google_business"
      : row.source === "company_website"
        ? "official_website"
        : row.source === "instagram" || row.source === "linkedin" || row.source === "facebook"
          ? (row.source as ContactSourceType)
          : row.source === "manual"
            ? "manual"
            : null;
  const inferred = detailSource ?? legacySource;
  const evidenceUrl = toUrl(row.source_detail) ? (row.source_detail as string) : (mapsUrl ?? null);

  // Website provenance: the website itself is its own evidence.
  const site = toUrl(row.website);
  if (site) {
    setIfEmpty("website_source", row.website_source, "official_website", "Sumber website diisi");
    setIfEmpty("website_source_url", row.website_source_url, site.toString(), "Bukti website diisi");
  }

  // Social provenance derives from the profile URL platform.
  const socialSource = sourceFromUrl(row.social_media);
  if (socialSource && socialSource !== "official_website") {
    setIfEmpty("social_source", row.social_source, socialSource, "Sumber social media diisi");
    setIfEmpty(
      "social_source_url",
      row.social_source_url,
      toUrl(row.social_media)?.toString() ?? null,
      "Bukti social media diisi",
    );
  }

  // Phone/email inherit the discovery origin when nothing better exists.
  const emailDomain = (row.contact_email ?? "").split("@")[1]?.toLowerCase() ?? "";
  const siteDomain = normalizeDomain(row.website) ?? "";
  if (row.contact_email && emailDomain && siteDomain && emailDomain === siteDomain && site) {
    setIfEmpty("email_source", row.email_source, "official_website", "Email cocok domain website");
    setIfEmpty("email_source_url", row.email_source_url, site.toString(), "Bukti email diisi");
  } else if (row.contact_email && inferred) {
    setIfEmpty("email_source", row.email_source, inferred, "Sumber email dari asal penemuan");
    setIfEmpty("email_source_url", row.email_source_url, evidenceUrl, "Bukti email dari asal penemuan");
  }

  if ((row.contact_whatsapp || row.contact_phone) && inferred) {
    setIfEmpty("phone_source", row.phone_source, inferred, "Sumber telepon dari asal penemuan");
    setIfEmpty("phone_source_url", row.phone_source_url, evidenceUrl, "Bukti telepon dari asal penemuan");
  }

  const alive = await websiteAlive(row.website);
  if (alive === false) {
    notes.push("Website tidak merespons — bukti website dianggap lemah");
    update.website_source_url = null;
  }
  const socialValid = socialLooksValid(row);
  if (socialValid === false) {
    notes.push("Social media bukan URL profil bisnis yang valid");
    update.social_source_url = null;
  }

  const merged = { ...row, ...update } as ReverifyRow;
  const quality = contactQuality(merged);
  const scored = scoreProspect(merged as never, config);

  const nowVerified = quality.status === "sales_ready" || quality.status === "qualified";
  if (Boolean(row.verified) !== nowVerified) {
    update.verified = nowVerified;
    update.verified_at = nowVerified ? new Date().toISOString() : null;
    notes.push(nowVerified ? "Status verifikasi diaktifkan" : "Status verifikasi dicabut");
  }
  update.fit_score = scored.total;
  update.fit_tier = scored.tier;
  update.fit_breakdown = scored.factors;

  const { error } = await supabase
    .from("prospects")
    .update(update as never)
    .eq("id", row.id);
  if (error) throw new Error(error.message);

  const changed = notes.length > 0;
  await logProspectActivity(supabase, {
    prospectId: row.id,
    action: "research",
    label: `Reverifikasi data — ${VERIFICATION_LABELS[quality.status]} (kontak ${quality.score}/100, ICP ${scored.total})`,
    content: [
      ...notes,
      alive === null ? "Website: tidak ada" : alive ? "Website: aktif" : "Website: tidak aktif",
      socialValid === null
        ? "Social media: tidak ada"
        : socialValid
          ? "Social media: valid"
          : "Social media: tidak valid",
    ].join("\n"),
    meta: {
      kind: "reverification",
      contact_score: quality.score,
      verification_status: quality.status,
      fit_score: scored.total,
      website_alive: alive,
      social_valid: socialValid,
    },
    userId: actor.userId,
    userEmail: actor.email ?? null,
  });

  return {
    id: row.id,
    businessName: row.business_name,
    changed,
    contactScore: quality.score,
    status: quality.status,
    statusLabel: VERIFICATION_LABELS[quality.status],
    fitScore: scored.total,
    websiteAlive: alive,
    socialValid,
    notes,
  };
}

/**
 * Reverifies one prospect (`ids`) or the whole database (`scope: "all"`).
 * Runs in small batches so a large database does not exhaust the request.
 */
export async function reverifyProspects(
  supabase: Client,
  input: { ids?: string[]; scope?: "one" | "all"; limit?: number },
  actor: { userId: string; email?: string | null },
): Promise<ReverifyResult> {
  const config = await fetchIcpConfig(supabase);

  let query = supabase.from("prospects").select(REVERIFY_COLUMNS).order("created_at", { ascending: true });
  if (input.ids?.length) query = query.in("id", input.ids);
  else query = query.limit(Math.min(input.limit ?? 200, 500));

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as ReverifyRow[];

  const results: ReverifyProspectResult[] = [];
  const BATCH = 5;
  for (let index = 0; index < rows.length; index += BATCH) {
    const batch = rows.slice(index, index + BATCH);
    const settled = await Promise.all(
      batch.map((row) =>
        reverifyRow(supabase, row, config, actor).catch(
          (batchError): ReverifyProspectResult => ({
            id: row.id,
            businessName: row.business_name,
            changed: false,
            contactScore: 0,
            status: "not_ready",
            statusLabel: VERIFICATION_LABELS.not_ready,
            fitScore: 0,
            websiteAlive: null,
            socialValid: null,
            notes: [batchError instanceof Error ? batchError.message : "Gagal reverifikasi"],
          }),
        ),
      ),
    );
    results.push(...settled);
  }

  return {
    scanned: results.length,
    updated: results.filter((result) => result.changed).length,
    salesReady: results.filter((result) => result.status === "sales_ready").length,
    needVerification: results.filter((result) => result.status === "need_verification").length,
    results,
  };
}
