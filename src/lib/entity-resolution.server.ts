/**
 * Entity Resolution Service — SERVER ONLY (Phase 2).
 *
 * Links legacy records (prospect_candidates, prospects, consultations,
 * ai_conversations) to a canonical Business Entity. It never deletes, merges
 * or moves legacy rows: it only writes business_entities (new identities),
 * business_entity_links (1 active link per legacy record) and
 * entity_match_history (audit of every decision).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  matchEntity,
  normalizeDomain,
  normalizeName,
  normalizePhone,
  normalizeEmail,
  parseResolverMode,
  shouldAttach,
  RESOLVER_MODE_KEY,
  type EntityCandidateRow,
  type EntitySignals,
  type MatchResult,
  type ResolverMode,
} from "@/lib/admin/entity-resolution";

type Client = SupabaseClient<Database>;
type LegacyType = Database["public"]["Enums"]["business_legacy_type"];

export type BackfillOptions = {
  dryRun?: boolean;
  limit?: number;
  sources?: LegacyType[];
};

export type SourceReport = {
  scanned: number;
  alreadyLinked: number;
  autoMatched: number;
  suggested: number;
  reviewRequired: number;
  created: number;
  failed: number;
};

export type BackfillReport = {
  dryRun: boolean;
  before: { candidates: number; prospects: number; consultations: number; conversations: number; entities: number };
  after: { entities: number; links: number };
  perSource: Record<string, SourceReport>;
  totals: SourceReport;
  errors: string[];
};

const EMPTY: SourceReport = {
  scanned: 0,
  alreadyLinked: 0,
  autoMatched: 0,
  suggested: 0,
  reviewRequired: 0,
  created: 0,
  failed: 0,
};

const DEFAULT_SOURCES: LegacyType[] = [
  "prospect_candidate",
  "prospect",
  "consultation",
  "ai_conversation",
];

/* --------------------------------- signals -------------------------------- */

function base(partial: Partial<EntitySignals> & { name: string }): EntitySignals {
  const signals: EntitySignals = {
    name: partial.name,
    normalizedName: null,
    city: partial.city ?? null,
    province: partial.province ?? null,
    address: partial.address ?? null,
    category: partial.category ?? null,
    website: partial.website ?? null,
    websiteDomain: null,
    googlePlaceId: partial.googlePlaceId ?? null,
    phone: partial.phone ?? null,
    whatsapp: partial.whatsapp ?? null,
    email: partial.email ?? null,
  };
  signals.normalizedName = normalizeName(signals.name);
  signals.websiteDomain = normalizeDomain(signals.website);
  return signals;
}

