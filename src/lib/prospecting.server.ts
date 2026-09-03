/**
 * Outbound prospecting data access — server-only.
 *
 * Prospects are kept strictly separate from the inbound CRM (`consultations`)
 * until a human approves the handoff. Every function receives the caller's
 * Supabase client, so RLS applies as the signed-in user.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  DEFAULT_ICP_CONFIG,
  ICP_CONFIG_KEY,
  mergeIcpConfig,
  normalizeDomain,
  normalizeEmail,
  normalizeWhatsapp,
  scoreProspect,
  type IcpConfig,
  type ProspectActivityAction,
  type ProspectStatus,
} from "@/lib/admin/prospecting";

type Client = SupabaseClient<Database>;

export const PROSPECT_LIST_COLUMNS =
  "id, created_at, updated_at, business_name, industry, city, website, website_domain, contact_name, contact_title, contact_email, contact_whatsapp, contact_phone, social_media, source, source_detail, status, status_updated_at, fit_score, fit_tier, do_not_contact, outreach_channel, contacted_at, replied_at, next_follow_up_at, follow_up_count, lead_id, converted_at, owner_name, campaign_id, business_summary, business_profile, industry_fit, opportunity_reason, recommended_solution, sales_approach, potential_need, business_problem, buying_signal, decision_maker, sales_priority, research_summary, last_contact_at, verified";

export type ProspectListRow = {
  id: string;
  created_at: string;
  updated_at: string;
  business_name: string;
  industry: string | null;
  city: string | null;
  website: string | null;
  website_domain: string | null;
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  contact_whatsapp: string | null;
  contact_phone: string | null;
  social_media: string | null;
  source: string;
  source_detail: string | null;
  status: string;
  status_updated_at: string | null;
  fit_score: number;
  fit_tier: string;
  do_not_contact: boolean;
  outreach_channel: string | null;
  contacted_at: string | null;
  replied_at: string | null;
  next_follow_up_at: string | null;
  follow_up_count: number;
  lead_id: string | null;
  converted_at: string | null;
  owner_name: string | null;
  campaign_id: string | null;
  business_summary: string | null;
  business_profile: string | null;
  industry_fit: string | null;
  opportunity_reason: string | null;
  recommended_solution: string | null;
  sales_approach: string | null;
  potential_need: string | null;
  business_problem: string | null;
  buying_signal: string | null;
  decision_maker: string | null;
  sales_priority: string | null;
  research_summary: string | null;
  last_contact_at: string | null;
  verified: boolean;
};

/* --------------------------------- ICP ------------------------------------ */

export async function fetchIcpConfig(supabase: Client): Promise<IcpConfig> {
  const { data, error } = await supabase
    .from("prospect_icp_config")
    .select("config")
    .eq("key", ICP_CONFIG_KEY)
    .maybeSingle();
  if (error) return DEFAULT_ICP_CONFIG;
  return mergeIcpConfig(data?.config);
}

