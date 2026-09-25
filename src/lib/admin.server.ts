/**
 * Admin (Business OS) data access — server-only.
 *
 * Every function receives an authenticated Supabase client (RLS as the signed-in
 * user). Admin-only rows are additionally protected by RLS policies that call
 * public.has_role(auth.uid(), 'admin').
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeStage, type PipelineStage } from "@/lib/admin/pipeline";
import {
  canManageBusiness,
  canWorkLeads,
  highestRole,
  type WorkspaceRole,
} from "@/lib/admin/roles";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export const LEAD_LIST_COLUMNS =
  "id, created_at, name, email, whatsapp, company, business_name, project_type, budget, timeline, status, status_updated_at, lead_score, lead_temperature, lead_source, visitor_source, utm_source, utm_campaign, ai_recommended_package, ai_business_category, ai_lead_score, ai_qualification_status, ai_complexity, archived_at";

export type LeadListRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  whatsapp: string;
  company: string | null;
  business_name: string | null;
  project_type: string;
  budget: string;
  timeline: string;
  status: string;
  status_updated_at: string | null;
  lead_score: number;
  lead_temperature: string;
  lead_source: string;
  visitor_source: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  ai_recommended_package: string | null;
  ai_business_category: string | null;
  ai_lead_score: number;
  ai_qualification_status: string | null;
  ai_complexity: string | null;
  archived_at: string | null;
};

/** Roles held by the signed-in user (RLS lets users read their own rows). */
export async function fetchUserRole(supabase: Client, userId: string): Promise<WorkspaceRole | null> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Tidak dapat memverifikasi akses workspace.");
  return highestRole((data ?? []).map((row) => String(row.role)));
}

/** Any workspace role (owner/admin/sales/viewer) — read access. */
export async function assertWorkspace(supabase: Client, userId: string): Promise<WorkspaceRole> {
  const role = await fetchUserRole(supabase, userId);
  if (!role) throw new Error("Forbidden: akses workspace diperlukan.");
  return role;
}

/** Owner/Admin/Sales — may edit leads and sales artefacts. */
export async function assertLeadWork(supabase: Client, userId: string): Promise<WorkspaceRole> {
  const role = await assertWorkspace(supabase, userId);
  if (!canWorkLeads(role)) throw new Error("Forbidden: akses sales diperlukan.");
  return role;
}

/** Owner/Admin — may manage business data and the team. */
export async function assertManage(supabase: Client, userId: string): Promise<WorkspaceRole> {
  const role = await assertWorkspace(supabase, userId);
  if (!canManageBusiness(role)) throw new Error("Forbidden: akses admin diperlukan.");
  return role;
}

/* ------------------------------- Team members ----------------------------- */

