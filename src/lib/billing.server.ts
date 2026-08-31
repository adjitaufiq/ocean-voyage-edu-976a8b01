/**
 * Payment & Client Conversion data access — server only.
 *
 * Flow: approved proposal → invoice → payment confirmed → client profile +
 * project + portal access. Every write keeps the original lead history intact.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  buildInvoiceNumber,

  dueDateFromNow,
  invoiceTotal,
  parseTimeline,
  providerMeta,
  timelineProgress,
  type PaymentProviderId,
  type PaymentStatus,
  type TimelineStep,
} from "@/lib/admin/payments";
import {
  derivePaymentState,
  fullPaymentSchedule,
  paidAmount,
  parseSchedule,
  recalcSchedule,
  validateSchedule,
  type Installment,
  type PaymentType,
} from "@/lib/admin/invoice-schedule";
import { parsePricingItems, type PricingItem } from "@/lib/admin/sales-ai";
import { cleanContactName, customerEmail, customerWhatsapp } from "@/lib/invoice-doc";


type Client = SupabaseClient<Database>;

export const INVOICE_COLUMNS =
  "id, lead_id, proposal_id, number, title, client_name, client_email, client_whatsapp, client_company, package, items, currency, amount, due_date, status, provider, payment_link, provider_reference, notes, paid_at, created_at, updated_at";

export const CLIENT_COLUMNS =
  "id, lead_id, name, email, whatsapp, company, package, status, portal_token, notes, converted_at, created_at, updated_at";

/* ---------------------------------- Invoices ------------------------------ */