function contactValue(contactData: unknown, key: string): string | null {
  if (!contactData || typeof contactData !== "object") return null;
  const entry = (contactData as Record<string, unknown>)[key];
  if (!entry || typeof entry !== "object") return null;
  const value = (entry as { value?: unknown }).value;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function candidateSignals(row: Record<string, unknown>): EntitySignals {
  return base({
    name: String(row["business_name"] ?? ""),
    city: (row["city"] as string | null) ?? null,
    province: (row["province"] as string | null) ?? null,
    address: (row["address"] as string | null) ?? null,
    category: ((row["category"] as string | null) ?? (row["industry"] as string | null)) ?? null,
    website: (row["website"] as string | null) ?? null,
    googlePlaceId: (row["place_id"] as string | null) ?? null,
    phone: (row["phone"] as string | null) ?? contactValue(row["contact_data"], "phone"),
    whatsapp: contactValue(row["contact_data"], "whatsapp"),
    email: contactValue(row["contact_data"], "email"),
  });
}

function prospectSignals(row: Record<string, unknown>): EntitySignals {
  return base({
    name: String(row["business_name"] ?? ""),
    city: (row["city"] as string | null) ?? null,
    category: (row["industry"] as string | null) ?? null,
    website: (row["website"] as string | null) ?? null,
    phone: (row["contact_phone"] as string | null) ?? null,
    whatsapp: (row["contact_whatsapp"] as string | null) ?? null,
    email: (row["contact_email"] as string | null) ?? null,
  });
}

function consultationSignals(row: Record<string, unknown>): EntitySignals {
  const name =
    (row["business_name"] as string | null) ||
    (row["company"] as string | null) ||
    (row["name"] as string | null) ||
    "";
  return base({
    name: String(name),
    category: (row["ai_business_category"] as string | null) ?? (row["project_type"] as string | null) ?? null,
    whatsapp: (row["whatsapp"] as string | null) ?? null,
    email: (row["email"] as string | null) ?? null,
  });
}

function conversationSignals(row: Record<string, unknown>): EntitySignals {
  const name =
    (row["contact_name"] as string | null) || (row["business_category"] as string | null) || "";
  return base({
    name: String(name),
    category: (row["business_category"] as string | null) ?? null,
    whatsapp: (row["contact_whatsapp"] as string | null) ?? null,
    email: (row["contact_email"] as string | null) ?? null,
  });
}

/* ------------------------------ data helpers ------------------------------ */

/** Resolver mode switch (prospect_job_state), default "hardened". Never throws. */
export async function getResolverMode(client: Client): Promise<ResolverMode> {
  try {
    const { data } = await client
      .from("prospect_job_state")
      .select("last_status")
      .eq("key", RESOLVER_MODE_KEY)
      .maybeSingle();
    return parseResolverMode(data?.last_status);
  } catch {
    return "hardened";
  }
}

/** Active (not replaced) entities, paginated. */
async function loadPool(client: Client): Promise<EntityCandidateRow[]> {
  const out: EntityCandidateRow[] = [];
  const pageSize = 1000;
  for (let from = 0; from < 50000; from += pageSize) {
    const { data, error } = await client
      .from("business_entities")
      .select(
        "id, canonical_name, normalized_name, city, province, address, industry, website, website_domain, google_place_id, phone, whatsapp, email",
      )
      .is("replaced_by_entity_id", null)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Gagal memuat business entities: ${error.message}`);
    for (const row of data ?? []) {
      out.push({
        id: row.id,
        name: row.canonical_name,
        normalizedName: row.normalized_name,
        city: row.city,
        province: row.province,
        address: row.address,
        category: row.industry,
        website: row.website,
        websiteDomain: row.website_domain,
        googlePlaceId: row.google_place_id,
        phone: row.phone,
        whatsapp: row.whatsapp,
        email: row.email,
      });
    }
    if (!data || data.length < pageSize) break;
  }
  return out;
}

async function loadActiveLinks(client: Client) {
  const map = new Map<string, string>(); // `${type}:${id}` -> entity id
  const pageSize = 1000;
  for (let from = 0; from < 20000; from += pageSize) {
    const { data, error } = await client
      .from("business_entity_links")
      .select("business_entity_id, legacy_type, legacy_id")
      .eq("is_active", true)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Gagal memuat link: ${error.message}`);
    for (const row of data ?? []) map.set(`${row.legacy_type}:${row.legacy_id}`, row.business_entity_id);
    if (!data || data.length < pageSize) break;
  }
  return map;
}

async function countRows(client: Client, table: "prospect_candidates" | "prospects" | "consultations" | "ai_conversations" | "business_entities" | "business_entity_links") {
  const { count, error } = await client.from(table).select("id", { count: "exact", head: true });
  if (error) throw new Error(`Gagal menghitung ${table}: ${error.message}`);
  return count ?? 0;
}

/**
 * Atomic create-or-find by strong identity (Phase 2A). Uses the database
 * function (advisory lock + partial unique indexes), so two concurrent runs
 * can't create the same place/domain twice. Falls back to a plain insert only
 * when the function itself is unavailable.
 */
export async function createEntity(
  client: Client,
  signals: EntitySignals,
  stage: string,
): Promise<{ row: EntityCandidateRow; created: boolean; matchedBy: string | null }> {
  const payload = {
    canonical_name: signals.name || "Tanpa nama",
    normalized_name: signals.normalizedName,
    industry: signals.category,
    address: signals.address,
    city: signals.city,
    province: signals.province,
    website: signals.website,
    website_domain: signals.websiteDomain,
    google_place_id: signals.googlePlaceId,
    phone: normalizePhone(signals.phone),
    whatsapp: normalizePhone(signals.whatsapp),
    email: normalizeEmail(signals.email),
    current_stage: stage,
  };
  const { data: rpcData, error: rpcError } = await client.rpc("find_or_create_business_entity", {
    _payload: payload as never,
  });
  const rpc = rpcData as { id?: string; created?: boolean; matched_by?: string | null } | null;
  if (!rpcError && rpc?.id) {
    return { row: { ...signals, id: rpc.id }, created: Boolean(rpc.created), matchedBy: rpc.matched_by ?? null };
  }
  // Fallback: function missing / not callable. Unique indexes still guard duplicates.
  const missingFn = rpcError && /function|does not exist|schema cache|PGRST202/i.test(`${rpcError.code} ${rpcError.message}`);
  if (rpcError && !missingFn) throw new Error(`Gagal membuat business entity: ${rpcError.message}`);
  const { data, error } = await client.from("business_entities").insert(payload).select("id").single();
  if (error || !data) throw new Error(`Gagal membuat business entity: ${error?.message ?? "unknown"}`);
  return { row: { ...signals, id: data.id }, created: true, matchedBy: null };
}

