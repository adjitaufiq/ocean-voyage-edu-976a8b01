/**
 * Organic acquisition + lead attribution engine — server-only.
 *
 * Additive: it never changes the CRM/lead workflow, it only records
 * first-party funnel events and aggregates them together with existing lead,
 * proposal and invoice data. No IP, no PII, no fingerprinting.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { AcquisitionEventInput, AttributionInput } from "./acquisition-schema";

type Client = SupabaseClient<Database>;

export type NamedCount = { label: string; value: number };

export type AcquisitionIntelligence = {
  since: string;
  funnel: {
    visitors: number;
    landingViews: number;
    projectViews: number;
    demoClicks: number;
    consultantOpens: number;
    consultationsStarted: number;
    consultationsCompleted: number;
    leads: number;
    qualifiedLeads: number;
    hotLeads: number;
    proposals: number;
    deals: number;
  };
  ratios: {
    visitorToConsultantOpen: number;
    openToStart: number;
    startToComplete: number;
    completeToLead: number;
    leadToQualified: number;
    qualifiedToProposal: number;
    proposalToDeal: number;
  };
  channels: {
    label: string;
    visitors: number;
    leads: number;
    qualifiedLeads: number;
    deals: number;
  }[];
  content: {
    path: string;
    title: string;
    views: number;
    consultantOpens: number;
    leads: number;
    qualifiedLeads: number;
  }[];
  dataQuality: { eventsTracked: number; leadsWithAttribution: number; totalLeads: number };
};

const QUALIFIED_STATUSES = new Set([
  "Qualified",
  "Qualified Lead",
  "Proposal Sent",
  "Negotiation",
  "Won",
  "Client",
  "Deal Won",
]);

const DEAL_STATUSES = new Set(["Won", "Client", "Deal Won", "Closed Won"]);

function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

/** Best-effort first-party event capture (never throws to the caller). */
export async function recordAcquisitionEvent(input: AcquisitionEventInput) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const touch =
      input.attribution.lastTouch.channel === "Unknown"
        ? input.attribution.firstTouch
        : input.attribution.lastTouch;
    const { error } = await supabaseAdmin.from("acquisition_events").insert({
      visitor_id: input.attribution.visitorId || "anonymous",
      session_id: input.sessionId || null,
      event: input.event,
      path: input.path || null,
      label: input.label || null,
      channel: input.attribution.firstTouch.channel,
      source: touch.source || null,
      campaign: touch.campaign || null,
      landing_page: input.attribution.firstTouch.page || null,
      device_type: input.deviceType,
    });
    if (error) console.error("[acquisition] event insert failed", error.message);
  } catch (error) {
    console.error("[acquisition] event capture failed", (error as Error).message);
  }
}

/** Server-side funnel milestones (proposal/invoice/deal). Best-effort. */
export async function recordBusinessMilestone(
  event: "proposal_created" | "proposal_sent" | "invoice_created" | "deal_won",
  leadId: string | null,
  label = "",
) {
  if (!leadId) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lead } = await supabaseAdmin
      .from("consultations")
      .select("visitor_id, first_touch_channel, first_touch_source, first_touch_landing_page")
      .eq("id", leadId)
      .maybeSingle();
    await supabaseAdmin.from("acquisition_events").insert({
      visitor_id: lead?.visitor_id || `lead:${leadId}`,
      event,
      label: label || null,
      channel: lead?.first_touch_channel ?? null,
      source: lead?.first_touch_source ?? null,
      landing_page: lead?.first_touch_landing_page ?? null,
      device_type: "unknown",
    });
  } catch (error) {
    console.error("[acquisition] milestone failed", (error as Error).message);
  }
}

/** Columns written when a lead is created, without touching existing fields. */
export function attributionColumns(attribution?: AttributionInput | null) {
  if (!attribution) return {};
  const { firstTouch, lastTouch } = attribution;
  return {
    visitor_id: attribution.visitorId || null,
    utm_content: firstTouch.content || null,
    utm_term: firstTouch.term || null,
    first_touch_channel: firstTouch.channel,
    first_touch_source: firstTouch.source || null,
    first_touch_landing_page: firstTouch.page || null,
    first_touch_referrer: firstTouch.referrer || null,
    first_touch_at: firstTouch.at || null,
    last_touch_channel: lastTouch.channel,
    last_touch_source: lastTouch.source || null,
    last_touch_page: lastTouch.page || null,
    first_content_path: attribution.firstContentPath || null,
    first_content_title: attribution.firstContentTitle || null,
  };
}