export async function fetchWorkspaceMembers(supabase: Client) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("id, email, role, created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addWorkspaceMember(
  supabase: Client,
  input: { email: string; role: WorkspaceRole; invitedBy: string },
) {
  const { error } = await supabase.from("workspace_members").upsert(
    { email: input.email.trim().toLowerCase(), role: input.role, invited_by: input.invitedBy },
    { onConflict: "email" },
  );
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function removeWorkspaceMember(supabase: Client, id: string) {
  const { error } = await supabase.from("workspace_members").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}


export async function fetchLeads(supabase: Client): Promise<LeadListRow[]> {
  const { data, error } = await supabase
    .from("consultations")
    .select(LEAD_LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LeadListRow[];
}

export async function fetchLead(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("consultations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function setLeadStage(supabase: Client, id: string, stage: PipelineStage) {
  const { error } = await supabase
    .from("consultations")
    .update({ status: normalizeStage(stage), status_updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const { data: lead } = await supabase
    .from("consultations")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  const { runAutomation } = await import("@/lib/automation.server");
  await runAutomation({
    type: "lead.status_changed",
    leadId: id,
    name: lead?.name ?? "Lead",
    status: normalizeStage(stage),
  });

  return { ok: true as const };
}

/** Archive / restore a lead without deleting any data. */
export async function setLeadArchived(supabase: Client, id: string, archived: boolean) {
  const { error } = await supabase
    .from("consultations")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const, archived };
}

/** Permanently delete a lead and every record attached to it. */
export async function purgeLead(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as {
    from: (table: string) => {
      delete: () => { eq: (col: string, value: string) => Promise<{ error: { message: string } | null }> };
      update: (values: Record<string, unknown>) => {
        eq: (col: string, value: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };

  const guard = supabaseAdmin as unknown as {
    from: (table: string) => {
      select: (cols: string, opts: { count: "exact"; head: true }) => {
        eq: (col: string, value: string) => Promise<{ count: number | null }>;
      };
    };
  };
  for (const [table, label] of [
    ["proposals", "proposal"],
    ["invoices", "invoice"],
  ] as const) {
    const { count } = await guard.from(table).select("id", { count: "exact", head: true }).eq("lead_id", id);
    if ((count ?? 0) > 0) {
      throw new Error(`Lead tidak bisa dihapus: masih ada ${label} terkait. Hapus ${label} terlebih dahulu.`);
    }
  }

  // Children first, then loose references, then the lead itself.
  for (const table of [
    "conversation_requirements",
    "lead_ai_activities",
    "automation_tasks",
  ]) {
    const { error } = await db.from(table).delete().eq("lead_id", id);
    if (error) throw new Error(error.message);
  }
  for (const table of ["ai_conversations", "clients"]) {
    const { error } = await db.from(table).update({ lead_id: null }).eq("lead_id", id);
    if (error) throw new Error(error.message);
  }
  const { error: delError } = await db.from("consultations").delete().eq("id", id);
  if (delError) throw new Error(delError.message);
  return { ok: true as const };
}

export async function setLeadNotes(supabase: Client, id: string, notes: string) {
  const { error } = await supabase
    .from("consultations")
    .update({ admin_notes: notes })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export type PriorityLead = LeadListRow & { staleDays: number; reason: string };

/**
 * Leads that need action today: still open in the pipeline, ranked by
 * temperature, score and how long they have been sitting in their stage.
 */
export function buildPriorityInbox(rows: LeadListRow[]): PriorityLead[] {
  const now = Date.now();
  const open = rows.filter((row) => {
    const stage = normalizeStage(row.status);
    return stage !== "Completed" && stage !== "Closed";
  });

  return open
    .map((row) => {
      const last = new Date(row.status_updated_at ?? row.created_at).getTime();
      const staleDays = Math.max(0, Math.floor((now - last) / 86_400_000));
      const hot = row.lead_temperature === "Hot Lead";
      const warm = row.lead_temperature === "Warm Lead";
      const weight =
        (hot ? 120 : warm ? 60 : 10) + (row.lead_score ?? 0) + Math.min(staleDays, 30) * 4;
      const reason = hot
        ? "Hot lead — hubungi hari ini"
        : staleDays >= 3
          ? `Tidak ada update ${staleDays} hari`
          : normalizeStage(row.status) === "New Lead"
            ? "Lead baru belum dikontak"
            : "Perlu follow up";
      return { ...row, staleDays, reason, weight };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6)
    .map(({ weight: _weight, ...lead }) => lead);
}

export type AdminOverview = {

  totalLeads: number;
  hot: number;
  warm: number;
  cold: number;
  aiLeads: number;
  aiConversionRate: number;
  averageScore: number;
  stageCounts: { stage: string; count: number }[];
  sources: { source: string; count: number }[];
  packages: { name: string; count: number }[];
  categories: { name: string; count: number }[];
  monthly: { month: string; leads: number; hot: number }[];
  recent: LeadListRow[];
  priority: PriorityLead[];

};

export function buildOverview(rows: LeadListRow[]): AdminOverview {
  const counts = new Map<string, number>();
  const sources = new Map<string, number>();
  const packages = new Map<string, number>();
  const categories = new Map<string, number>();
  const monthly = new Map<string, { leads: number; hot: number }>();
  let hot = 0;
  let warm = 0;
  let cold = 0;
  let aiLeads = 0;
  let scoreTotal = 0;

  for (const row of rows) {
    const stage = normalizeStage(row.status);
    counts.set(stage, (counts.get(stage) ?? 0) + 1);

    if (row.lead_temperature === "Hot Lead") hot += 1;
    else if (row.lead_temperature === "Warm Lead") warm += 1;
    else cold += 1;

    const source = row.lead_source === "ai_consultant" ? "AI Consultant" : "Manual Form";
    sources.set(source, (sources.get(source) ?? 0) + 1);
    if (row.lead_source === "ai_consultant") aiLeads += 1;

    if (row.ai_recommended_package) {
      packages.set(row.ai_recommended_package, (packages.get(row.ai_recommended_package) ?? 0) + 1);
    }
    if (row.ai_business_category) {
      categories.set(row.ai_business_category, (categories.get(row.ai_business_category) ?? 0) + 1);
    }

    scoreTotal += row.lead_score ?? 0;

    const month = row.created_at.slice(0, 7);
    const bucket = monthly.get(month) ?? { leads: 0, hot: 0 };
    bucket.leads += 1;
    if (row.lead_temperature === "Hot Lead") bucket.hot += 1;
    monthly.set(month, bucket);
  }

  const sortDesc = (map: Map<string, number>) =>
    [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  return {
    totalLeads: rows.length,
    hot,
    warm,
    cold,
    aiLeads,
    aiConversionRate: rows.length ? Number(((aiLeads / rows.length) * 100).toFixed(1)) : 0,
    averageScore: rows.length ? Number((scoreTotal / rows.length).toFixed(1)) : 0,
    stageCounts: [...counts.entries()].map(([stage, count]) => ({ stage, count })),
    sources: sortDesc(sources).map((s) => ({ source: s.name, count: s.count })),
    packages: sortDesc(packages),
    categories: sortDesc(categories),
    monthly: [...monthly.entries()]
      .map(([month, value]) => ({ month, leads: value.leads, hot: value.hot }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12),
    recent: rows.slice(0, 8),
    priority: buildPriorityInbox(rows),

  };
}

/* ---------------------------------------------------------------------------
 * Proposals (AI Proposal Generator + management)
 * ------------------------------------------------------------------------ */

import {
  buildProposalSections,
  buildPricingItems,
  recommendPackage,
  buildSalesBrief,
  type PricingItem,
  type ProposalStatus,
} from "@/lib/admin/sales-ai";

export const PROPOSAL_COLUMNS =
  "id, lead_id, title, status, recommended_package, content, pricing_items, currency, valid_until, version, client_name, investment_note, payment_type, payment_dp_percent, payment_terms_text, sent_at, viewed_at, approved_at, rejected_at, created_at, updated_at";

export async function fetchProposals(supabase: Client, leadId?: string) {
  let query = supabase
    .from("proposals")
    .select(PROPOSAL_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(300);
  if (leadId) query = query.eq("lead_id", leadId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchProposal(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchProposalVersions(supabase: Client, proposalId: string) {
  const { data, error } = await supabase
    .from("proposal_versions")
    .select(
      "id, proposal_id, version, title, recommended_package, content, pricing_items, enhancements, core_features, brief_timeline, estimated_timeline, investment_note, payment_type, payment_dp_percent, payment_terms_text, note, created_by, created_at",
    )
    .eq("proposal_id", proposalId)
    .order("version", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createProposalForLead(supabase: Client, leadId: string, userId: string) {
  const baseLead = await fetchLead(supabase, leadId);
  if (!baseLead) throw new Error("Lead tidak ditemukan.");
  // Master data = FINAL ORDER BRIEF (latest requirement version), lead record as fallback.
  const { loadOrderBriefByLead } = await import("./order-brief.server");
  const finalBrief = await loadOrderBriefByLead(supabase as never, leadId).catch(() => null);
  const lead = finalBrief
    ? {
        ...baseLead,
        name: finalBrief.brief.customerName || baseLead.name,
        business_name: finalBrief.brief.business || baseLead.business_name,
        requirement: finalBrief.brief.project || baseLead.requirement,
        features: finalBrief.brief.features.length
          ? finalBrief.brief.features.join(", ")
          : baseLead.features,
        timeline: finalBrief.brief.timeline ?? baseLead.timeline,
        budget: finalBrief.brief.budget ?? baseLead.budget,
        ai_summary: finalBrief.brief.goal ?? baseLead.ai_summary,
        ai_problems: finalBrief.brief.problems.length
          ? finalBrief.brief.problems
          : baseLead.ai_problems,
        ai_requirements: finalBrief.brief.features.length
          ? finalBrief.brief.features
          : baseLead.ai_requirements,
        ai_recommended_package: finalBrief.brief.recommendation ?? baseLead.ai_recommended_package,
      }
    : baseLead;
  const brief = buildSalesBrief(lead);
  const { buildEnhancements, buildCoreFeatures } = await import("./admin/proposal-logic");
  const context = [
    lead.requirement,
    lead.project_type,
    lead.features,
    lead.ai_business_category,
    brief.features.join(" "),
  ]
    .filter(Boolean)
    .join(" ");

  // PROPOSAL MIRROR ENGINE: kalau Final Order Brief ada, seluruh isi proposal
  // diturunkan dari engine yang sama dengan PDF Order Brief (1:1, no re-analysis).
  const mirror = finalBrief
    ? (await import("./admin/proposal-from-brief")).buildProposalFromBrief({
        brief: finalBrief.brief,
        contactName: lead.name ?? finalBrief.brief.customerName,
      })
    : null;
  const packageName = mirror?.packageName ?? recommendPackage(lead);
  const enhancements =
    mirror?.enhancements ??
    buildEnhancements({
      features: brief.features,
      context,
      packageName,
    });
  const coreFeatures =
    mirror?.coreFeatures ??
    buildCoreFeatures({
      packageName,
      briefFeatures: brief.features,
      context,
    });
  const sections = mirror?.sections ?? buildProposalSections(lead);
  const pricingItems = mirror?.pricing ?? buildPricingItems(lead);
  const investmentNote = mirror?.investmentNote ?? brief.investment;


  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);
  const { data, error } = await supabase
    .from("proposals")
    .insert({
      lead_id: leadId,
      title: `KERJAKU Digital Solution Proposal — ${lead.business_name || lead.company || lead.name}`,
      status: "Draft",
      recommended_package: packageName,
      content: sections,
      pricing_items: pricingItems,
      enhancements,
      core_features: coreFeatures,
      payment_type: "full",
      payment_dp_percent: null,
      payment_terms_text: null,
      brief_timeline: finalBrief?.brief.timeline ?? lead.timeline ?? null,
      estimated_timeline: null,
      currency: "IDR",
      valid_until: validUntil.toISOString().slice(0, 10),
      version: 1,
      client_name: lead.business_name || lead.company || lead.name,
      investment_note: investmentNote,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { recordBusinessMilestone } = await import("./acquisition.server");
  await recordBusinessMilestone("proposal_created", leadId, packageName);
  // Observability (write-only, never throws).
  {
    const { recordDecisionTrace } = await import("./decision-trace.server");
    await recordDecisionTrace({
      legacyType: "consultation",
      legacyId: leadId,
      module: "proposal",
      decisionType: "proposal_recommendation",
      decision: {
        proposal_id: data.id,
        recommended_package: packageName,
        core_features: coreFeatures,
        enhancements,
        from_consultant_mirror: Boolean(mirror),
      },
      evidence: { lead_id: leadId, order_brief_version: finalBrief?.brief.version ?? null },
      actorKind: "user",
      actorId: userId,
    });
  }
  return { id: data.id as string };
}


export async function duplicateProposal(supabase: Client, id: string, userId: string) {
  const source = await fetchProposal(supabase, id);
  if (!source) throw new Error("Proposal tidak ditemukan.");
  const { data, error } = await supabase
    .from("proposals")
    .insert({
      lead_id: source.lead_id,
      title: `${source.title} - Copy`,
      status: "Draft",
      recommended_package: source.recommended_package,
      content: source.content,
      pricing_items: source.pricing_items,
      enhancements: source.enhancements ?? [],
      core_features: source.core_features ?? [],
      payment_type: source.payment_type ?? "full",
      payment_dp_percent: source.payment_dp_percent ?? null,
      payment_terms_text: source.payment_terms_text ?? null,
      brief_timeline: source.brief_timeline ?? null,
      estimated_timeline: source.estimated_timeline ?? null,
      currency: source.currency,
      valid_until: source.valid_until,
      version: 1,
      client_name: source.client_name,
      investment_note: source.investment_note,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  // Observability (write-only, never throws).
  {
    const { recordDecisionTrace } = await import("./decision-trace.server");
    await recordDecisionTrace({
      legacyType: source.lead_id ? "consultation" : null,
      legacyId: source.lead_id ?? null,
      module: "proposal",
      decisionType: "proposal_duplicate",
      decision: { proposal_id: data.id, recommended_package: source.recommended_package },
      evidence: { source_proposal_id: id },
      actorKind: "user",
      actorId: userId,
    });
  }
  return { id: data.id as string };
}

export type SaveProposalInput = {
  id: string;
  title: string;
  client_name?: string | null;
  recommended_package: string | null;
  content: { heading: string; body: string }[];
  pricing_items?: PricingItem[];
  enhancements?: { name: string; benefit: string; amount: number; recommended?: boolean }[];
  core_features?: { name: string; description: string }[];
  payment_type?: "full" | "termin" | null;
  payment_dp_percent?: number | null;
  payment_terms_text?: string | null;
  brief_timeline?: string | null;
  estimated_timeline?: string | null;
  currency?: string | null;
  valid_until?: string | null;
  investment_note?: string | null;
  version_note?: string | null;
};

/** Saves the proposal and snapshots the previous state as a restorable version. */
export async function saveProposal(supabase: Client, input: SaveProposalInput, userId: string) {
  const current = await fetchProposal(supabase, input.id);
  if (!current) throw new Error("Proposal tidak ditemukan.");

  const nextVersion = (Number(current.version) || 1) + 1;

  const { error: versionError } = await supabase.from("proposal_versions").insert({
    proposal_id: input.id,
    version: Number(current.version) || 1,
    title: current.title,
    recommended_package: current.recommended_package,
    content: current.content,
    pricing_items: current.pricing_items ?? [],
    enhancements: current.enhancements ?? [],
    core_features: current.core_features ?? [],
    payment_type: current.payment_type ?? "full",
    payment_dp_percent: current.payment_dp_percent ?? null,
    payment_terms_text: current.payment_terms_text ?? null,
    brief_timeline: current.brief_timeline ?? null,
    estimated_timeline: current.estimated_timeline ?? null,
    investment_note: current.investment_note,
    note: input.version_note ?? null,
    created_by: userId,
  });
  if (versionError) throw new Error(versionError.message);

  const { error } = await supabase
    .from("proposals")
    .update({
      title: input.title,
      client_name: input.client_name ?? current.client_name,
      recommended_package: input.recommended_package,
      content: input.content,
      pricing_items: input.pricing_items ?? current.pricing_items,
      enhancements: input.enhancements ?? current.enhancements ?? [],
      core_features: input.core_features ?? current.core_features ?? [],
      payment_type: input.payment_type ?? current.payment_type ?? "full",
      payment_dp_percent: input.payment_dp_percent ?? null,
      payment_terms_text: input.payment_terms_text ?? null,
      brief_timeline: input.brief_timeline ?? current.brief_timeline ?? null,
      estimated_timeline: input.estimated_timeline ?? null,
      currency: input.currency ?? current.currency,
      valid_until: input.valid_until ?? null,
      investment_note: input.investment_note ?? current.investment_note,
      version: nextVersion,
    })
    .eq("id", input.id);

  if (error) throw new Error(error.message);
  // Observability (write-only, never throws): proposal edit / package / feature change.
  try {
    const { proposalDecisionDiff } = await import("./admin/decision-classify");
    const diff = proposalDecisionDiff(current, {
      recommended_package: input.recommended_package,
      core_features: input.core_features ?? current.core_features,
      enhancements: input.enhancements ?? current.enhancements,
    });
    const { recordDecisionTrace } = await import("./decision-trace.server");
    await recordDecisionTrace({
      legacyType: current.lead_id ? "consultation" : null,
      legacyId: current.lead_id ?? null,
      module: "proposal",
      decisionType: diff.packageChanged
        ? "proposal_package_change"
        : diff.featuresChanged
          ? "proposal_feature_change"
          : "proposal_edit",
      decision: { proposal_id: input.id, version: nextVersion, ...diff },
      evidence: { previous_version: Number(current.version) || 1, note: input.version_note ?? null },
      actorKind: "user",
      actorId: userId,
      override:
        diff.packageChanged || diff.featuresChanged
          ? {
              original: { package: diff.packageFrom },
              changed: { package: diff.packageTo },
              actor: userId,
              reason: input.version_note ?? null,
              at: new Date().toISOString(),
            }
          : null,
    });
  } catch (traceError) {
    console.warn("[decision-trace] proposal edit skipped", (traceError as Error).message);
  }
  return { ok: true as const, version: nextVersion };
}

/** Restores a snapshot into the live proposal (keeping the snapshot history). */
export async function restoreProposalVersion(
  supabase: Client,
  input: { proposalId: string; versionId: string },
  userId: string,
) {
  const { data: snapshot, error: snapshotError } = await supabase
    .from("proposal_versions")
    .select("*")
    .eq("id", input.versionId)
    .maybeSingle();
  if (snapshotError) throw new Error(snapshotError.message);
  if (!snapshot) throw new Error("Versi proposal tidak ditemukan.");

  return saveProposal(
    supabase,
    {
      id: input.proposalId,
      title: snapshot.title,
      recommended_package: snapshot.recommended_package,
      content: (snapshot.content ?? []) as { heading: string; body: string }[],
      pricing_items: (snapshot.pricing_items ?? []) as PricingItem[],
      enhancements: (snapshot.enhancements ?? []) as {
        name: string;
        benefit: string;
        amount: number;
      }[],
      core_features: (snapshot.core_features ?? []) as { name: string; description: string }[],
      payment_type: (snapshot.payment_type ?? "full") as "full" | "termin",
      payment_dp_percent: snapshot.payment_dp_percent ?? null,
      payment_terms_text: snapshot.payment_terms_text ?? null,
      brief_timeline: snapshot.brief_timeline ?? null,
      estimated_timeline: snapshot.estimated_timeline ?? null,
      investment_note: snapshot.investment_note,
      version_note: `Restore dari versi ${snapshot.version}`,
    },
    userId,
  );
}

export async function setProposalStatus(supabase: Client, id: string, status: ProposalStatus) {
  const now = new Date().toISOString();
  const patch: {
    status: string;
    sent_at?: string;
    viewed_at?: string;
    approved_at?: string;
    rejected_at?: string;
  } = { status };
  if (status === "Sent") patch.sent_at = now;
  if (status === "Viewed") patch.viewed_at = now;
  if (status === "Approved") patch.approved_at = now;
  if (status === "Rejected") patch.rejected_at = now;

  const { error } = await supabase.from("proposals").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  const { data: proposal } = await supabase
    .from("proposals")
    .select("id, lead_id, title, client_name")
    .eq("id", id)
    .maybeSingle();
  if (status === "Sent" || status === "Approved") {
    const { recordBusinessMilestone } = await import("./acquisition.server");
    await recordBusinessMilestone(
      status === "Sent" ? "proposal_sent" : "deal_won",
      proposal?.lead_id ?? null,
      proposal?.title ?? "",
    );
  }
  const { runAutomation } = await import("@/lib/automation.server");
  await runAutomation({
    type: "proposal.status_changed",
    proposalId: id,
    leadId: proposal?.lead_id ?? null,
    title: proposal?.title ?? "Proposal",
    status,
    clientName: proposal?.client_name ?? null,
  });

  return { ok: true as const };
}

export async function deleteProposal(supabase: Client, id: string) {
  const { error } = await supabase.from("proposals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}


export type ProposalAnalytics = {
  total: number;
  byStatus: { status: string; count: number }[];
  approved: number;
  conversionRate: number;
  topPackage: string | null;
  packages: { name: string; count: number }[];
  avgLeadToProposalHours: number;
};

export async function buildProposalAnalytics(supabase: Client): Promise<ProposalAnalytics> {
  const [{ data: proposals, error }, leads] = await Promise.all([
    supabase.from("proposals").select("id, lead_id, status, recommended_package, created_at"),
    fetchLeads(supabase),
  ]);
  if (error) throw new Error(error.message);
  const rows = proposals ?? [];
  const leadCreated = new Map(leads.map((l) => [l.id, l.created_at]));

  const byStatus = new Map<string, number>();
  const packages = new Map<string, number>();
  const approvedPackages = new Map<string, number>();
  let hoursTotal = 0;
  let hoursCount = 0;

  for (const row of rows) {
    byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
    if (row.recommended_package) {
      packages.set(row.recommended_package, (packages.get(row.recommended_package) ?? 0) + 1);
      if (row.status === "Approved") {
        approvedPackages.set(
          row.recommended_package,
          (approvedPackages.get(row.recommended_package) ?? 0) + 1,
        );
      }
    }
    const created = leadCreated.get(row.lead_id);
    if (created) {
      const diff = (new Date(row.created_at).getTime() - new Date(created).getTime()) / 3_600_000;
      if (diff >= 0) {
        hoursTotal += diff;
        hoursCount += 1;
      }
    }
  }

  const approved = byStatus.get("Approved") ?? 0;
  const rank = (map: Map<string, number>) =>
    [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  const bestApproved = rank(approvedPackages)[0]?.name ?? rank(packages)[0]?.name ?? null;

  return {
    total: rows.length,
    byStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })),
    approved,
    conversionRate: rows.length ? Number(((approved / rows.length) * 100).toFixed(1)) : 0,
    topPackage: bestApproved,
    packages: rank(packages),
    avgLeadToProposalHours: hoursCount ? Number((hoursTotal / hoursCount).toFixed(1)) : 0,
  };
}

/* ---------------------------------------------------------------------------
 * AI Sales Memory — generated suggestions stored on the lead timeline
 * ------------------------------------------------------------------------ */

export const AI_ACTIVITY_COLUMNS =
  "id, lead_id, action, label, content, meta, created_by, created_by_email, created_at";

export async function fetchLeadAiActivities(supabase: Client, leadId: string) {
  const { data, error } = await supabase
    .from("lead_ai_activities")
    .select(AI_ACTIVITY_COLUMNS)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createLeadAiActivity(
  supabase: Client,
  input: {
    leadId: string;
    action: string;
    label: string | null;
    content: string;
    meta?: unknown;
  },
  user: { id: string; email: string | null },
) {
  const { data, error } = await supabase
    .from("lead_ai_activities")
    .insert({
      lead_id: input.leadId,
      action: input.action,
      label: input.label,
      content: input.content,
      meta: (input.meta ?? {}) as never,
      created_by: user.id,
      created_by_email: user.email,
    })
    .select(AI_ACTIVITY_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  // Observability (write-only, never throws): legacy Sales AI suggestion persisted.
  {
    const { recordDecisionTrace } = await import("./decision-trace.server");
    await recordDecisionTrace({
      legacyType: "consultation",
      legacyId: input.leadId,
      module: "legacy_sales_ai",
      decisionType: input.action,
      decision: { label: input.label, content: input.content.slice(0, 4000) },
      evidence: { activity_id: (data as { id?: string } | null)?.id ?? null, meta: input.meta ?? null },
      actorKind: "user",
      actorId: user.id,
    });
  }
  return data;
}

export async function deleteLeadAiActivity(supabase: Client, id: string) {
  const { error } = await supabase.from("lead_ai_activities").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}