export async function fetchInvoices(supabase: Client, leadId?: string) {
  let query = supabase
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(300);
  if (leadId) query = query.eq("lead_id", leadId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchInvoice(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Builds an invoice from an approved proposal (falls back to lead data). */
export async function createInvoiceFromProposal(
  supabase: Client,
  proposalId: string,
  userId: string,
) {
  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", proposalId)
    .maybeSingle();
  if (proposalError) throw new Error(proposalError.message);
  if (!proposal) throw new Error("Proposal tidak ditemukan.");

  const { data: lead, error: leadError } = await supabase
    .from("consultations")
    .select("id, name, email, whatsapp, company, business_name, project_type")
    .eq("id", proposal.lead_id)
    .maybeSingle();
  if (leadError) throw new Error(leadError.message);

  const items: PricingItem[] = parsePricingItems(proposal.pricing_items);
  // SALES RULE: rekomendasi pengembangan pada proposal BUKAN item yang sudah
  // disetujui customer. Invoice dibuat dari scope utama saja; admin menambahkan
  // item opsional hanya setelah customer benar-benar menyetujuinya.
  const optionalItems: PricingItem[] = [];
  const total = invoiceTotal(items);
  // MIRROR RULE: project = kebutuhan project pada Final Order Brief/proposal,
  // paket tetap disimpan terpisah sebagai keterangan solusi.
  const projectName =
    lead?.project_type ??
    (proposal.recommended_package as string) ??
    proposal.title ??
    "Project Digital";

  // Nama kontak (orang) vs nama bisnis dipisah agar tidak tertukar di dokumen.
  const businessName = lead?.company ?? lead?.business_name ?? (proposal.client_name as string) ?? null;
  const contactName = cleanContactName(lead?.name ?? (proposal.client_name as string) ?? "Client");

  const payload = {
    lead_id: proposal.lead_id,
    proposal_id: proposal.id,
    number: buildInvoiceNumber(),
    title: `Invoice — ${proposal.title}`,
    project_name: projectName,
    client_name: contactName,
    client_email: customerEmail(lead?.email),
    client_whatsapp: customerWhatsapp(lead?.whatsapp),
    client_company: businessName,
    package: proposal.recommended_package,
    items,
    optional_items: optionalItems,
    currency: proposal.currency ?? "IDR",
    amount: total,
    payment_type: "full",
    schedule: fullPaymentSchedule(total),
    due_date: dueDateFromNow(7),
    status: "Pending",
    provider: "manual_transfer",
    created_by: userId,
  };


  const { data, error } = await supabase
    .from("invoices")
    .insert(payload)
    .select(INVOICE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  const { recordBusinessMilestone } = await import("./acquisition.server");
  await recordBusinessMilestone("invoice_created", proposal.lead_id as string, payload.title);
  return data;
}

export async function saveInvoice(
  supabase: Client,
  input: {
    id: string;
    title: string;
    project_name: string | null;
    client_name: string | null;
    client_email: string | null;
    client_whatsapp: string | null;
    client_company: string | null;
    package: string | null;
    items: PricingItem[];
    optional_items: PricingItem[];
    currency: string;
    due_date: string | null;
    notes: string | null;
    provider: PaymentProviderId;
    payment_type: PaymentType;
    schedule: Installment[];
  },
) {
  const total = invoiceTotal(input.items) + invoiceTotal(input.optional_items);
  const schedule = recalcSchedule(input.schedule, total);
  const check = validateSchedule(schedule, total);
  if (!check.valid) throw new Error(check.message ?? "Payment schedule tidak valid.");

  const { error } = await supabase
    .from("invoices")
    .update({
      title: input.title,
      project_name: input.project_name,
      client_name: input.client_name,
      client_email: input.client_email,
      client_whatsapp: input.client_whatsapp,
      client_company: input.client_company,
      package: input.package,
      items: input.items,
      optional_items: input.optional_items,
      amount: total,
      currency: input.currency,
      due_date: input.due_date || null,
      notes: input.notes,
      provider: input.provider,
      payment_type: input.payment_type,
      schedule,
      paid_amount: paidAmount(schedule),
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

/** PART 10 — flip a single installment and re-derive the invoice payment state. */
export async function setInstallmentStatus(
  supabase: Client,
  input: { id: string; index: number; status: "Pending" | "Paid" },
) {
  const invoice = await fetchInvoice(supabase, input.id);
  if (!invoice) throw new Error("Invoice tidak ditemukan.");

  const total = Number(invoice.amount) || 0;
  const schedule = recalcSchedule(parseSchedule((invoice as { schedule?: unknown }).schedule), total);
  const target = schedule[input.index];
  if (!target) throw new Error("Termin pembayaran tidak ditemukan.");
  schedule[input.index] = {
    ...target,
    status: input.status,
    paid_at: input.status === "Paid" ? new Date().toISOString() : null,
  };

  const paid = paidAmount(schedule);
  const state = derivePaymentState(schedule, total);
  const fully = state === "Fully Paid";

  const { error } = await supabase
    .from("invoices")
    .update({
      schedule,
      paid_amount: paid,
      status: fully ? "Paid" : invoice.status === "Paid" ? "Pending" : invoice.status,
      paid_at: fully ? new Date().toISOString() : null,
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);

  let clientId: string | null = null;
  if (fully) {
    const client = await convertInvoiceToClient(supabase, input.id);
    clientId = client?.id ?? null;
  }
  return { ok: true as const, state, paid, clientId };
}


/** Provider-agnostic payment link creation. */
export async function createInvoicePaymentLink(
  supabase: Client,
  input: { id: string; provider: PaymentProviderId; returnUrl?: string | null },
) {
  const invoice = await fetchInvoice(supabase, input.id);
  if (!invoice) throw new Error("Invoice tidak ditemukan.");

  const { getPaymentAdapter } = await import("./payments-providers.server");
  const adapter = getPaymentAdapter(input.provider);
  const result = await adapter.createPaymentLink({
    invoiceId: invoice.id,
    number: invoice.number,
    title: invoice.title,
    amount: Number(invoice.amount) || 0,
    currency: invoice.currency ?? "IDR",
    clientName: invoice.client_name,
    clientEmail: invoice.client_email,
    dueDate: invoice.due_date,
    returnUrl: input.returnUrl ?? null,
  });

  const patch: {
    provider: string;
    payment_link: string | null;
    provider_reference: string | null;
    status?: string;
  } = {
    provider: input.provider,
    payment_link: result.url,
    provider_reference: result.reference,
  };
  if (result.url && invoice.status === "Pending") patch.status = "Payment Link Sent";


  const { error } = await supabase.from("invoices").update(patch).eq("id", invoice.id);
  if (error) throw new Error(error.message);

  return {
    ...result,
    providerLabel: providerMeta(input.provider).label,
  };
}

/** Status change; confirming payment automatically converts the lead. */
export async function setInvoiceStatus(
  supabase: Client,
  id: string,
  status: PaymentStatus,
): Promise<{ ok: true; clientId: string | null }> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("invoices")
    .update({ status, paid_at: status === "Paid" ? now : null })
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (status !== "Paid") return { ok: true, clientId: null };

  const paidInvoice = await fetchInvoice(supabase, id);
  const { runAutomation } = await import("@/lib/automation.server");
  await runAutomation({
    type: "invoice.paid",
    invoiceId: id,
    leadId: paidInvoice?.lead_id ?? null,
    number: paidInvoice?.number ?? "-",
    amount: Number(paidInvoice?.amount ?? 0),
    currency: paidInvoice?.currency ?? "IDR",
    clientName: paidInvoice?.client_name ?? null,
  });

  const client = await convertInvoiceToClient(supabase, id);
  return { ok: true, clientId: client?.id ?? null };
}

/* ----------------------- Automatic client conversion ---------------------- */

export async function convertInvoiceToClient(supabase: Client, invoiceId: string) {
  const invoice = await fetchInvoice(supabase, invoiceId);
  if (!invoice) throw new Error("Invoice tidak ditemukan.");

  const { data: lead } = await supabase
    .from("consultations")
    .select("id, name, email, whatsapp, company, business_name, project_type, status")
    .eq("id", invoice.lead_id)
    .maybeSingle();

  const { data: existing } = await supabase
    .from("clients")
    .select(CLIENT_COLUMNS)
    .eq("lead_id", invoice.lead_id)
    .maybeSingle();

  let client = existing;
  if (!client) {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        lead_id: invoice.lead_id,
        name: invoice.client_name ?? lead?.name ?? "Klien KERJAKU",
        email: invoice.client_email ?? lead?.email ?? "",
        whatsapp: invoice.client_whatsapp ?? lead?.whatsapp ?? null,
        company: invoice.client_company ?? lead?.company ?? lead?.business_name ?? null,
        package: invoice.package,
        status: "Active",
      })
      .select(CLIENT_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    client = data;
  }

  // Project (one per invoice) — preserves the project history per payment.
  const { data: project } = await supabase
    .from("client_projects")
    .select("id")
    .eq("client_id", client.id)
    .eq("invoice_id", invoice.id)
    .maybeSingle();

  if (!project) {
    // Project automation: pick a delivery template from the lead context and
    // seed its milestones so delivery can start immediately after payment.
    const { currentPhase, suggestTemplate, templateMeta, templateTimeline } = await import(
      "@/lib/admin/projects"
    );
    const templateId = suggestTemplate(
      lead?.project_type,
      invoice.package,
      invoice.title,
      lead?.business_name,
    );
    const timeline = templateTimeline(templateId);
    const projectName = invoice.package
      ? `${invoice.package} — ${lead?.project_type ?? "Project Digital"}`
      : (lead?.project_type ?? "Project Digital");

    const { data: createdProject } = await supabase
      .from("client_projects")
      .insert({
        client_id: client.id,
        invoice_id: invoice.id,
        name: projectName,
        status: "Onboarding",
        template: templateId,
        phase: currentPhase(timeline),
        scope: templateMeta(templateId).steps.map((s) => `• ${s.title}: ${s.detail}`).join("\n"),
        progress: timelineProgress(timeline),
        summary: `Project dimulai setelah pembayaran invoice ${invoice.number} dikonfirmasi.`,
        timeline,
        start_date: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();

    if (createdProject) {
      await supabase.from("project_activities").insert([
        {
          project_id: createdProject.id,
          action: "Project dibuat otomatis",
          detail: `Invoice ${invoice.number} dikonfirmasi lunas.`,
        },
        {
          project_id: createdProject.id,
          action: "Template diterapkan",
          detail: templateMeta(templateId).label,
        },
      ]);

      const { sendTelegramMessage } = await import("./telegram.server");
      void sendTelegramMessage(
        [
          "🚀 <b>PROJECT BARU DIMULAI</b>",
          `Klien: ${client.name}`,
          `Project: ${projectName}`,
          `Template: ${templateMeta(templateId).label}`,
          `Invoice: ${invoice.number}`,
        ].join("\n"),
      ).catch(() => undefined);

      const { runAutomation } = await import("@/lib/automation.server");
      await runAutomation({
        type: "project.created",
        projectId: createdProject.id,
        clientId: client.id,
        name: projectName,
        template: templateMeta(templateId).label,
        invoiceNumber: invoice.number,
      });
    }

    await supabase.from("client_documents").insert(
      [
        {
          client_id: client.id,
          title: `Invoice ${invoice.number}`,
          kind: "invoice",
          invoice_id: invoice.id,
        },
        invoice.proposal_id
          ? {
              client_id: client.id,
              title: "Proposal Solusi KERJAKU",
              kind: "proposal",
              proposal_id: invoice.proposal_id,
            }
          : null,
      ].filter(Boolean) as {
        client_id: string;
        title: string;
        kind: string;
        invoice_id?: string;
        proposal_id?: string;
      }[],
    );

    await supabase.from("client_messages").insert({
      client_id: client.id,
      sender: "team",
      author_name: "KERJAKU",
      body: `Terima kasih! Pembayaran invoice ${invoice.number} sudah kami terima. Project Anda resmi dimulai — gunakan portal ini untuk memantau progres, dokumen, dan komunikasi.`,
    });
  }

  // Lead history is preserved; only the pipeline stage moves forward.
  if (lead && lead.status !== "Completed") {
    await supabase
      .from("consultations")
      .update({ status: "Completed", status_updated_at: new Date().toISOString() })
      .eq("id", lead.id);
  }

  return client;
}

/* ---------------------------------- Clients ------------------------------- */

export async function fetchClients(supabase: Client) {
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_COLUMNS)
    .order("converted_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchClientWorkspace(supabase: Client, clientId: string) {
  const [client, projects, documents, messages] = await Promise.all([
    supabase.from("clients").select(CLIENT_COLUMNS).eq("id", clientId).maybeSingle(),
    supabase
      .from("client_projects")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("client_documents")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("client_messages")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true })
      .limit(200),
  ]);

  if (client.error) throw new Error(client.error.message);
  if (!client.data) throw new Error("Klien tidak ditemukan.");

  const invoices = client.data.lead_id
    ? await fetchInvoices(supabase, client.data.lead_id)
    : [];

  return {
    client: client.data,
    projects: (projects.data ?? []).map((p) => ({ ...p, timeline: parseTimeline(p.timeline) })),
    documents: documents.data ?? [],
    messages: messages.data ?? [],
    invoices,
  };
}

export async function updateClientProject(
  supabase: Client,
  input: {
    id: string;
    name: string;
    status: string;
    summary: string | null;
    timeline: TimelineStep[];
    target_date: string | null;
  },
) {
  const { error } = await supabase
    .from("client_projects")
    .update({
      name: input.name,
      status: input.status,
      summary: input.summary,
      timeline: input.timeline,
      progress: timelineProgress(input.timeline),
      target_date: input.target_date || null,
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function addClientMessage(
  supabase: Client,
  input: { clientId: string; body: string; authorName: string | null },
  userId: string | null,
) {
  const { error } = await supabase.from("client_messages").insert({
    client_id: input.clientId,
    sender: "team",
    author_name: input.authorName ?? "KERJAKU",
    body: input.body,
    created_by: userId,
  });
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function addClientDocument(
  supabase: Client,
  input: { clientId: string; title: string; url: string | null; kind: string },
) {
  const { error } = await supabase.from("client_documents").insert({
    client_id: input.clientId,
    title: input.title,
    url: input.url,
    kind: input.kind,
  });
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

/* --------------------------------- Analytics ------------------------------ */

export type BillingOverview = {
  invoices: number;
  paid: number;
  pending: number;
  failed: number;
  refunded: number;
  paidAmount: number;
  outstandingAmount: number;
  clients: number;
  conversionRate: number;
  byStatus: { status: string; count: number }[];
  byProvider: { provider: string; count: number }[];
};

export async function buildBillingOverview(supabase: Client): Promise<BillingOverview> {
  const [{ data: invoices, error }, { count: clientCount }] = await Promise.all([
    supabase.from("invoices").select("status, provider, amount"),
    supabase.from("clients").select("id", { count: "exact", head: true }),
  ]);
  if (error) throw new Error(error.message);
  const rows = invoices ?? [];

  const byStatus = new Map<string, number>();
  const byProvider = new Map<string, number>();
  let paidAmount = 0;
  let outstandingAmount = 0;

  for (const row of rows) {
    byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
    byProvider.set(
      providerMeta(row.provider).label,
      (byProvider.get(providerMeta(row.provider).label) ?? 0) + 1,
    );
    const amount = Number(row.amount) || 0;
    if (row.status === "Paid") paidAmount += amount;
    else if (row.status !== "Refunded" && row.status !== "Failed") outstandingAmount += amount;
  }

  const paid = byStatus.get("Paid") ?? 0;
  return {
    invoices: rows.length,
    paid,
    pending: (byStatus.get("Pending") ?? 0) + (byStatus.get("Payment Link Sent") ?? 0),
    failed: byStatus.get("Failed") ?? 0,
    refunded: byStatus.get("Refunded") ?? 0,
    paidAmount,
    outstandingAmount,
    clients: clientCount ?? 0,
    conversionRate: rows.length ? Number(((paid / rows.length) * 100).toFixed(1)) : 0,
    byStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })),
    byProvider: [...byProvider.entries()].map(([provider, count]) => ({ provider, count })),
  };
}
