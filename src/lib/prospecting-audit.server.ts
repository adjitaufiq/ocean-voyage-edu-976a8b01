/**
 * Random Audit Dashboard — server-only.
 *
 * Samples ~10% of validated prospects, freezes what the AI claimed at that
 * moment, and lets the owner mark each sample accurate / partial / inaccurate.
 * Accuracy is recomputed per campaign; a campaign that drops below the
 * threshold is flagged for review so bad discovery batches stop silently
 * feeding the sales queue.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  AUDIT_ACCURACY_THRESHOLD,
  AUDIT_SAMPLE_RATE,
  parseQualityGate,
  parseValidationChecks,
  type AuditVerdict,
  type QualityGateResult,
  type ValidationCheck,
} from "@/lib/admin/prospecting";
import { logProspectActivity } from "@/lib/prospecting.server";

type Client = SupabaseClient<Database>;

export type AuditRow = {
  id: string;
  prospect_id: string;
  campaign_id: string | null;
  batch_key: string | null;
  ai_stage: string | null;
  reviewer_verdict: AuditVerdict | null;
  reviewer_notes: string | null;
  accurate: boolean | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  created_at: string;
  businessName: string;
  city: string | null;
  industry: string | null;
  website: string | null;
  claims: Record<string, string | null>;
  checks: ValidationCheck[];
  qualityGate: QualityGateResult | null;
};

export type AuditOverview = {
  audits: AuditRow[];
  pending: number;
  reviewed: number;
  accuracy: number | null;
  campaigns: {
    id: string;
    name: string;
    accuracy: number | null;
    needsReview: boolean;
    reviewReason: string | null;
  }[];
};

const AUDIT_SELECT =
  "id, prospect_id, campaign_id, batch_key, ai_stage, ai_claims, findings, reviewer_verdict, reviewer_notes, accurate, reviewed_by_email, reviewed_at, created_at";

function mapAudit(row: Record<string, unknown>): AuditRow {
  const claims = (row["ai_claims"] ?? {}) as Record<string, unknown>;
  const findings = (row["findings"] ?? {}) as Record<string, unknown>;
  return {
    id: String(row["id"]),
    prospect_id: String(row["prospect_id"]),
    campaign_id: (row["campaign_id"] as string | null) ?? null,
    batch_key: (row["batch_key"] as string | null) ?? null,
    ai_stage: (row["ai_stage"] as string | null) ?? null,
    reviewer_verdict: (row["reviewer_verdict"] as AuditVerdict | null) ?? null,
    reviewer_notes: (row["reviewer_notes"] as string | null) ?? null,
    accurate: (row["accurate"] as boolean | null) ?? null,
    reviewed_by_email: (row["reviewed_by_email"] as string | null) ?? null,
    reviewed_at: (row["reviewed_at"] as string | null) ?? null,
    created_at: String(row["created_at"]),
    businessName: String(claims["business_name"] ?? "Prospek"),
    city: (claims["city"] as string | null) ?? null,
    industry: (claims["industry"] as string | null) ?? null,
    website: (claims["website"] as string | null) ?? null,
    claims,
    checks: parseValidationChecks(findings["checks"]),
    qualityGate: parseQualityGate(findings["quality_gate"]),
  };
}

/** Creates a fresh 10% random sample from validated prospects. */
export async function sampleAudits(
  supabase: Client,
  input: { campaignId?: string | null; size?: number },
  actor: { userId: string; email?: string | null },
): Promise<{ created: number; batchKey: string }> {
  let query = supabase
    .from("prospects")
    .select(
      "id, business_name, industry, city, website, contact_email, contact_whatsapp, contact_phone, google_maps_url, campaign_id, validation_stage, validation_checks, validation_score, quality_gate, opportunity_reason, research_summary",
    )
    .in("validation_stage", ["verified", "sales_ready", "rejected"])
    .order("validated_at", { ascending: false })
    .limit(500);
  if (input.campaignId) query = query.eq("campaign_id", input.campaignId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  if (!rows.length) return { created: 0, batchKey: "" };

  const target = Math.max(1, input.size ?? Math.ceil(rows.length * AUDIT_SAMPLE_RATE));
  const shuffled = [...rows].sort(() => Math.random() - 0.5).slice(0, target);
  const batchKey = `audit-${new Date().toISOString().slice(0, 19)}`;

  const payload = shuffled.map((row) => ({
    prospect_id: String(row["id"]),
    campaign_id: (row["campaign_id"] as string | null) ?? null,
    batch_key: batchKey,
    ai_stage: (row["validation_stage"] as string | null) ?? null,
    ai_claims: {
      business_name: row["business_name"],
      industry: row["industry"],
      city: row["city"],
      website: row["website"],
      contact_email: row["contact_email"],
      contact_whatsapp: row["contact_whatsapp"] ?? row["contact_phone"],
      google_maps_url: row["google_maps_url"],
      opportunity_reason: row["opportunity_reason"],
      research_summary: row["research_summary"],
    },
    findings: {
      checks: row["validation_checks"] ?? [],
      quality_gate: row["quality_gate"] ?? null,
      validation_score: row["validation_score"] ?? 0,
    },
    created_by: actor.userId,
  }));

  const { error: insertError } = await supabase.from("prospect_audits").insert(payload as never);
  if (insertError) throw new Error(insertError.message);
  return { created: payload.length, batchKey };
}

export async function fetchAudits(
  supabase: Client,
  filters?: { campaignId?: string | null; pendingOnly?: boolean; limit?: number },
): Promise<AuditOverview> {
  let query = supabase
    .from("prospect_audits")
    .select(AUDIT_SELECT)
    .order("created_at", { ascending: false })
    .limit(filters?.limit ?? 100);
  if (filters?.campaignId) query = query.eq("campaign_id", filters.campaignId);
  if (filters?.pendingOnly) query = query.is("reviewer_verdict", null);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const audits = ((data ?? []) as unknown as Record<string, unknown>[]).map(mapAudit);

  const reviewed = audits.filter((audit) => audit.reviewer_verdict);
  const accuracy = reviewed.length
    ? Math.round(
        (reviewed.reduce(
          (sum, audit) => sum + (audit.reviewer_verdict === "accurate" ? 1 : audit.reviewer_verdict === "partial" ? 0.5 : 0),
          0,
        ) /
          reviewed.length) *
          100,
      )
    : null;

  const { data: campaignRows } = await supabase
    .from("prospect_campaigns")
    .select("id, name, validation_accuracy, needs_review, review_reason")
    .order("created_at", { ascending: false })
    .limit(50);

  return {
    audits,
    pending: audits.length - reviewed.length,
    reviewed: reviewed.length,
    accuracy,
    campaigns: ((campaignRows ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
      id: String(row["id"]),
      name: String(row["name"]),
      accuracy: row["validation_accuracy"] === null ? null : Number(row["validation_accuracy"]),
      needsReview: Boolean(row["needs_review"]),
      reviewReason: (row["review_reason"] as string | null) ?? null,
    })),
  };
}