async function linkLegacy(
  client: Client,
  entityId: string,
  legacyType: LegacyType,
  legacyId: string,
) {
  const { error } = await client
    .from("business_entity_links")
    .upsert(
      { business_entity_id: entityId, legacy_type: legacyType, legacy_id: legacyId, is_active: true },
      { onConflict: "business_entity_id,legacy_type,legacy_id" },
    );
  if (error) throw new Error(`Gagal menautkan ${legacyType}: ${error.message}`);
}

async function logMatch(
  client: Client,
  input: {
    sourceType: LegacyType;
    sourceId: string;
    matchedEntityId: string | null;
    candidateEntityId: string | null;
    result: MatchResult;
  },
) {
  const { error } = await client.from("entity_match_history").insert({
    source_type: input.sourceType,
    source_id: input.sourceId,
    candidate_entity_id: input.candidateEntityId,
    matched_entity_id: input.matchedEntityId,
    matching_method: input.result.method,
    confidence_score: input.result.confidence,
    status: input.result.status,
    comparison: input.result.comparison as never,
    reason: input.result.reason,
  });
  if (error) throw new Error(`Gagal mencatat riwayat pencocokan: ${error.message}`);
}

/* --------------------------------- service -------------------------------- */

type ResolveOutcome = {
  entityId: string;
  created: boolean;
  method: string;
  status: string;
  confidence: number;
  candidateEntityId: string | null;
};

type ResolveContext = {
  pool: EntityCandidateRow[];
  links: Map<string, string>;
  dryRun: boolean;
  report: SourceReport;
  errors: string[];
  mode?: ResolverMode;
  outcomes?: Map<string, ResolveOutcome>;
};

/**
 * Resolves one legacy record. Review-required matches are logged but the
 * record still gets its own entity, so nothing is silently merged.
 */
async function resolveOne(
  client: Client,
  ctx: ResolveContext,
  legacyType: LegacyType,
  legacyId: string,
  signals: EntitySignals,
  stage: string,
  forcedEntityId?: string | null,
) {
  ctx.report.scanned += 1;
  const key = `${legacyType}:${legacyId}`;
  if (ctx.links.has(key)) {
    ctx.report.alreadyLinked += 1;
    return ctx.links.get(key)!;
  }

  if (forcedEntityId) {
    const result: MatchResult = {
      entityId: forcedEntityId,
      method: "promoted_link",
      status: "auto_matched",
      confidence: 100,
      reason: "Kandidat sudah dipromosikan ke prospek ini",
      comparison: {},
    };
    if (!ctx.dryRun) {
      await linkLegacy(client, forcedEntityId, legacyType, legacyId);
      await logMatch(client, {
        sourceType: legacyType,
        sourceId: legacyId,
        matchedEntityId: forcedEntityId,
        candidateEntityId: forcedEntityId,
        result,
      });
    }
    ctx.links.set(key, forcedEntityId);
    ctx.outcomes?.set(legacyId, {
      entityId: forcedEntityId,
      created: false,
      method: "promoted_link",
      status: "auto_matched",
      confidence: 100,
      candidateEntityId: forcedEntityId,
    });
    ctx.report.autoMatched += 1;
    return forcedEntityId;
  }

  const mode = ctx.mode ?? "hardened";
  let result = matchEntity(signals, ctx.pool, mode);
  // Uncertain matches never attach automatically in hardened mode: the record
  // gets its own entity and the pair is queued for human review.
  let entityId = shouldAttach(result, mode) ? result.entityId : null;

  if (result.status === "auto_matched") ctx.report.autoMatched += 1;
  else if (result.status === "suggested") ctx.report.suggested += 1;
  else if (result.status === "review_required") ctx.report.reviewRequired += 1;
  else ctx.report.created += 1;

  if (ctx.dryRun) {
    // Simulate the new identity so later records in the same run can match it.
    if (!entityId) {
      entityId = `dry-${ctx.pool.length + 1}`;
      ctx.pool.push({ ...signals, id: entityId });
    }
    ctx.links.set(key, entityId);
    return entityId;
  }

  let created = false;
  if (!entityId) {
    const made = await createEntity(client, signals, stage);
    entityId = made.row.id;
    created = made.created;
    if (made.created) {
      ctx.pool.push(made.row);
    } else if (result.status === "created") {
      // A concurrent run created the same place/domain first: link to it.
      result = {
        ...result,
        entityId,
        method: made.matchedBy === "website_domain" ? "website_domain" : "google_place_id",
        status: "auto_matched",
        confidence: 100,
        reason: "Ditemukan bersamaan (atomic create-or-find)",
      };
    }
  }

  await linkLegacy(client, entityId, legacyType, legacyId);
  await logMatch(client, {
    sourceType: legacyType,
    sourceId: legacyId,
    matchedEntityId: entityId,
    candidateEntityId: result.entityId,
    result,
  });
  ctx.links.set(key, entityId);
  ctx.outcomes?.set(legacyId, {
    entityId,
    created,
    method: result.method,
    status: result.status,
    confidence: result.confidence,
    candidateEntityId: result.entityId,
  });
  return entityId;
}