export async function saveIcpConfig(
  supabase: Client,
  config: IcpConfig,
  userId: string,
): Promise<{ ok: true }> {
  const { error } = await supabase.from("prospect_icp_config").upsert(
    {
      key: ICP_CONFIG_KEY,
      label: "Ideal Customer Profile",
      description: "Aturan ICP dan bobot skor untuk outbound prospecting.",
      config: config as never,
      updated_by: userId,
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* ------------------------------ Activities -------------------------------- */

export async function logProspectActivity(
  supabase: Client,
  entry: {
    prospectId: string;
    action: ProspectActivityAction;
    label?: string | null;
    content?: string | null;
    meta?: Record<string, unknown>;
    userId?: string | null;
    userEmail?: string | null;
  },
): Promise<void> {
  // Observability must never break the main flow.
  await supabase
    .from("prospect_activities")
    .insert({
      prospect_id: entry.prospectId,
      action: entry.action,
      label: entry.label ?? null,
      content: entry.content ?? null,
      meta: (entry.meta ?? {}) as never,
      created_by: entry.userId ?? null,
      created_by_email: entry.userEmail ?? null,
    })
    .then(
      () => undefined,
      () => undefined,
    );
}

/* -------------------------------- Reads ----------------------------------- */

export async function fetchProspects(
  supabase: Client,
  filters?: {
    status?: string;
    search?: string;
    tier?: string;
    limit?: number;
    campaignId?: string;
    actionableOnly?: boolean;
  },
): Promise<ProspectListRow[]> {
  let query = supabase
    .from("prospects")
    .select(PROSPECT_LIST_COLUMNS)
    .order("fit_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(filters?.limit ?? 300);

  if (filters?.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters?.tier && filters.tier !== "all") query = query.eq("fit_tier", filters.tier);
  if (filters?.campaignId && filters.campaignId !== "all")
    query = query.eq("campaign_id", filters.campaignId);
  if (filters?.actionableOnly)
    query = query.or(
      "contact_email.not.is.null,contact_whatsapp.not.is.null,contact_phone.not.is.null,website.not.is.null",
    );

  if (filters?.search) {
    const term = filters.search.replace(/[%,()]/g, " ").trim();
    if (term)
      query = query.or(
        `business_name.ilike.%${term}%,industry.ilike.%${term}%,city.ilike.%${term}%,contact_name.ilike.%${term}%,contact_email.ilike.%${term}%`,
      );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProspectListRow[];
}

export async function fetchProspect(supabase: Client, id: string) {
  const { data, error } = await supabase.from("prospects").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Prospek tidak ditemukan.");

  const { data: activities } = await supabase
    .from("prospect_activities")
    .select("id, action, label, content, created_at, created_by_email")
    .eq("prospect_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  return { prospect: data, activities: activities ?? [] };
}

/* -------------------------------- Writes ---------------------------------- */

export type ProspectInput = {
  businessName: string;
  industry?: string | null;
  city?: string | null;
  website?: string | null;
  contactName?: string | null;
  contactTitle?: string | null;
  contactEmail?: string | null;
  contactWhatsapp?: string | null;
  source?: string | null;
  sourceDetail?: string | null;
  discoveryQuery?: string | null;
  researchSummary?: string | null;
  evidence?: string[];
  painSignals?: string[];
  notes?: string | null;
  ownerName?: string | null;
  contactPhone?: string | null;
  socialMedia?: string | null;
  campaignId?: string | null;
  businessSummary?: string | null;
  businessProfile?: string | null;
  industryFit?: string | null;
  opportunityReason?: string | null;
  recommendedSolution?: string | null;
  salesApproach?: string | null;
  potentialNeed?: string | null;
  businessProblem?: string | null;
  buyingSignal?: string | null;
  decisionMaker?: string | null;
  salesPriority?: string | null;
  verified?: boolean;
};

/** Returns the existing prospect id when the identity already exists. */
export async function findDuplicate(
  supabase: Client,
  identity: { domain?: string | null; email?: string | null; whatsapp?: string | null },
): Promise<string | null> {
  const clauses: string[] = [];
  if (identity.domain) clauses.push(`website_domain.eq.${identity.domain}`);
  if (identity.email) clauses.push(`contact_email.eq.${identity.email}`);
  if (identity.whatsapp) clauses.push(`contact_whatsapp.eq.${identity.whatsapp}`);
  if (!clauses.length) return null;
  const { data } = await supabase.from("prospects").select("id").or(clauses.join(",")).limit(1);
  return data?.[0]?.id ?? null;
}

export async function createProspect(
  supabase: Client,
  input: ProspectInput,
  actor: { userId: string; email?: string | null },
): Promise<{ status: "created" | "duplicate"; id: string; fitScore: number }> {
  const config = await fetchIcpConfig(supabase);
  const domain = normalizeDomain(input.website);
  const email = normalizeEmail(input.contactEmail);
  const whatsapp = normalizeWhatsapp(input.contactWhatsapp);

  const duplicate = await findDuplicate(supabase, { domain, email, whatsapp });
  if (duplicate) return { status: "duplicate", id: duplicate, fitScore: 0 };

  const scored = scoreProspect(
    {
      business_name: input.businessName,
      industry: input.industry,
      city: input.city,
      website: input.website,
      contact_email: email,
      contact_whatsapp: whatsapp,
      contact_name: input.contactName,
      research_summary: input.researchSummary,
      pain_signals: input.painSignals ?? [],
      evidence: input.evidence ?? [],
    },
    config,
  );

  const { data, error } = await supabase
    .from("prospects")
    .insert({
      business_name: input.businessName.trim().slice(0, 200),
      industry: input.industry?.trim() || null,
      city: input.city?.trim() || null,
      website: input.website?.trim() || null,
      website_domain: domain,
      contact_name: input.contactName?.trim() || null,
      contact_title: input.contactTitle?.trim() || null,
      contact_email: email,
      contact_whatsapp: whatsapp,
      contact_phone: input.contactPhone?.trim() || null,
      social_media: input.socialMedia?.trim() || null,
      source: input.source?.trim() || "manual",
      source_detail: input.sourceDetail?.trim() || null,
      discovery_query: input.discoveryQuery?.trim() || null,
      research_summary: input.researchSummary?.slice(0, 4000) || null,
       business_summary: input.businessSummary?.slice(0, 2000) || null,
       business_profile: input.businessProfile?.slice(0, 2000) || null,
       industry_fit: input.industryFit?.slice(0, 1000) || null,
       opportunity_reason: input.opportunityReason?.slice(0, 2000) || null,
       recommended_solution: input.recommendedSolution?.slice(0, 1000) || null,
       sales_approach: input.salesApproach?.slice(0, 2000) || null,
       potential_need: input.potentialNeed?.slice(0, 1000) || null,
       business_problem: input.businessProblem?.slice(0, 1000) || null,
       buying_signal: input.buyingSignal?.slice(0, 1000) || null,
       decision_maker: input.decisionMaker?.slice(0, 300) || null,
       sales_priority: input.salesPriority?.slice(0, 20) || null,
      evidence: (input.evidence ?? []) as never,
      pain_signals: (input.painSignals ?? []) as never,
      fit_score: scored.total,
      fit_tier: scored.tier,
      fit_breakdown: scored.factors as never,
      status: input.researchSummary ? "researched" : "new",
      notes: input.notes?.slice(0, 4000) || null,
      owner_name: input.ownerName?.trim() || null,
      campaign_id: input.campaignId ?? null,
      verified: input.verified ?? false,
      created_by: actor.userId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logProspectActivity(supabase, {
    prospectId: data.id,
    action: "score",
    label: `Skor ICP ${scored.total}/${scored.max} (${scored.tier})`,
    content: scored.factors
      .map((factor) => `${factor.label}: ${factor.score}/${factor.max} — ${factor.detail}`)
      .join("\n"),
    userId: actor.userId,
    userEmail: actor.email ?? null,
  });

  return { status: "created", id: data.id, fitScore: scored.total };
}

export async function updateProspect(
  supabase: Client,
  id: string,
  patch: Partial<ProspectInput> & { status?: ProspectStatus },
  actor: { userId: string; email?: string | null },
) {
  const update: Record<string, unknown> = {};
  if (patch.businessName !== undefined)
    update.business_name = patch.businessName.trim().slice(0, 200);
  if (patch.industry !== undefined) update.industry = patch.industry?.trim() || null;
  if (patch.city !== undefined) update.city = patch.city?.trim() || null;
  if (patch.website !== undefined) {
    update.website = patch.website?.trim() || null;
    update.website_domain = normalizeDomain(patch.website);
  }
  if (patch.contactName !== undefined) update.contact_name = patch.contactName?.trim() || null;
  if (patch.contactTitle !== undefined) update.contact_title = patch.contactTitle?.trim() || null;
  if (patch.contactEmail !== undefined) update.contact_email = normalizeEmail(patch.contactEmail);
  if (patch.contactWhatsapp !== undefined)
    update.contact_whatsapp = normalizeWhatsapp(patch.contactWhatsapp);
  if (patch.contactPhone !== undefined) update.contact_phone = patch.contactPhone?.trim() || null;
  if (patch.socialMedia !== undefined) update.social_media = patch.socialMedia?.trim() || null;
  if (patch.campaignId !== undefined) update.campaign_id = patch.campaignId;
  if (patch.businessSummary !== undefined)
    update.business_summary = patch.businessSummary?.slice(0, 2000) || null;
  if (patch.opportunityReason !== undefined)
    update.opportunity_reason = patch.opportunityReason?.slice(0, 2000) || null;
  if (patch.recommendedSolution !== undefined)
    update.recommended_solution = patch.recommendedSolution?.slice(0, 1000) || null;
  if (patch.salesApproach !== undefined)
    update.sales_approach = patch.salesApproach?.slice(0, 2000) || null;
  if (patch.potentialNeed !== undefined)
    update.potential_need = patch.potentialNeed?.slice(0, 1000) || null;
  if (patch.businessProblem !== undefined)
    update.business_problem = patch.businessProblem?.slice(0, 1000) || null;
  if (patch.buyingSignal !== undefined)
    update.buying_signal = patch.buyingSignal?.slice(0, 1000) || null;
  if (patch.decisionMaker !== undefined)
    update.decision_maker = patch.decisionMaker?.slice(0, 300) || null;
  if (patch.verified !== undefined) update.verified = patch.verified;
  if (patch.researchSummary !== undefined)
    update.research_summary = patch.researchSummary?.slice(0, 4000) || null;
  if (patch.evidence !== undefined) update.evidence = patch.evidence;
  if (patch.painSignals !== undefined) update.pain_signals = patch.painSignals;
  if (patch.notes !== undefined) update.notes = patch.notes?.slice(0, 4000) || null;
  if (patch.ownerName !== undefined) update.owner_name = patch.ownerName?.trim() || null;
  if (patch.status) {
    update.status = patch.status;
    update.status_updated_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("prospects")
    .update(update as never)
    .eq("id", id);
  if (error) throw new Error(error.message);

  await logProspectActivity(supabase, {
    prospectId: id,
    action: patch.status ? "status" : "note",
    label: patch.status ? `Status → ${patch.status}` : "Data prospek diperbarui",
    userId: actor.userId,
    userEmail: actor.email ?? null,
  });

  return rescoreProspect(supabase, id, actor);
}

/** Recomputes the deterministic ICP score from current row data. */
export async function rescoreProspect(
  supabase: Client,
  id: string,
  actor: { userId: string; email?: string | null },
) {
  const config = await fetchIcpConfig(supabase);
  const { data, error } = await supabase
    .from("prospects")
    .select(
      "business_name, industry, city, website, contact_email, contact_whatsapp, contact_name, research_summary, pain_signals, evidence",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "Prospek tidak ditemukan.");

  const scored = scoreProspect(data, config);
  const { error: updateError } = await supabase
    .from("prospects")
    .update({
      fit_score: scored.total,
      fit_tier: scored.tier,
      fit_breakdown: scored.factors as never,
      ...(scored.disqualified
        ? { do_not_contact: true, do_not_contact_reason: scored.disqualifyReason ?? null }
        : {}),
    })
    .eq("id", id);
  if (updateError) throw new Error(updateError.message);

  await logProspectActivity(supabase, {
    prospectId: id,
    action: "score",
    label: `Skor ICP ${scored.total}/${scored.max} (${scored.tier})`,
    userId: actor.userId,
    userEmail: actor.email ?? null,
  });

  return { ok: true as const, fit: scored };
}

/** Human-approved outreach draft. Nothing is ever sent automatically. */
export async function saveOutreachDraft(
  supabase: Client,
  input: {
    id: string;
    channel: string;
    subject?: string | null;
    draft: string;
    approve: boolean;
  },
  actor: { userId: string; email?: string | null },
) {
  const { data: current } = await supabase
    .from("prospects")
    .select("do_not_contact")
    .eq("id", input.id)
    .maybeSingle();
  if (current?.do_not_contact) throw new Error("Prospek ditandai DO_NOT_CONTACT.");

  const { error } = await supabase
    .from("prospects")
    .update({
      outreach_channel: input.channel,
      outreach_subject: input.subject?.slice(0, 200) ?? null,
      outreach_draft: input.draft.slice(0, 8000),
      status: input.approve ? "approved" : "ready",
      status_updated_at: new Date().toISOString(),
      ...(input.approve
        ? { approved_by: actor.userId, approved_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);

  await logProspectActivity(supabase, {
    prospectId: input.id,
    action: input.approve ? "approval" : "draft",
    label: input.approve ? `Disetujui untuk ${input.channel}` : `Draft ${input.channel} disimpan`,
    content: input.draft.slice(0, 4000),
    userId: actor.userId,
    userEmail: actor.email ?? null,
  });

  return { ok: true as const };
}

export async function recordOutreach(
  supabase: Client,
  input: {
    id: string;
    event: "sent" | "reply" | "no_reply";
    note?: string | null;
    followUpInDays?: number | null;
  },
  actor: { userId: string; email?: string | null },
) {
  const now = new Date().toISOString();
  const { data: current } = await supabase
    .from("prospects")
    .select("follow_up_count, do_not_contact")
    .eq("id", input.id)
    .maybeSingle();
  if (current?.do_not_contact) throw new Error("Prospek ditandai DO_NOT_CONTACT.");

  const nextFollowUp =
    input.followUpInDays && input.followUpInDays > 0
      ? new Date(Date.now() + input.followUpInDays * 86_400_000).toISOString()
      : null;

  const update: Record<string, unknown> = {
    status_updated_at: now,
    next_follow_up_at: nextFollowUp,
  };
  if (input.event === "sent") {
    update.status = "contacted";
    update.contacted_at = now;
    update.last_contact_at = now;
    update.follow_up_count = (current?.follow_up_count ?? 0) + 1;
  } else if (input.event === "reply") {
    update.status = "replied";
    update.replied_at = now;
    update.last_contact_at = now;
  }

  const { error } = await supabase
    .from("prospects")
    .update(update as never)
    .eq("id", input.id);
  if (error) throw new Error(error.message);

  await logProspectActivity(supabase, {
    prospectId: input.id,
    action: input.event === "reply" ? "reply" : "sent",
    label:
      input.event === "sent"
        ? "Outreach dikirim (manual)"
        : input.event === "reply"
          ? "Prospek membalas"
          : "Belum ada balasan",
    content: input.note ?? null,
    userId: actor.userId,
    userEmail: actor.email ?? null,
  });

  return { ok: true as const };
}

export async function setDoNotContact(
  supabase: Client,
  input: { id: string; enabled: boolean; reason?: string | null },
  actor: { userId: string; email?: string | null },
) {
  const { error } = await supabase
    .from("prospects")
    .update({
      do_not_contact: input.enabled,
      do_not_contact_reason: input.enabled ? (input.reason?.slice(0, 500) ?? null) : null,
      next_follow_up_at: input.enabled ? null : undefined,
      ...(input.enabled
        ? { status: "do_not_contact", status_updated_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);

  await logProspectActivity(supabase, {
    prospectId: input.id,
    action: "status",
    label: input.enabled ? "DO_NOT_CONTACT diaktifkan" : "DO_NOT_CONTACT dicabut",
    content: input.reason ?? null,
    userId: actor.userId,
    userEmail: actor.email ?? null,
  });

  return { ok: true as const };
}

export async function setProspectFollowUp(
  supabase: Client,
  input: { id: string; date: string | null },
  actor: { userId: string; email?: string | null },
) {
  const { error } = await supabase
    .from("prospects")
    .update({ next_follow_up_at: input.date })
    .eq("id", input.id);
  if (error) throw new Error(error.message);

  await logProspectActivity(supabase, {
    prospectId: input.id,
    action: "note",
    label: input.date ? "Follow-up dijadwalkan" : "Jadwal follow-up dihapus",
    content: input.date,
    userId: actor.userId,
    userEmail: actor.email ?? null,
  });

  return { ok: true as const };
}

export async function addProspectNote(
  supabase: Client,
  input: { id: string; note: string },
  actor: { userId: string; email?: string | null },
) {
  await logProspectActivity(supabase, {
    prospectId: input.id,
    action: "note",
    label: "Catatan sales",
    content: input.note.slice(0, 2000),
    userId: actor.userId,
    userEmail: actor.email ?? null,
  });

  return { ok: true as const };
}

/**
 * Handoff to the inbound CRM. Only happens after a real signal (reply or
 * explicit human decision) — the prospect row stays as the outbound record.
 */
export async function convertProspectToLead(
  supabase: Client,
  input: {
    id: string;
    projectType?: string;
    requirement?: string;
    budget?: string;
    timeline?: string;
  },
  actor: { userId: string; email?: string | null },
) {
  const { data: prospect, error } = await supabase
    .from("prospects")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();
  if (error || !prospect) throw new Error(error?.message ?? "Prospek tidak ditemukan.");
  if (prospect.lead_id)
    return { ok: true as const, leadId: prospect.lead_id, alreadyConverted: true };
  if (prospect.do_not_contact) throw new Error("Prospek ditandai DO_NOT_CONTACT.");
  const contactWhatsapp = prospect.contact_whatsapp || prospect.contact_phone || "";
  if (!prospect.contact_email && !contactWhatsapp)
    throw new Error("Butuh minimal satu kanal kontak sebelum handoff ke CRM.");

  const { data: lead, error: leadError } = await supabase
    .from("consultations")
    .insert({
      name: prospect.contact_name || prospect.business_name,
      email: prospect.contact_email || "",
      whatsapp: contactWhatsapp,
      company: prospect.business_name,
      business_name: prospect.business_name,
      project_type: input.projectType || prospect.recommended_solution || "Belum ditentukan",
      requirement:
        input.requirement ||
        prospect.opportunity_reason ||
        prospect.research_summary ||
        "Prospek outbound — kebutuhan belum digali, jadwalkan sesi konsultasi.",
      budget: input.budget || "Belum dibahas",
      timeline: input.timeline || "Belum dibahas",
      status: "contacted",
      lead_source: "outbound",
      visitor_source: prospect.source,
      lead_score: prospect.fit_score,
      lead_temperature: prospect.fit_tier === "high" ? "warm" : "cold",
      admin_notes: [
        `Handoff dari outbound prospecting (skor ICP ${prospect.fit_score}).`,
        prospect.opportunity_reason ? `Peluang: ${prospect.opportunity_reason}` : null,
        prospect.recommended_solution ? `Solusi: ${prospect.recommended_solution}` : null,
        prospect.notes ? `Catatan: ${prospect.notes}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    })
    .select("id")
    .single();
  if (leadError) throw new Error(leadError.message);

  await supabase
    .from("prospects")
    .update({
      lead_id: lead.id,
      status: "converted",
      status_updated_at: new Date().toISOString(),
      converted_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  await logProspectActivity(supabase, {
    prospectId: input.id,
    action: "handoff",
    label: "Dikonversi menjadi lead CRM",
    userId: actor.userId,
    userEmail: actor.email ?? null,
  });

  return { ok: true as const, leadId: lead.id, alreadyConverted: false };
}

/* ------------------------------- Reporting -------------------------------- */

export type ProspectingSummary = {
  days: number;
  total: number;
  byStatus: Record<string, number>;
  byTier: Record<string, number>;
  bySource: { label: string; value: number }[];
  contacted: number;
  replied: number;
  converted: number;
  replyRate: number;
  conversionRate: number;
  doNotContact: number;
  dueFollowUps: number;
  readyForApproval: number;
  actionable: number;
  followUpsToday: number;
  messagesPrepared: number;
  meetings: number;
  deals: number;
  lost: number;
};

export async function buildProspectingSummary(
  supabase: Client,
  days = 30,
): Promise<ProspectingSummary | null> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("prospects")
    .select(
      "status, fit_tier, source, do_not_contact, next_follow_up_at, created_at, contact_email, contact_whatsapp, contact_phone, website, outreach_draft",
    )
    .gte("created_at", since)
    .limit(2000);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (!rows.length) return null;

  const byStatus: Record<string, number> = {};
  const byTier: Record<string, number> = {};
  const sources = new Map<string, number>();
  let doNotContact = 0;
  let dueFollowUps = 0;
  let actionable = 0;
  let messagesPrepared = 0;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    byTier[row.fit_tier] = (byTier[row.fit_tier] ?? 0) + 1;
    sources.set(row.source, (sources.get(row.source) ?? 0) + 1);
    if (row.do_not_contact) doNotContact += 1;
    if (
      !row.do_not_contact &&
      (row.contact_email || row.contact_whatsapp || row.contact_phone || row.website)
    )
      actionable += 1;
    if (row.outreach_draft) messagesPrepared += 1;
    if (row.next_follow_up_at && new Date(row.next_follow_up_at).getTime() <= now.getTime())
      dueFollowUps += 1;
  }

  const contacted =
    (byStatus.contacted ?? 0) +
    (byStatus.replied ?? 0) +
    (byStatus.meeting ?? 0) +
    (byStatus.negotiation ?? 0) +
    (byStatus.deal ?? 0) +
    (byStatus.converted ?? 0);
  const replied =
    (byStatus.replied ?? 0) +
    (byStatus.meeting ?? 0) +
    (byStatus.negotiation ?? 0) +
    (byStatus.deal ?? 0) +
    (byStatus.converted ?? 0);
  const converted = byStatus.converted ?? 0;

  return {
    days,
    total: rows.length,
    byStatus,
    byTier,
    bySource: [...sources.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    contacted,
    replied,
    converted,
    replyRate: contacted ? Math.round((replied / contacted) * 100) : 0,
    conversionRate: contacted ? Math.round((converted / contacted) * 100) : 0,
    doNotContact,
    dueFollowUps,
    readyForApproval: byStatus.ready ?? 0,
    actionable,
    followUpsToday: rows.filter(
      (row) => row.next_follow_up_at?.slice(0, 10) === today && !row.do_not_contact,
    ).length,
    messagesPrepared,
    meetings: byStatus.meeting ?? 0,
    deals: byStatus.deal ?? 0,
    lost: byStatus.lost ?? 0,
  };
}

/* --------------------------- Outbound follow-up scan ---------------------- */

export type ProspectScanResult = { followUps: number; staleReady: number; scanned: number };

/**
 * Periodic pass for outbound: reminds on due follow-ups and on prospects that
 * stay "ready" without human approval. Never sends outreach — it only creates
 * internal tasks, so a human always stays in the loop. Deduped by prospect.
 */
export async function scanProspectFollowUps(): Promise<ProspectScanResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin;
  const now = new Date();
  const result: ProspectScanResult = { followUps: 0, staleReady: 0, scanned: 0 };

  async function ensureTask(entry: {
    ruleKey: string;
    kind: string;
    prospectId: string;
    title: string;
    detail: string;
    priority: "urgent" | "high" | "normal";
  }): Promise<boolean> {
    const { data: existing } = await db
      .from("automation_tasks")
      .select("id, meta")
      .eq("rule_key", entry.ruleKey)
      .eq("kind", entry.kind)
      .eq("status", "pending")
      .contains("meta", { prospect_id: entry.prospectId } as never)
      .limit(1)
      .maybeSingle();
    if (existing) return false;
    const { error } = await db.from("automation_tasks").insert({
      rule_key: entry.ruleKey,
      kind: entry.kind,
      title: entry.title.slice(0, 200),
      detail: entry.detail.slice(0, 2000),
      status: "pending",
      priority: entry.priority,
      due_at: now.toISOString(),
      meta: { prospect_id: entry.prospectId, source: "outbound_scan" } as never,
    });
    return !error;
  }

  const { data: due } = await db
    .from("prospects")
    .select("id, business_name, next_follow_up_at, follow_up_count, status")
    .eq("do_not_contact", false)
    .not("next_follow_up_at", "is", null)
    .lte("next_follow_up_at", now.toISOString())
    .in("status", ["contacted", "approved", "replied"])
    .limit(200);

  for (const row of due ?? []) {
    result.scanned += 1;
    const ok = await ensureTask({
      ruleKey: "outbound.follow_up_reminder",
      kind: "outbound_follow_up",
      prospectId: row.id,
      title: `Follow-up outbound: ${row.business_name}`,
      detail: `Jadwal follow-up ${row.next_follow_up_at}. Follow-up ke-${(row.follow_up_count ?? 0) + 1}. Kirim manual setelah dicek.`,
      priority: "high",
    });
    if (ok) result.followUps += 1;
  }

  const staleSince = new Date(now.getTime() - 3 * 86_400_000).toISOString();
  const { data: stale } = await db
    .from("prospects")
    .select("id, business_name, status_updated_at, fit_tier")
    .eq("status", "ready")
    .eq("do_not_contact", false)
    .lte("status_updated_at", staleSince)
    .limit(200);

  for (const row of stale ?? []) {
    result.scanned += 1;
    const ok = await ensureTask({
      ruleKey: "outbound.stale_ready_alert",
      kind: "outbound_approval",
      prospectId: row.id,
      title: `Menunggu approval outreach: ${row.business_name}`,
      detail: `Prospek berstatus "ready" (fit ${row.fit_tier}) sejak ${row.status_updated_at}. Setujui atau tolak.`,
      priority: "normal",
    });
    if (ok) result.staleReady += 1;
  }

  return result;
}
