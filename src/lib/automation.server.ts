/**
 * KERJAKU Automation Engine — server only.
 *
 * A thin workflow layer on top of the existing business modules. Existing
 * modules keep their behaviour; they simply emit events here, and the engine
 * decides (based on automation_rules) whether to notify, schedule a follow-up
 * task, or just record an activity log entry.
 *
 * Every call is best-effort: an automation failure must never break the
 * business action that triggered it.
 */
import { configNumber, ruleCategory } from "@/lib/automation/rules";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type RuleState = { enabled: boolean; config: Record<string, unknown> };

async function loadRule(key: string): Promise<RuleState> {
  try {
    const db = await admin();
    const { data } = await db
      .from("automation_rules")
      .select("enabled, config")
      .eq("key", key)
      .maybeSingle();
    if (!data) return { enabled: true, config: {} };
    return {
      enabled: Boolean(data.enabled),
      config: (data.config ?? {}) as Record<string, unknown>,
    };
  } catch {
    return { enabled: true, config: {} };
  }
}

type LogEntry = {
  ruleKey: string;
  event: string;
  title: string;
  detail?: string | null;
  status?: "success" | "skipped" | "failed";
  entityType?: string | null;
  entityId?: string | null;
  meta?: Record<string, unknown>;
};

export async function logAutomation(entry: LogEntry): Promise<void> {
  try {
    const db = await admin();
    await db.from("automation_logs").insert({
      rule_key: entry.ruleKey,
      category: ruleCategory(entry.ruleKey),
      event: entry.event,
      status: entry.status ?? "success",
      title: entry.title,
      detail: entry.detail ?? null,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      meta: (entry.meta ?? {}) as never,
    });
  } catch (error) {
    console.error(
      `[automation] log failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

type TaskEntry = {
  ruleKey: string;
  kind: string;
  title: string;
  detail?: string | null;
  priority?: "urgent" | "high" | "normal";
  dueAt: Date;
  assignee?: string | null;
  leadId?: string | null;
  proposalId?: string | null;
  invoiceId?: string | null;
  projectId?: string | null;
  clientId?: string | null;
  meta?: Record<string, unknown>;
};

/** Creates a reminder unless an identical pending one already exists. */
export async function scheduleTask(entry: TaskEntry): Promise<boolean> {
  try {
    const db = await admin();
    let existing = db
      .from("automation_tasks")
      .select("id")
      .eq("rule_key", entry.ruleKey)
      .eq("kind", entry.kind)
      .eq("status", "pending");

    if (entry.leadId) existing = existing.eq("lead_id", entry.leadId);
    if (entry.proposalId) existing = existing.eq("proposal_id", entry.proposalId);
    if (entry.invoiceId) existing = existing.eq("invoice_id", entry.invoiceId);
    if (entry.projectId) existing = existing.eq("project_id", entry.projectId);

    const { data: dup } = await existing.limit(1).maybeSingle();
    if (dup) return false;

    await db.from("automation_tasks").insert({
      rule_key: entry.ruleKey,
      kind: entry.kind,
      title: entry.title,
      detail: entry.detail ?? null,
      priority: entry.priority ?? "normal",
      due_at: entry.dueAt.toISOString(),
      assignee: entry.assignee ?? null,
      lead_id: entry.leadId ?? null,
      proposal_id: entry.proposalId ?? null,
      invoice_id: entry.invoiceId ?? null,
      project_id: entry.projectId ?? null,
      client_id: entry.clientId ?? null,
      meta: (entry.meta ?? {}) as never,
    });
    return true;
  } catch (error) {
    console.error(
      `[automation] task failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

async function notify(lines: string[]): Promise<boolean> {
  try {
    const { sendTelegramMessage } = await import("@/lib/telegram.server");
    const result = await sendTelegramMessage(lines.join("\n"));
    return result.ok;
  } catch {
    return false;
  }
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 3_600_000);
}

/* --------------------------------- Events --------------------------------- */

export type AutomationEvent =
  | {
      type: "lead.created";
      leadId: string | null;
      name: string;
      contact: string;
      projectType: string;
      budget: string;
      score: number;
      temperature: string;
      source: string;
    }
  | {
      type: "lead.status_changed";
      leadId: string;
      name: string;
      status: string;
    }
  | {
      type: "proposal.status_changed";
      proposalId: string;
      leadId: string | null;
      title: string;
      status: string;
      clientName: string | null;
    }
  | {
      type: "invoice.paid";
      invoiceId: string;
      leadId: string | null;
      number: string;
      amount: number;
      currency: string;
      clientName: string | null;
    }
  | {
      type: "project.created";
      projectId: string;
      clientId: string | null;
      name: string;
      template: string;
      invoiceNumber: string | null;
    }
  | {
      type: "project.updated";
      projectId: string;
      clientId: string | null;
      name: string;
      stage: string;
      status: string;
      progress: number;
    }
  | {
      type: "project.milestone_completed";
      projectId: string;
      clientId: string | null;
      projectName: string;
      milestone: string;
      progress: number;
    }
  | {
      type: "client.approval_granted";
      projectId: string;
      clientName: string;
      projectName: string;
      milestone: string;
    };

/** Entry point used by the business modules. Never throws. */
export async function runAutomation(event: AutomationEvent): Promise<void> {
  try {
    await dispatch(event);
  } catch (error) {
    console.error(
      `[automation] ${event.type} failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    await logAutomation({
      ruleKey: event.type,
      event: event.type,
      status: "failed",
      title: "Automation gagal dijalankan",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function dispatch(event: AutomationEvent): Promise<void> {
  switch (event.type) {
    case "lead.created":
      return onLeadCreated(event);
    case "lead.status_changed":
      return onLeadStatus(event);
    case "proposal.status_changed":
      return onProposalStatus(event);
    case "invoice.paid":
      return onInvoicePaid(event);
    case "project.created":
      return onProjectCreated(event);
    case "project.updated":
      return onProjectUpdated(event);
    case "project.milestone_completed":
      return onMilestoneCompleted(event);
    case "client.approval_granted":
      return onApprovalGranted(event);
  }
}

/* ----------------------------- Lead automation ---------------------------- */

async function onLeadCreated(event: Extract<AutomationEvent, { type: "lead.created" }>) {
  const notifyRule = await loadRule("lead.new_notification");
  if (notifyRule.enabled) {
    await logAutomation({
      ruleKey: "lead.new_notification",
      event: event.type,
      title: `Lead baru: ${event.name}`,
      detail: `${event.projectType} · ${event.budget} · sumber ${event.source}`,
      entityType: "lead",
      entityId: event.leadId,
    });
  }

  const scoring = await loadRule("lead.scoring");
  if (scoring.enabled) {
    await logAutomation({
      ruleKey: "lead.scoring",
      event: event.type,
      title: `Lead scoring: ${event.score} (${event.temperature})`,
      detail: `Skor dihitung otomatis untuk ${event.name}.`,
      entityType: "lead",
      entityId: event.leadId,
    });
  }

  const hot = await loadRule("lead.hot_alert");
  const minScore = configNumber(hot.config, "minScore", 70);
  const isHot = event.score >= minScore || /hot/i.test(event.temperature);
  if (hot.enabled && isHot) {
    const sent = await notify([
      "🔥 <b>HOT LEAD ALERT</b>",
      `Nama: ${event.name}`,
      `Kontak: ${event.contact}`,
      `Project: ${event.projectType}`,
      `Budget: ${event.budget}`,
      `Skor: ${event.score} (${event.temperature})`,
    ]);
    await logAutomation({
      ruleKey: "lead.hot_alert",
      event: event.type,
      status: sent ? "success" : "failed",
      title: `Hot lead alert: ${event.name}`,
      detail: `Skor ${event.score} ≥ ambang ${minScore}.`,
      entityType: "lead",
      entityId: event.leadId,
    });
  }

  const followUp = await loadRule("lead.follow_up_reminder");
  if (followUp.enabled && event.leadId) {
    const delay = configNumber(followUp.config, "delayHours", 24);
    const created = await scheduleTask({
      ruleKey: "lead.follow_up_reminder",
      kind: "lead_follow_up",
      title: `Follow up lead ${event.name}`,
      detail: `${event.projectType} · ${event.budget}. Hubungi via ${event.contact}.`,
      priority: isHot ? "urgent" : "high",
      dueAt: hoursFromNow(isHot ? Math.min(delay, 4) : delay),
      leadId: event.leadId,
    });
    if (created) {
      await logAutomation({
        ruleKey: "lead.follow_up_reminder",
        event: event.type,
        title: `Reminder follow-up dibuat untuk ${event.name}`,
        detail: `Jatuh tempo dalam ${isHot ? Math.min(delay, 4) : delay} jam.`,
        entityType: "lead",
        entityId: event.leadId,
      });
    }
  }
}

async function onLeadStatus(event: Extract<AutomationEvent, { type: "lead.status_changed" }>) {
  const rule = await loadRule("sales.follow_up_schedule");
  const closing = /won|completed|closed|lost/i.test(event.status);

  if (rule.enabled && !closing) {
    const delayDays = configNumber(rule.config, "delayDays", 2);
    await scheduleTask({
      ruleKey: "sales.follow_up_schedule",
      kind: "sales_follow_up",
      title: `Follow up ${event.name} — status ${event.status}`,
      detail: "Jadwal follow-up otomatis dari perubahan status pipeline.",
      priority: "normal",
      dueAt: hoursFromNow(delayDays * 24),
      leadId: event.leadId,
    });
  }

  if (/negotiat|negosiasi/i.test(event.status)) {
    const nego = await loadRule("sales.negotiation_reminder");
    if (nego.enabled) {
      const delayDays = configNumber(nego.config, "delayDays", 2);
      await scheduleTask({
        ruleKey: "sales.negotiation_reminder",
        kind: "negotiation_reminder",
        title: `Tutup negosiasi ${event.name}`,
        detail: "Lead sedang negosiasi — pastikan penawaran final dikirim.",
        priority: "high",
        dueAt: hoursFromNow(delayDays * 24),
        leadId: event.leadId,
      });
    }
  }

  await logAutomation({
    ruleKey: "sales.follow_up_schedule",
    event: event.type,
    status: rule.enabled ? "success" : "skipped",
    title: `Status lead ${event.name} → ${event.status}`,
    detail: closing ? "Tidak ada follow-up terjadwal (deal selesai)." : "Follow-up dijadwalkan.",
    entityType: "lead",
    entityId: event.leadId,
  });
}

/* ---------------------------- Sales automation ---------------------------- */

async function onProposalStatus(
  event: Extract<AutomationEvent, { type: "proposal.status_changed" }>,
) {
  if (/^sent$/i.test(event.status)) {
    const rule = await loadRule("sales.proposal_sent_reminder");
    if (rule.enabled) {
      const delayDays = configNumber(rule.config, "delayDays", 3);
      await scheduleTask({
        ruleKey: "sales.proposal_sent_reminder",
        kind: "proposal_follow_up",
        title: `Cek respon proposal: ${event.title}`,
        detail: `Proposal untuk ${event.clientName ?? "klien"} sudah dikirim. Follow up bila belum ada respon.`,
        priority: "high",
        dueAt: hoursFromNow(delayDays * 24),
        proposalId: event.proposalId,
        leadId: event.leadId,
      });
      await logAutomation({
        ruleKey: "sales.proposal_sent_reminder",
        event: event.type,
        title: `Reminder proposal dibuat: ${event.title}`,
        detail: `Follow-up otomatis dalam ${delayDays} hari.`,
        entityType: "proposal",
        entityId: event.proposalId,
      });
    }
    return;
  }

  if (/negotiat|negosiasi/i.test(event.status)) {
    const rule = await loadRule("sales.negotiation_reminder");
    if (rule.enabled) {
      const delayDays = configNumber(rule.config, "delayDays", 2);
      await scheduleTask({
        ruleKey: "sales.negotiation_reminder",
        kind: "negotiation_reminder",
        title: `Negosiasi berjalan: ${event.title}`,
        detail: "Siapkan penyesuaian scope/harga dan target closing.",
        priority: "high",
        dueAt: hoursFromNow(delayDays * 24),
        proposalId: event.proposalId,
        leadId: event.leadId,
      });
      await logAutomation({
        ruleKey: "sales.negotiation_reminder",
        event: event.type,
        title: `Reminder negosiasi: ${event.title}`,
        entityType: "proposal",
        entityId: event.proposalId,
      });
    }
    return;
  }

  if (/approved|won/i.test(event.status)) {
    const rule = await loadRule("sales.deal_closed");
    if (rule.enabled) {
      const sent = await notify([
        "🎉 <b>DEAL CLOSED</b>",
        `Proposal: ${event.title}`,
        `Klien: ${event.clientName ?? "-"}`,
        "Langkah berikutnya: terbitkan invoice.",
      ]);
      await logAutomation({
        ruleKey: "sales.deal_closed",
        event: event.type,
        status: sent ? "success" : "failed",
        title: `Deal closed: ${event.title}`,
        entityType: "proposal",
        entityId: event.proposalId,
      });
    }
  }
}

/* --------------------------- Project automation --------------------------- */

async function onInvoicePaid(event: Extract<AutomationEvent, { type: "invoice.paid" }>) {
  const deal = await loadRule("sales.deal_closed");
  if (deal.enabled) {
    const sent = await notify([
      "💰 <b>PEMBAYARAN DITERIMA</b>",
      `Invoice: ${event.number}`,
      `Klien: ${event.clientName ?? "-"}`,
      `Nilai: ${event.currency} ${event.amount.toLocaleString("id-ID")}`,
    ]);
    await logAutomation({
      ruleKey: "sales.deal_closed",
      event: event.type,
      status: sent ? "success" : "failed",
      title: `Invoice ${event.number} lunas`,
      detail: `${event.currency} ${event.amount.toLocaleString("id-ID")}`,
      entityType: "invoice",
      entityId: event.invoiceId,
    });
  }

  const workflow = await loadRule("project.create_on_paid");
  await logAutomation({
    ruleKey: "project.create_on_paid",
    event: event.type,
    status: workflow.enabled ? "success" : "skipped",
    title: workflow.enabled
      ? `Workflow project dijalankan untuk invoice ${event.number}`
      : `Workflow project dilewati (rule nonaktif)`,
    entityType: "invoice",
    entityId: event.invoiceId,
  });
}

async function onProjectCreated(event: Extract<AutomationEvent, { type: "project.created" }>) {
  await logAutomation({
    ruleKey: "project.create_on_paid",
    event: event.type,
    title: `Project dibuat: ${event.name}`,
    detail: event.invoiceNumber ? `Dari invoice ${event.invoiceNumber}.` : null,
    entityType: "project",
    entityId: event.projectId,
  });

  const template = await loadRule("project.apply_template");
  if (template.enabled) {
    await logAutomation({
      ruleKey: "project.apply_template",
      event: event.type,
      title: `Template diterapkan: ${event.template}`,
      detail: `Timeline & milestone awal disiapkan untuk ${event.name}.`,
      entityType: "project",
      entityId: event.projectId,
    });
  }

  await scheduleTask({
    ruleKey: "project.create_on_paid",
    kind: "project_kickoff",
    title: `Kickoff project ${event.name}`,
    detail: "Jadwalkan kickoff & konfirmasi kebutuhan awal dengan klien.",
    priority: "high",
    dueAt: hoursFromNow(24),
    projectId: event.projectId,
    clientId: event.clientId,
  });
}

async function onProjectUpdated(event: Extract<AutomationEvent, { type: "project.updated" }>) {
  const rule = await loadRule("client.project_update");
  if (!rule.enabled) return;
  await logAutomation({
    ruleKey: "client.project_update",
    event: event.type,
    title: `Update project ${event.name}`,
    detail: `Stage ${event.stage} · ${event.status} · progres ${event.progress}%`,
    entityType: "project",
    entityId: event.projectId,
  });
}

async function onMilestoneCompleted(
  event: Extract<AutomationEvent, { type: "project.milestone_completed" }>,
) {
  const rule = await loadRule("project.milestone_notification");
  if (rule.enabled) {
    const sent = await notify([
      "✅ <b>MILESTONE SELESAI</b>",
      `Project: ${event.projectName}`,
      `Milestone: ${event.milestone}`,
      `Progres: ${event.progress}%`,
    ]);
    await logAutomation({
      ruleKey: "project.milestone_notification",
      event: event.type,
      status: sent ? "success" : "failed",
      title: `Milestone selesai: ${event.milestone}`,
      detail: event.projectName,
      entityType: "project",
      entityId: event.projectId,
    });
  }

  const clientRule = await loadRule("client.milestone_complete");
  if (clientRule.enabled && event.clientId) {
    try {
      const db = await admin();
      await db.from("client_messages").insert({
        client_id: event.clientId,
        sender: "team",
        author_name: "KERJAKU Automation",
        body: `Milestone "${event.milestone}" pada project ${event.projectName} telah selesai. Progres project kini ${event.progress}%.`,
      });
      await logAutomation({
        ruleKey: "client.milestone_complete",
        event: event.type,
        title: `Notifikasi milestone dikirim ke klien`,
        detail: `${event.projectName} — ${event.milestone}`,
        entityType: "project",
        entityId: event.projectId,
      });
    } catch (error) {
      await logAutomation({
        ruleKey: "client.milestone_complete",
        event: event.type,
        status: "failed",
        title: "Notifikasi milestone ke klien gagal",
        detail: error instanceof Error ? error.message : String(error),
        entityType: "project",
        entityId: event.projectId,
      });
    }
  }

  const approval = await loadRule("client.approval_request");
  if (approval.enabled && event.clientId) {
    await scheduleTask({
      ruleKey: "client.approval_request",
      kind: "client_approval",
      title: `Minta approval klien — ${event.milestone}`,
      detail: `Pastikan klien menyetujui milestone pada project ${event.projectName}.`,
      priority: "high",
      dueAt: hoursFromNow(48),
      projectId: event.projectId,
      clientId: event.clientId,
    });
  }
}

async function onApprovalGranted(
  event: Extract<AutomationEvent, { type: "client.approval_granted" }>,
) {
  const rule = await loadRule("client.approval_request");
  const sent = rule.enabled
    ? await notify([
        "🟢 <b>APPROVAL KLIEN</b>",
        `Klien: ${event.clientName}`,
        `Project: ${event.projectName}`,
        `Milestone: ${event.milestone}`,
      ])
    : false;

  await logAutomation({
    ruleKey: "client.approval_request",
    event: event.type,
    status: rule.enabled ? (sent ? "success" : "failed") : "skipped",
    title: `Milestone disetujui klien: ${event.milestone}`,
    detail: `${event.clientName} · ${event.projectName}`,
    entityType: "project",
    entityId: event.projectId,
  });

  try {
    const db = await admin();
    await db
      .from("automation_tasks")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("project_id", event.projectId)
      .eq("kind", "client_approval")
      .eq("status", "pending");
  } catch {
    /* best effort */
  }
}

/* ------------------------------- Due scanner ------------------------------ */

/**
 * Periodic pass: creates deadline reminders for projects and delivery tasks,
 * and alerts on overdue automation tasks. Safe to run repeatedly (deduped).
 */
export async function scanAutomationDue(): Promise<{
  created: number;
  overdue: number;
  scanned: number;
  outbound: { followUps: number; staleReady: number; scanned: number };
}> {
  const rule = await loadRule("project.deadline_reminder");
  const db = await admin();
  const leadDays = configNumber(rule.config, "leadDays", 3);
  const horizon = new Date(Date.now() + leadDays * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  let created = 0;
  let scanned = 0;

  if (rule.enabled) {
    const { data: projects } = await db
      .from("client_projects")
      .select("id, name, client_id, target_date, status")
      .not("target_date", "is", null)
      .lte("target_date", horizon)
      .neq("status", "Completed");

    for (const project of projects ?? []) {
      scanned += 1;
      const late = (project.target_date ?? today) < today;
      const ok = await scheduleTask({
        ruleKey: "project.deadline_reminder",
        kind: "project_deadline",
        title: `${late ? "Deadline terlewat" : "Deadline mendekat"}: ${project.name}`,
        detail: `Target ${project.target_date}. Pastikan delivery sesuai jadwal.`,
        priority: late ? "urgent" : "high",
        dueAt: new Date(),
        projectId: project.id,
        clientId: project.client_id,
      });
      if (ok) created += 1;
    }

    const { data: tasks } = await db
      .from("project_tasks")
      .select("id, title, project_id, due_date, status")
      .not("due_date", "is", null)
      .lte("due_date", horizon)
      .neq("status", "Done");

    for (const task of tasks ?? []) {
      scanned += 1;
      const late = (task.due_date ?? today) < today;
      const ok = await scheduleTask({
        ruleKey: "project.deadline_reminder",
        kind: "task_deadline",
        title: `${late ? "Task terlambat" : "Task jatuh tempo"}: ${task.title}`,
        detail: `Due ${task.due_date}.`,
        priority: late ? "urgent" : "normal",
        dueAt: new Date(),
        projectId: task.project_id,
        meta: { taskId: task.id },
      });
      if (ok) created += 1;
    }
  }

  const { data: overdueTasks } = await db
    .from("automation_tasks")
    .select("id")
    .eq("status", "pending")
    .lt("due_at", new Date().toISOString());
  const overdue = overdueTasks?.length ?? 0;

  // Outbound prospecting reminders (never sends outreach, only internal tasks).
  let outbound = { followUps: 0, staleReady: 0, scanned: 0 };
  const outboundRule = await loadRule("outbound.follow_up_reminder");
  if (outboundRule.enabled) {
    try {
      const { scanProspectFollowUps } = await import("@/lib/prospecting.server");
      outbound = await scanProspectFollowUps();
      scanned += outbound.scanned;
      created += outbound.followUps + outbound.staleReady;
    } catch (error) {
      await logAutomation({
        ruleKey: "outbound.follow_up_reminder",
        event: "outbound.scan",
        status: "failed",
        title: "Scan outbound gagal",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await logAutomation({
    ruleKey: "project.deadline_reminder",
    event: "automation.scan",
    status: rule.enabled ? "success" : "skipped",
    title: `Scan automation selesai`,
    detail: `${created} reminder baru · ${overdue} tugas jatuh tempo · ${scanned} record diperiksa.`,
  });

  return { created, overdue, scanned, outbound };
}