/** Recomputes campaign accuracy and flags campaigns that fall below threshold. */
async function refreshCampaignAccuracy(supabase: Client, campaignId: string): Promise<number | null> {
  const { data } = await supabase
    .from("prospect_audits")
    .select("reviewer_verdict")
    .eq("campaign_id", campaignId)
    .not("reviewer_verdict", "is", null)
    .limit(500);
  const verdicts = ((data ?? []) as unknown as { reviewer_verdict: AuditVerdict }[]).map(
    (row) => row.reviewer_verdict,
  );
  if (!verdicts.length) return null;

  const accuracy = Math.round(
    (verdicts.reduce((sum, verdict) => sum + (verdict === "accurate" ? 1 : verdict === "partial" ? 0.5 : 0), 0) /
      verdicts.length) *
      100,
  );
  const needsReview = accuracy < AUDIT_ACCURACY_THRESHOLD;
  await supabase
    .from("prospect_campaigns")
    .update({
      validation_accuracy: accuracy,
      needs_review: needsReview,
      review_reason: needsReview
        ? `Akurasi validasi ${accuracy}% di bawah ambang ${AUDIT_ACCURACY_THRESHOLD}% (${verdicts.length} audit)`
        : null,
    } as never)
    .eq("id", campaignId);
  return accuracy;
}

export async function submitAuditVerdict(
  supabase: Client,
  input: { id: string; verdict: AuditVerdict; notes?: string | null },
  actor: { userId: string; email?: string | null },
): Promise<{ ok: true; campaignAccuracy: number | null }> {
  const { data, error } = await supabase
    .from("prospect_audits")
    .update({
      reviewer_verdict: input.verdict,
      reviewer_notes: input.notes?.trim() || null,
      accurate: input.verdict === "accurate",
      reviewed_by: actor.userId,
      reviewed_by_email: actor.email ?? null,
      reviewed_at: new Date().toISOString(),
    } as never)
    .eq("id", input.id)
    .select("prospect_id, campaign_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Audit tidak ditemukan.");

  const row = data as unknown as { prospect_id: string; campaign_id: string | null };

  // An inaccurate sample must not stay sellable.
  if (input.verdict === "inaccurate") {
    await supabase
      .from("prospects")
      .update({
        validation_stage: "validating",
        quality_gate_passed: false,
        validation_notes: `Audit owner menilai data tidak akurat${input.notes ? `: ${input.notes}` : ""}`,
      } as never)
      .eq("id", row.prospect_id);
  }

  await logProspectActivity(supabase, {
    prospectId: row.prospect_id,
    action: "research",
    label: `Audit owner — ${input.verdict}`,
    content: input.notes?.trim() || null,
    meta: { kind: "audit", verdict: input.verdict },
    userId: actor.userId,
    userEmail: actor.email ?? null,
  });

  const campaignAccuracy = row.campaign_id ? await refreshCampaignAccuracy(supabase, row.campaign_id) : null;
  return { ok: true as const, campaignAccuracy };
}