/** Same as above but safe for updates: first-touch fields are never overwritten. */
export function lastTouchColumns(attribution?: AttributionInput | null) {
  if (!attribution) return {};
  return {
    last_touch_channel: attribution.lastTouch.channel,
    last_touch_source: attribution.lastTouch.source || null,
    last_touch_page: attribution.lastTouch.page || null,
  };
}

export async function fetchAcquisitionIntelligence(
  supabase: Client,
  days = 90,
): Promise<AcquisitionIntelligence> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [eventsRes, leadsRes, proposalsRes] = await Promise.all([
    supabase
      .from("acquisition_events")
      .select("visitor_id, event, path, label, channel, created_at")
      .gte("created_at", since)
      .limit(20000),
    supabase
      .from("consultations")
      .select(
        "id, created_at, status, lead_temperature, lead_source, first_touch_channel, first_touch_source, first_touch_landing_page, first_content_path, first_content_title, visitor_source",
      )
      .gte("created_at", since)
      .limit(5000),
    supabase.from("proposals").select("id, lead_id, status, created_at").gte("created_at", since),
  ]);

  const events = eventsRes.data ?? [];
  const leads = leadsRes.data ?? [];
  const proposals = proposalsRes.data ?? [];

  const visitors = new Set(events.map((e) => e.visitor_id));
  const countOf = (name: string) => events.filter((e) => e.event === name).length;
  const uniqueVisitorsFor = (name: string) =>
    new Set(events.filter((e) => e.event === name).map((e) => e.visitor_id)).size;

  const qualified = leads.filter((l) => QUALIFIED_STATUSES.has(l.status ?? ""));
  const deals = leads.filter((l) => DEAL_STATUSES.has(l.status ?? ""));
  const hot = leads.filter((l) => l.lead_temperature === "Hot Lead");
  const leadIdsWithProposal = new Set(proposals.map((p) => p.lead_id).filter(Boolean));

  const funnel = {
    visitors: visitors.size,
    landingViews: countOf("landing_view"),
    projectViews: countOf("project_view"),
    demoClicks: countOf("live_demo_click"),
    consultantOpens: uniqueVisitorsFor("ai_consultant_open"),
    consultationsStarted: uniqueVisitorsFor("ai_consultant_started"),
    consultationsCompleted: uniqueVisitorsFor("ai_consultant_completed"),
    leads: leads.length,
    qualifiedLeads: qualified.length,
    hotLeads: hot.length,
    proposals: proposals.length,
    deals: deals.length,
  };

  const ratios = {
    visitorToConsultantOpen: pct(funnel.consultantOpens, funnel.visitors),
    openToStart: pct(funnel.consultationsStarted, funnel.consultantOpens),
    startToComplete: pct(funnel.consultationsCompleted, funnel.consultationsStarted),
    completeToLead: pct(funnel.leads, funnel.consultationsCompleted),
    leadToQualified: pct(funnel.qualifiedLeads, funnel.leads),
    qualifiedToProposal: pct(leadIdsWithProposal.size, funnel.qualifiedLeads),
    proposalToDeal: pct(funnel.deals, funnel.proposals),
  };

  // Channel table: visitors from events, leads/deals from CRM attribution.
  const channelMap = new Map<
    string,
    { visitors: Set<string>; leads: number; qualifiedLeads: number; deals: number }
  >();
  const bucket = (label: string) => {
    const key = label || "Unknown";
    let entry = channelMap.get(key);
    if (!entry) {
      entry = { visitors: new Set(), leads: 0, qualifiedLeads: 0, deals: 0 };
      channelMap.set(key, entry);
    }
    return entry;
  };
  for (const event of events) bucket(event.channel ?? "Unknown").visitors.add(event.visitor_id);
  for (const lead of leads) {
    const entry = bucket(lead.first_touch_channel ?? "Unknown");
    entry.leads += 1;
    if (QUALIFIED_STATUSES.has(lead.status ?? "")) entry.qualifiedLeads += 1;
    if (DEAL_STATUSES.has(lead.status ?? "")) entry.deals += 1;
  }

  const channels = [...channelMap.entries()]
    .map(([label, value]) => ({
      label,
      visitors: value.visitors.size,
      leads: value.leads,
      qualifiedLeads: value.qualifiedLeads,
      deals: value.deals,
    }))
    .sort(
      (a, b) => b.qualifiedLeads - a.qualifiedLeads || b.leads - a.leads || b.visitors - a.visitors,
    );

  // Content performance keyed on path.
  const contentMap = new Map<
    string,
    { title: string; views: number; consultantOpens: number; leads: number; qualifiedLeads: number }
  >();
  const contentBucket = (path: string, title = "") => {
    let entry = contentMap.get(path);
    if (!entry) {
      entry = { title, views: 0, consultantOpens: 0, leads: 0, qualifiedLeads: 0 };
      contentMap.set(path, entry);
    }
    if (title && !entry.title) entry.title = title;
    return entry;
  };
  for (const event of events) {
    if (!event.path || event.path === "/") continue;
    const entry = contentBucket(event.path);
    if (event.event === "landing_view" || event.event === "project_view") entry.views += 1;
    if (event.event === "ai_consultant_open") entry.consultantOpens += 1;
  }
  for (const lead of leads) {
    const path = lead.first_content_path || lead.first_touch_landing_page;
    if (!path) continue;
    const entry = contentBucket(path, lead.first_content_title ?? "");
    entry.leads += 1;
    if (QUALIFIED_STATUSES.has(lead.status ?? "")) entry.qualifiedLeads += 1;
  }

  const content = [...contentMap.entries()]
    .map(([path, value]) => ({ path, ...value }))
    .sort((a, b) => b.qualifiedLeads - a.qualifiedLeads || b.leads - a.leads || b.views - a.views)
    .slice(0, 20);

  return {
    since,
    funnel,
    ratios,
    channels,
    content,
    dataQuality: {
      eventsTracked: events.length,
      leadsWithAttribution: leads.filter((l) => !!l.first_touch_channel).length,
      totalLeads: leads.length,
    },
  };
}

