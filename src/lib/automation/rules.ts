/** Client-safe automation model shared by the engine and the admin UI. */

export const AUTOMATION_CATEGORIES = ["lead", "sales", "project", "client", "outbound"] as const;
export type AutomationCategory = (typeof AUTOMATION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<AutomationCategory, string> = {
  lead: "Lead Automation",
  sales: "Sales Automation",
  project: "Project Automation",
  client: "Client Automation",
  outbound: "Outbound Automation",
};

export const CATEGORY_DESCRIPTIONS: Record<AutomationCategory, string> = {
  lead: "Notifikasi, scoring, dan reminder untuk lead baru.",
  sales: "Follow-up proposal, negosiasi, dan notifikasi deal.",
  project: "Workflow delivery otomatis setelah pembayaran.",
  client: "Update, approval, dan notifikasi milestone ke klien.",
  outbound: "Reminder follow-up prospek outbound yang sudah disetujui manusia.",
};

export const AUTOMATION_RULE_KEYS = [
  "lead.new_notification",
  "lead.scoring",
  "lead.follow_up_reminder",
  "lead.hot_alert",
  "sales.proposal_sent_reminder",
  "sales.follow_up_schedule",
  "sales.negotiation_reminder",
  "sales.deal_closed",
  "project.create_on_paid",
  "project.apply_template",
  "project.deadline_reminder",
  "project.milestone_notification",
  "client.milestone_complete",
  "client.approval_request",
  "client.project_update",
  "outbound.follow_up_reminder",
  "outbound.stale_ready_alert",
] as const;
export type AutomationRuleKey = (typeof AUTOMATION_RULE_KEYS)[number];

export type AutomationRule = {
  id: string;
  key: string;
  category: string;
  label: string;
  description: string | null;
  enabled: boolean;
  config: Record<string, unknown>;
  updated_at: string;
};

export type AutomationTask = {
  id: string;
  rule_key: string;
  kind: string;
  title: string;
  detail: string | null;
  status: string;
  priority: string;
  due_at: string;
  assignee: string | null;
  lead_id: string | null;
  proposal_id: string | null;
  invoice_id: string | null;
  project_id: string | null;
  client_id: string | null;
  created_at: string;
  completed_at: string | null;
};

export type AutomationLog = {
  id: string;
  rule_key: string;
  category: string;
  event: string;
  status: string;
  title: string;
  detail: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

export const TASK_STATUSES = ["pending", "done", "dismissed"] as const;
export type AutomationTaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["urgent", "high", "normal"] as const;

export function ruleCategory(key: string): AutomationCategory {
  const prefix = key.split(".")[0];
  return (AUTOMATION_CATEGORIES as readonly string[]).includes(prefix ?? "")
    ? (prefix as AutomationCategory)
    : "lead";
}

export function configNumber(
  config: Record<string, unknown> | null | undefined,
  key: string,
  fallback: number,
): number {
  const value = config?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function priorityClass(priority: string): string {
  switch (priority) {
    case "urgent":
      return "border-destructive/40 bg-destructive/15 text-destructive";
    case "high":
      return "border-primary/40 bg-primary/15 text-primary";
    default:
      return "border-border/60 bg-muted/30 text-muted-foreground";
  }
}

export function logStatusClass(status: string): string {
  switch (status) {
    case "failed":
      return "border-destructive/40 bg-destructive/15 text-destructive";
    case "skipped":
      return "border-border/60 bg-muted/30 text-muted-foreground";
    default:
      return "border-primary/40 bg-primary/15 text-primary";
  }
}

export function isOverdue(task: AutomationTask, now = Date.now()): boolean {
  return task.status === "pending" && new Date(task.due_at).getTime() < now;
}

export function relativeDue(due: string, now = Date.now()): string {
  const diff = new Date(due).getTime() - now;
  const abs = Math.abs(diff);
  const hours = Math.round(abs / 3_600_000);
  const label = hours < 24 ? `${Math.max(hours, 1)} jam` : `${Math.round(hours / 24)} hari`;
  return diff >= 0 ? `dalam ${label}` : `telat ${label}`;
}