/** Idempotent backfill across all legacy sources. Safe to re-run. */
export async function backfillEntities(
  client: Client,
  options: BackfillOptions = {},
): Promise<BackfillReport> {
  const dryRun = options.dryRun ?? false;
  const limit = Math.min(Math.max(options.limit ?? 500, 1), 2000);
  const sources = options.sources?.length ? options.sources : DEFAULT_SOURCES;

  const before = {
    candidates: await countRows(client, "prospect_candidates"),
    prospects: await countRows(client, "prospects"),
    consultations: await countRows(client, "consultations"),
    conversations: await countRows(client, "ai_conversations"),
    entities: await countRows(client, "business_entities"),
  };

  const pool = await loadPool(client);
  const links = await loadActiveLinks(client);
  const mode = await getResolverMode(client);
  const errors: string[] = [];
  const perSource: Record<string, SourceReport> = {};

  async function run(
    legacyType: LegacyType,
    rows: Record<string, unknown>[],
    toSignals: (row: Record<string, unknown>) => EntitySignals,
    stage: string,
    forced?: (row: Record<string, unknown>) => string | null,
  ) {
    const report = { ...EMPTY };
    const ctx: ResolveContext = { pool, links, dryRun, report, errors, mode };
    for (const row of rows) {
      const id = String(row["id"] ?? "");
      if (!id) continue;
      try {
        await resolveOne(client, ctx, legacyType, id, toSignals(row), stage, forced?.(row) ?? null);
      } catch (error) {
        report.failed += 1;
        if (errors.length < 10) errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    perSource[legacyType] = report;
  }

  if (sources.includes("prospect_candidate")) {
    const { data, error } = await client
      .from("prospect_candidates")
      .select(
        "id, business_name, city, province, address, category, industry, website, place_id, phone, contact_data, promoted_prospect_id, sales_stage",
      )
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(`Gagal memuat kandidat: ${error.message}`);
    await run("prospect_candidate", (data ?? []) as Record<string, unknown>[], candidateSignals, "candidate");

    // Rule 6: a promoted candidate and its prospect must share one entity.
    if (sources.includes("prospect")) {
      const promoted = (data ?? []).filter((row) => row.promoted_prospect_id);
      if (promoted.length) {
        const { data: prospectRows, error: prospectError } = await client
          .from("prospects")
          .select("id, business_name, city, industry, website, contact_phone, contact_whatsapp, contact_email")
          .in(
            "id",
            promoted.map((row) => row.promoted_prospect_id as string),
          );
        if (prospectError) throw new Error(`Gagal memuat prospek promosi: ${prospectError.message}`);
        const byId = new Map((prospectRows ?? []).map((row) => [row.id, row]));
        await run(
          "prospect",
          promoted
            .map((row) => byId.get(row.promoted_prospect_id as string))
            .filter((row): row is NonNullable<typeof row> => Boolean(row)) as Record<string, unknown>[],
          prospectSignals,
          "prospect",
          (row) => links.get(`prospect_candidate:${promoted.find((c) => c.promoted_prospect_id === row["id"])?.id}`) ?? null,
        );
      }
    }
  }

  if (sources.includes("prospect")) {
    const { data, error } = await client
      .from("prospects")
      .select("id, business_name, city, industry, website, contact_phone, contact_whatsapp, contact_email")
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(`Gagal memuat prospek: ${error.message}`);
    const previous = perSource["prospect"];
    await run("prospect", (data ?? []) as Record<string, unknown>[], prospectSignals, "prospect");
    if (previous) {
      const current = perSource["prospect"]!;
      perSource["prospect"] = {
        scanned: previous.scanned + current.scanned,
        alreadyLinked: previous.alreadyLinked + current.alreadyLinked,
        autoMatched: previous.autoMatched + current.autoMatched,
        suggested: previous.suggested + current.suggested,
        reviewRequired: previous.reviewRequired + current.reviewRequired,
        created: previous.created + current.created,
        failed: previous.failed + current.failed,
      };
    }
  }

  if (sources.includes("consultation")) {
    const { data, error } = await client
      .from("consultations")
      .select("id, business_name, company, name, email, whatsapp, ai_business_category, project_type")
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(`Gagal memuat konsultasi: ${error.message}`);
    await run("consultation", (data ?? []) as Record<string, unknown>[], consultationSignals, "consultation");
  }

  if (sources.includes("ai_conversation")) {
    const { data, error } = await client
      .from("ai_conversations")
      .select("id, contact_name, contact_email, contact_whatsapp, business_category")
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(`Gagal memuat percakapan AI: ${error.message}`);
    await run("ai_conversation", (data ?? []) as Record<string, unknown>[], conversationSignals, "conversation");
  }

  const totals = Object.values(perSource).reduce<SourceReport>(
    (acc, row) => ({
      scanned: acc.scanned + row.scanned,
      alreadyLinked: acc.alreadyLinked + row.alreadyLinked,
      autoMatched: acc.autoMatched + row.autoMatched,
      suggested: acc.suggested + row.suggested,
      reviewRequired: acc.reviewRequired + row.reviewRequired,
      created: acc.created + row.created,
      failed: acc.failed + row.failed,
    }),
    { ...EMPTY },
  );

  return {
    dryRun,
    before,
    after: {
      entities: dryRun ? before.entities : await countRows(client, "business_entities"),
      links: dryRun ? links.size : await countRows(client, "business_entity_links"),
    },
    perSource,
    totals,
    errors,
  };
}

/* ------------------------------ dashboard read ----------------------------- */

export type UnifiedEntityRow = {
  id: string;
  name: string;
  city: string | null;
  stage: string;
  phone: string | null;
  website: string | null;
  sources: number;
  candidateLinks: number;
  prospectLinks: number;
  consultationLinks: number;
  conversationLinks: number;
  hasContact: boolean;
  duplicateWarning: boolean;
};

export async function listUnifiedEntities(
  client: Client,
  options: { limit?: number; search?: string } = {},
) {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  let query = client
    .from("business_entities")
    .select("id, canonical_name, normalized_name, city, current_stage, phone, whatsapp, website")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (options.search?.trim()) query = query.ilike("canonical_name", `%${options.search.trim()}%`);
  const { data, error } = await query;
  if (error) throw new Error(`Gagal memuat daftar bisnis: ${error.message}`);

  const ids = (data ?? []).map((row) => row.id);
  const linkCounts = new Map<string, Record<string, number>>();
  if (ids.length) {
    const { data: linkRows, error: linkError } = await client
      .from("business_entity_links")
      .select("business_entity_id, legacy_type")
      .eq("is_active", true)
      .in("business_entity_id", ids);
    if (linkError) throw new Error(`Gagal memuat link: ${linkError.message}`);
    for (const row of linkRows ?? []) {
      const bucket = linkCounts.get(row.business_entity_id) ?? {};
      bucket[row.legacy_type] = (bucket[row.legacy_type] ?? 0) + 1;
      linkCounts.set(row.business_entity_id, bucket);
    }
  }

  const warned = new Set<string>();
  if (ids.length) {
    const { data: reviewRows } = await client
      .from("entity_match_history")
      .select("matched_entity_id")
      .eq("status", "review_required")
      .in("matched_entity_id", ids);
    for (const row of reviewRows ?? []) if (row.matched_entity_id) warned.add(row.matched_entity_id);
  }

  const rows: UnifiedEntityRow[] = (data ?? []).map((row) => {
    const counts = linkCounts.get(row.id) ?? {};
    const candidateLinks = counts["prospect_candidate"] ?? 0;
    const prospectLinks = counts["prospect"] ?? 0;
    const consultationLinks = counts["consultation"] ?? 0;
    const conversationLinks = counts["ai_conversation"] ?? 0;
    return {
      id: row.id,
      name: row.canonical_name,
      city: row.city,
      stage: row.current_stage,
      phone: row.phone ?? row.whatsapp,
      website: row.website,
      sources: candidateLinks + prospectLinks + consultationLinks + conversationLinks,
      candidateLinks,
      prospectLinks,
      consultationLinks,
      conversationLinks,
      hasContact: Boolean(row.phone || row.whatsapp),
      duplicateWarning: warned.has(row.id),
    };
  });

  return { rows, total: rows.length };
}

export type ReviewRow = {
  id: string;
  sourceType: string;
  sourceId: string;
  method: string;
  confidence: number;
  reason: string | null;
  comparison: string;
  businessA: string | null;
  businessB: string | null;
  createdAt: string;
};

/** Duplicate review queue: matches too weak to link automatically (incl. suggestions). */
export async function listMatchReviewQueue(client: Client, limit = 100) {
  const { data, error } = await client
    .from("entity_match_history")
    .select("id, source_type, source_id, candidate_entity_id, matched_entity_id, matching_method, confidence_score, status, reason, comparison, created_at")
    .in("status", ["review_required", "suggested"])
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 300));
  if (error) throw new Error(`Gagal memuat antrean tinjauan: ${error.message}`);

  const entityIds = Array.from(
    new Set(
      (data ?? [])
        .flatMap((row) => [row.candidate_entity_id, row.matched_entity_id])
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const names = new Map<string, string>();
  if (entityIds.length) {
    const { data: entityRows } = await client
      .from("business_entities")
      .select("id, canonical_name")
      .in("id", entityIds);
    for (const row of entityRows ?? []) names.set(row.id, row.canonical_name);
  }

  const rows: ReviewRow[] = (data ?? []).map((row) => ({
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    method: row.matching_method,
    confidence: Number(row.confidence_score ?? 0),
    reason: row.reason,
    comparison: JSON.stringify(row.comparison ?? {}, null, 2),
    businessA: row.matched_entity_id ? (names.get(row.matched_entity_id) ?? null) : null,
    businessB: row.candidate_entity_id ? (names.get(row.candidate_entity_id) ?? null) : null,
    createdAt: row.created_at,
  }));
  return { rows };
}

/** Mark an entity as replaced when it has no active source left. Never deletes. */
async function markReplacedIfEmpty(
  client: Client,
  oldEntityId: string | null | undefined,
  newEntityId: string,
  reason: string,
  actorId: string | null,
): Promise<boolean> {
  if (!oldEntityId || oldEntityId === newEntityId) return false;
  const { count } = await client
    .from("business_entity_links")
    .select("id", { count: "exact", head: true })
    .eq("business_entity_id", oldEntityId)
    .eq("is_active", true);
  if ((count ?? 0) > 0) return false;
  const { error } = await client
    .from("business_entities")
    .update({ replaced_by_entity_id: newEntityId, replaced_at: new Date().toISOString(), replaced_reason: reason })
    .eq("id", oldEntityId)
    .is("replaced_by_entity_id", null);
  if (error) return false;
  const { recordDecisionTrace } = await import("./decision-trace.server");
  await recordDecisionTrace({
    entityId: oldEntityId,
    module: "entity_resolution",
    decisionType: "entity_replaced",
    decision: { replaced_entity_id: oldEntityId, replaced_by_entity_id: newEntityId, reason },
    evidence: { note: "analysis/findings stay on the replaced entity; resolve via replaced_by_entity_id" },
    actorKind: actorId ? "user" : "system",
    actorId,
  });
  return true;
}

/** Move the single active link of a legacy record to another entity (history kept). */
async function moveActiveLink(client: Client, legacyType: LegacyType, legacyId: string, target: string) {
  const { error } = await client
    .from("business_entity_links")
    .update({ is_active: false })
    .eq("legacy_type", legacyType)
    .eq("legacy_id", legacyId)
    .eq("is_active", true)
    .neq("business_entity_id", target);
  if (error) throw new Error(`Gagal memperbarui link: ${error.message}`);
  await linkLegacy(client, target, legacyType, legacyId);
}

/** Follow replaced_by_entity_id to the canonical entity (max 5 hops). */
export async function resolveCanonicalEntityId(client: Client, entityId: string): Promise<string> {
  let current = entityId;
  for (let i = 0; i < 5; i += 1) {
    const { data } = await client
      .from("business_entities")
      .select("replaced_by_entity_id")
      .eq("id", current)
      .maybeSingle();
    const next = data?.replaced_by_entity_id;
    if (!next || next === current) break;
    current = next;
  }
  return current;
}

/** Human decision on a review item — link it, or mark it as a distinct business. */
export async function resolveReviewItem(
  client: Client,
  input: { id: string; decision: "link" | "reject"; actorId?: string | null },
) {
  const { data, error } = await client
    .from("entity_match_history")
    .select("id, source_type, source_id, candidate_entity_id, matched_entity_id, status")
    .eq("id", input.id)
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat item tinjauan: ${error.message}`);
  if (!data) throw new Error("Item tinjauan tidak ditemukan.");
  const actorId = input.actorId ?? null;
  const legacyType = data.source_type as LegacyType;
  const { recordDecisionTrace } = await import("./decision-trace.server");

  const { data: previousLink } = await client
    .from("business_entity_links")
    .select("business_entity_id")
    .eq("legacy_type", legacyType)
    .eq("legacy_id", data.source_id)
    .eq("is_active", true)
    .maybeSingle();
  const previousEntityId = previousLink?.business_entity_id ?? null;

  if (input.decision === "reject") {
    // A pre-2A suggestion may already be attached to the suggested business.
    // Rejecting it gives the record its own identity; nothing is deleted.
    let movedTo: string | null = null;
    if (previousEntityId && data.candidate_entity_id && previousEntityId === data.candidate_entity_id) {
      const spec = ENSURE_COLUMNS[legacyType];
      if (spec) {
        const { data: row } = await client.from(spec.table).select(spec.columns).eq("id", data.source_id).maybeSingle();
        if (row) {
          const made = await createEntity(client, spec.toSignals(row as unknown as Record<string, unknown>), spec.stage);
          if (made.row.id !== previousEntityId) {
            await moveActiveLink(client, legacyType, data.source_id, made.row.id);
            movedTo = made.row.id;
          }
        }
      }
    }
    const { error: updateError } = await client
      .from("entity_match_history")
      .update({ status: "rejected", ...(movedTo ? { matched_entity_id: movedTo } : {}) })
      .eq("id", input.id);
    if (updateError) throw new Error(`Gagal menyimpan keputusan: ${updateError.message}`);
    await recordDecisionTrace({
      entityId: movedTo ?? previousEntityId,
      legacyType,
      legacyId: data.source_id,
      module: "entity_resolution",
      decisionType: "entity_review_decision",
      decision: { decision: "reject", previous_status: data.status, moved_to_entity_id: movedTo },
      evidence: { match_history_id: input.id, suggested_entity_id: data.candidate_entity_id },
      actorKind: "user",
      actorId,
    });
    return { status: "rejected" as const };
  }

  const target = data.candidate_entity_id;
  if (!target) throw new Error("Tidak ada bisnis pembanding untuk ditautkan.");
  const canonicalTarget = await resolveCanonicalEntityId(client, target);

  // Move only the active source ownership; history, analysis and findings stay put.
  await moveActiveLink(client, legacyType, data.source_id, canonicalTarget);
  const { error: updateError } = await client
    .from("entity_match_history")
    .update({ status: "auto_matched", matched_entity_id: canonicalTarget })
    .eq("id", input.id);
  if (updateError) throw new Error(`Gagal menyimpan keputusan: ${updateError.message}`);

  const replaced = await markReplacedIfEmpty(client, previousEntityId, canonicalTarget, "entity_review_link", actorId);

  await recordDecisionTrace({
    entityId: canonicalTarget,
    legacyType,
    legacyId: data.source_id,
    module: "entity_resolution",
    decisionType: "entity_relinked_manual",
    decision: { business_entity_id: canonicalTarget, legacy_type: legacyType, legacy_id: data.source_id },
    evidence: { match_history_id: input.id, previous_entity_replaced: replaced },
    actorKind: "user",
    actorId,
    override: {
      original: previousEntityId,
      changed: canonicalTarget,
      actor: actorId,
      reason: "entity_review",
      at: new Date().toISOString(),
    },
  });
  await recordDecisionTrace({
    entityId: canonicalTarget,
    legacyType,
    legacyId: data.source_id,
    module: "entity_resolution",
    decisionType: "entity_review_decision",
    decision: { decision: "link", previous_status: data.status, previous_entity_id: previousEntityId },
    evidence: { match_history_id: input.id },
    actorKind: "user",
    actorId,
  });
  return { status: "linked" as const };
}

/* ------------------------- canonical entry helper ------------------------- */

const ENSURE_COLUMNS: Record<LegacyType, { table: "prospect_candidates" | "prospects" | "consultations" | "ai_conversations"; columns: string; toSignals: (row: Record<string, unknown>) => EntitySignals; stage: string } | undefined> = {
  prospect_candidate: {
    table: "prospect_candidates",
    columns: "id, business_name, city, province, address, category, industry, website, place_id, phone, contact_data, promoted_prospect_id",
    toSignals: candidateSignals,
    stage: "candidate",
  },
  prospect: {
    table: "prospects",
    columns: "id, business_name, city, industry, website, contact_phone, contact_whatsapp, contact_email",
    toSignals: prospectSignals,
    stage: "prospect",
  },
  consultation: {
    table: "consultations",
    columns: "id, business_name, company, name, email, whatsapp, ai_business_category, project_type",
    toSignals: consultationSignals,
    stage: "consultation",
  },
  ai_conversation: {
    table: "ai_conversations",
    columns: "id, contact_name, contact_email, contact_whatsapp, business_category",
    toSignals: conversationSignals,
    stage: "conversation",
  },
  client: undefined,
};

/**
 * Canonical entry point (Phase A): every new business record goes through
 * here so it is linked to a Business Entity immediately — no manual
 * backfill needed. Idempotent, additive, never throws (returns errors).
 * `forcedEntityId` links a promoted prospect to its candidate's entity.
 */
export async function ensureBusinessEntities(
  client: Client,
  legacyType: LegacyType,
  ids: string[],
  options: { forcedEntityId?: string | null } = {},
): Promise<{ linked: Record<string, string>; created: number; errors: string[] }> {
  const out = { linked: {} as Record<string, string>, created: 0, errors: [] as string[] };
  const spec = ENSURE_COLUMNS[legacyType];
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 500);
  if (!spec || unique.length === 0) return out;
  try {
    const { data: existing } = await client
      .from("business_entity_links")
      .select("business_entity_id, legacy_id")
      .eq("legacy_type", legacyType)
      .eq("is_active", true)
      .in("legacy_id", unique);
    const links = new Map<string, string>();
    for (const row of existing ?? []) {
      links.set(`${legacyType}:${row.legacy_id}`, row.business_entity_id);
      out.linked[row.legacy_id] = row.business_entity_id;
    }
    const missing = unique.filter((id) => !links.has(`${legacyType}:${id}`));
    if (missing.length === 0) return out;

    const { data: rows, error } = await client.from(spec.table).select(spec.columns).in("id", missing);
    if (error) throw new Error(error.message);
    const pool = await loadPool(client);
    const report = { ...EMPTY };
    const outcomes = new Map<string, ResolveOutcome>();
    const mode = await getResolverMode(client);
    const ctx: ResolveContext = { pool, links, dryRun: false, report, errors: out.errors, mode, outcomes };

    // A candidate promoted earlier shares its prospect's entity (and vice versa).
    for (const raw of (rows ?? []) as unknown as Record<string, unknown>[]) {
      const id = String(raw["id"]);
      try {
        let forced = options.forcedEntityId ?? null;
        const promoted = raw["promoted_prospect_id"] as string | null | undefined;
        if (!forced && promoted) {
          const { data: link } = await client
            .from("business_entity_links")
            .select("business_entity_id")
            .eq("legacy_type", "prospect")
            .eq("legacy_id", promoted)
            .eq("is_active", true)
            .maybeSingle();
          forced = link?.business_entity_id ?? null;
        }
        out.linked[id] = await resolveOne(client, ctx, legacyType, id, spec.toSignals(raw), spec.stage, forced);
      } catch (err) {
        if (out.errors.length < 10) out.errors.push(err instanceof Error ? err.message : String(err));
      }
    }
    out.created = [...outcomes.values()].filter((o) => o.created).length;

    // Observability (write-only, never throws): created / matched / promoted.
    const newlyLinked = missing.filter((id) => out.linked[id]);
    if (newlyLinked.length > 0) {
      const { recordDecisionTraces } = await import("./decision-trace.server");
      await recordDecisionTraces(
        newlyLinked.map((id) => {
          const o = outcomes.get(id);
          const decisionType = o?.method === "promoted_link"
            ? "entity_linked_promotion"
            : o?.created
              ? "entity_created"
              : "entity_matched";
          return {
            entityId: out.linked[id],
            legacyType,
            legacyId: id,
            module: "entity_resolution",
            decisionType,
            decision: {
              business_entity_id: out.linked[id],
              legacy_type: legacyType,
              legacy_id: id,
              method: o?.method ?? null,
              match_status: o?.status ?? null,
              review_candidate_entity_id:
                o && o.candidateEntityId && o.candidateEntityId !== out.linked[id] ? o.candidateEntityId : null,
            },
            evidence: { forced_entity_id: options.forcedEntityId ?? null, resolver_mode: mode },
            confidence: o?.confidence ?? null,
            actorKind: "system" as const,
          };
        }),
      );
    }
  } catch (err) {
    out.errors.push(err instanceof Error ? err.message : String(err));
  }
  return out;
}

export async function ensureBusinessEntity(
  client: Client,
  legacyType: LegacyType,
  id: string,
  options: { forcedEntityId?: string | null } = {},
): Promise<string | null> {
  const result = await ensureBusinessEntities(client, legacyType, [id], options);
  return result.linked[id] ?? null;
}