/**
 * Plain-text acquisition summary for the AI assistant / daily brief.
 * Returns null when the sample is too small to say anything meaningful,
 * so the assistant reports "data belum cukup" instead of inventing trends.
 */
export async function buildAcquisitionSummary(supabase: Client, days = 7): Promise<string | null> {
  const data = await fetchAcquisitionIntelligence(supabase, days);
  if (data.dataQuality.eventsTracked < 25 && data.funnel.leads === 0) return null;

  const channels = data.channels
    .filter((c) => c.leads > 0 || c.visitors > 0)
    .slice(0, 5)
    .map(
      (c) =>
        `- ${c.label}: ${c.visitors} visitor, ${c.leads} lead, ${c.qualifiedLeads} qualified, ${c.deals} deal`,
    );

  const content = data.content
    .filter((c) => c.leads > 0)
    .slice(0, 5)
    .map(
      (c) => `- ${c.title || c.path} (${c.path}): ${c.leads} lead, ${c.qualifiedLeads} qualified`,
    );

  return [
    `AKUISISI ${days} HARI TERAKHIR (data first-party, anonim):`,
    `Visitor ${data.funnel.visitors} | Consultant open ${data.funnel.consultantOpens} | Konsultasi selesai ${data.funnel.consultationsCompleted} | Lead ${data.funnel.leads} | Qualified ${data.funnel.qualifiedLeads} | Hot ${data.funnel.hotLeads} | Proposal ${data.funnel.proposals} | Deal ${data.funnel.deals}`,
    `Rasio: visitor→open ${data.ratios.visitorToConsultantOpen}% | selesai→lead ${data.ratios.completeToLead}% | lead→qualified ${data.ratios.leadToQualified}% | proposal→deal ${data.ratios.proposalToDeal}%`,
    channels.length ? "Channel:" : "Channel: (belum ada data channel)",
    ...channels,
    content.length ? "Konten penghasil lead:" : "Konten penghasil lead: (belum ada)",
    ...content,
    `Kualitas data: ${data.dataQuality.leadsWithAttribution}/${data.dataQuality.totalLeads} lead punya atribusi.`,
  ].join("\n");
}
