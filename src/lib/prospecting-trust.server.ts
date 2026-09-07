/**
 * Trust Score Engine + Entity Resolution — server-only.
 *
 * One trust number per prospect (ICP fit, validation, AI quality, external
 * evidence) plus fuzzy duplicate detection that never merges automatically.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { parseQualityGate } from "@/lib/admin/prospecting";
import {
  computeTrust,
  domainOf,
  scoreEntityMatch,
  type EntityFacts,
  type EntityMatchRow,
  type MatchStatus,
  type TrustBreakdown,
} from "@/lib/admin/trust";
import { normalizeBusinessName } from "@/lib/business-name";

type Client = SupabaseClient<Database>;

const TRUST_COLUMNS =
  "id, business_name, business_name_normalized, city, website, website_domain, contact_email, contact_phone, contact_whatsapp, google_maps_url, phone_source, email_source, website_source, verified, fit_score, validation_score, quality_gate, trust_score, trust_tier";

type TrustRow = {
  id: string;
  business_name: string;
  business_name_normalized: string | null;
  city: string | null;
  website: string | null;
  website_domain: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  google_maps_url: string | null;
  phone_source: string | null;
  email_source: string | null;
  website_source: string | null;
  verified: boolean;
  fit_score: number;
  validation_score: number;
  quality_gate: unknown;
};

/** External verification score derived from provable, non-AI evidence only. */
export function externalScore(row: TrustRow): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (row.google_maps_url) {
    score += 45;
    reasons.push("Google Maps verified");
  }
  if (row.phone_source) {
    score += 20;
    reasons.push("Nomor telepon bersumber");
  }
  if (row.website_source && row.website) {
    score += 15;
    reasons.push("Website active");
  }
  if (row.email_source) {
    score += 10;
    reasons.push("Email bersumber");
  }
  if (row.verified) {
    score += 10;
    reasons.push("Diverifikasi manusia");
  }
  return { score: Math.min(100, score), reasons };
}

function trustFor(row: TrustRow): TrustBreakdown {
  const external = externalScore(row);
  const gate = parseQualityGate(row.quality_gate);
  return computeTrust({
    fitScore: row.fit_score,
    validationScore: row.validation_score,
    qualityScore: gate?.score ?? 0,
    externalScore: external.score,
    reasons: external.reasons,
  });
}

export type TrustRecomputeResult = {
  scanned: number;
  updated: number;
  verified: number;
  trusted: number;
};

export async function recomputeTrust(
  supabase: Client,
  options: { scope: "one" | "all"; id?: string },
): Promise<TrustRecomputeResult> {
  let query = supabase.from("prospects").select(TRUST_COLUMNS).limit(1000);
  if (options.scope === "one" && options.id) query = query.eq("id", options.id);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as TrustRow[];
  let updated = 0;
  let verified = 0;
  let trusted = 0;

  for (const row of rows) {
    const breakdown = trustFor(row);
    if (breakdown.tier === "verified") verified += 1;
    if (breakdown.tier === "trusted") trusted += 1;
    const { error: updateError } = await supabase
      .from("prospects")
      .update({
        trust_score: breakdown.trust_score,
        trust_tier: breakdown.tier,
        trust_breakdown: breakdown as unknown as Record<string, unknown>,
        trust_computed_at: breakdown.computed_at,
      } as never)
      .eq("id", row.id);
    if (!updateError) updated += 1;
  }

  return { scanned: rows.length, updated, verified, trusted };
}

/* ------------------------------------------------------- entity resolution */

function factsOf(row: TrustRow): EntityFacts {
  return {
    id: row.id,
    nameNormalized: row.business_name_normalized ?? normalizeBusinessName(row.business_name),
    websiteDomain: row.website_domain ?? domainOf(row.website),
    phone: row.contact_phone ?? row.contact_whatsapp,
    email: row.contact_email,
    city: row.city,
    placeId: row.google_maps_url,
  };
}

export type EntityResolutionResult = {
  compared: number;
  flagged: number;
  needsReview: number;
};

export async function runEntityResolution(
  supabase: Client,
  actor: { userId: string | null },
): Promise<EntityResolutionResult> {
  const { data, error } = await supabase
    .from("prospects")
    .select(TRUST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as TrustRow[];
  const facts = rows.map(factsOf);
  const pending: {
    entity_kind: string;
    prospect_a: string;
    prospect_b: string;
    similarity_score: number;
    match_reason: string[];
    status: MatchStatus;
  }[] = [];

  let flagged = 0;
  let needsReview = 0;
  let compared = 0;

  for (let i = 0; i < facts.length; i += 1) {
    for (let j = i + 1; j < facts.length; j += 1) {
      const a = facts[i]!;
      const b = facts[j]!;
      compared += 1;
      const verdict = scoreEntityMatch(a, b);
      if (!verdict.status) continue;
      if (verdict.status === "flagged") flagged += 1;
      else needsReview += 1;
      const [left, right] = [a.id, b.id].sort() as [string, string];
      pending.push({
        entity_kind: "prospect",
        prospect_a: left,
        prospect_b: right,
        similarity_score: verdict.score,
        match_reason: verdict.reasons,
        status: verdict.status,
      });
    }
  }

  if (pending.length > 0) {
    // Never overwrite a human review verdict: ignore conflicts on the pair index.
    await supabase
      .from("entity_match_candidates")
      .upsert(pending as never, {
        onConflict: "entity_kind,prospect_a,prospect_b",
        ignoreDuplicates: true,
      });
  }
  void actor;

  return { compared, flagged, needsReview };
}

export type EntityMatchListRow = EntityMatchRow & {
  business_a: string | null;
  business_b: string | null;
};

export async function fetchEntityMatches(
  supabase: Client,
  filter: { status?: MatchStatus | "open" } = {},
): Promise<EntityMatchListRow[]> {
  let query = supabase
    .from("entity_match_candidates")
    .select(
      "id, entity_kind, prospect_a, prospect_b, similarity_score, match_reason, status, reviewed_by_email, reviewed_at, created_at",
    )
    .order("similarity_score", { ascending: false })
    .limit(200);
  if (filter.status && filter.status !== "open") query = query.eq("status", filter.status);
  else if (filter.status === "open") query = query.in("status", ["flagged", "needs_review"]);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as EntityMatchRow[];
  const ids = [...new Set(rows.flatMap((row) => [row.prospect_a, row.prospect_b]))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: prospects } = await supabase
      .from("prospects")
      .select("id, business_name")
      .in("id", ids);
    for (const item of (prospects ?? []) as { id: string; business_name: string }[]) {
      names.set(item.id, item.business_name);
    }
  }

  return rows.map((row) => ({
    ...row,
    match_reason: Array.isArray(row.match_reason) ? row.match_reason.map(String) : [],
    business_a: names.get(row.prospect_a) ?? null,
    business_b: names.get(row.prospect_b) ?? null,
  }));
}

export async function reviewEntityMatch(
  supabase: Client,
  input: { id: string; status: MatchStatus },
  actor: { userId: string | null; email: string | null },
): Promise<{ ok: true }> {
  const { error } = await supabase
    .from("entity_match_candidates")
    .update({
      status: input.status,
      reviewed_by: actor.userId,
      reviewed_by_email: actor.email,
      reviewed_at: new Date().toISOString(),
    } as never)
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
