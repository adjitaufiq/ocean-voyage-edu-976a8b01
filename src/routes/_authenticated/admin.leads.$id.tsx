import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LeadOrderBriefCard } from "@/components/admin/LeadOrderBriefCard";
import { SalesAssistant } from "@/components/admin/SalesAssistant";
import { Chip, GlassCard } from "@/components/admin/ui";
import {
  generateProposal,
  getAdminLead,
  getLeadProposals,
  updateLeadNotes,
  updateLeadStage,
} from "@/lib/admin.functions";
import { proposalStatusClass } from "@/lib/admin/sales-ai";
import { explainLeadScore, temperatureReason } from "@/lib/admin/lead-score";
import {
  PIPELINE_STAGES,
  formatDate,
  leadSourceLabel,
  normalizeStage,
  stageClass,
  temperatureClass,
  type PipelineStage,
} from "@/lib/admin/pipeline";

export const Route = createFileRoute("/_authenticated/admin/leads/$id")({
  validateSearch: (search: Record<string, unknown>): { ai?: string } =>
    typeof search['ai'] === "string" ? { ai: search['ai'] } : {},

  component: LeadDetailPage,
});


function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asConversation(value: unknown): { q: string; a: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) =>
    item && typeof item === "object" && "q" in item && "a" in item
      ? [{ q: String((item as { q: unknown }).q), a: String((item as { a: unknown }).a) }]
      : [],
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm text-foreground">{value || "-"}</p>
    </div>
  );
}

function LeadDetailPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchLead = useServerFn(getAdminLead);
  const saveStage = useServerFn(updateLeadStage);
  const saveNotes = useServerFn(updateLeadNotes);
  const createProposal = useServerFn(generateProposal);
  const fetchProposals = useServerFn(getLeadProposals);
  const navigate = useNavigate();

  const { data: lead, isLoading, error } = useQuery({
    queryKey: ["admin", "lead", id],
    queryFn: () => fetchLead({ data: { id } }),
  });

  const proposals = useQuery({
    queryKey: ["admin", "lead-proposals", id],
    queryFn: () => fetchProposals({ data: { leadId: id } }),
  });

  const proposalMutation = useMutation({
    mutationFn: () => createProposal({ data: { leadId: id } }),
    onSuccess: async (result) => {
      toast.success("Proposal draft dibuat.");
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      navigate({ to: "/admin/proposals/$id", params: { id: result.id } });
    },
    onError: () => toast.error("Gagal membuat proposal."),
  });

  const { ai: aiParam } = Route.useSearch();
  const [assistantOpen, setAssistantOpen] = useState(Boolean(aiParam));

  const [notes, setNotes] = useState("");

  useEffect(() => {
    setNotes(lead?.admin_notes ?? "");
  }, [lead?.admin_notes]);

  const stageMutation = useMutation({
    mutationFn: (stage: PipelineStage) => saveStage({ data: { id, stage } }),
    onSuccess: async () => {
      toast.success("Stage diperbarui.");
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: () => toast.error("Gagal memperbarui stage."),
  });

  const notesMutation = useMutation({
    mutationFn: () => saveNotes({ data: { id, notes } }),
    onSuccess: async () => {
      toast.success("Catatan disimpan.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "lead", id] });
    },
    onError: () => toast.error("Gagal menyimpan catatan."),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Memuat lead…</p>;
  if (error || !lead) return <p className="text-sm text-destructive">Lead tidak ditemukan.</p>;

  const stage = normalizeStage(lead.status);
  const problems = asStrings(lead.ai_problems);
  const requirements = asStrings(lead.ai_requirements);
  const conversation = asConversation(lead.ai_conversation);
  const score = explainLeadScore(lead);

  function openAssistant() {
    setAssistantOpen(true);
    requestAnimationFrame(() => {
      document.getElementById("ai-assistant")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/admin/leads" className="text-xs text-muted-foreground hover:text-foreground">
          ← Kembali ke CRM
        </Link>
        <Chip className={temperatureClass(lead.lead_temperature)}>{lead.lead_temperature}</Chip>
        <Chip className={stageClass(stage)}>{stage}</Chip>
      </div>

      <header className="grid gap-4 rounded-3xl border border-border/40 bg-card/40 p-5 backdrop-blur-xl lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{lead.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {leadSourceLabel(lead.lead_source)} · masuk {formatDate(lead.created_at)} · skor{" "}
            {lead.lead_score}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {lead.whatsapp ? (
            <a
              href={`https://wa.me/${lead.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              WhatsApp
            </a>
          ) : null}
          {lead.email ? (
            <a
              href={`mailto:${lead.email}`}
              className="rounded-xl border border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              Email
            </a>
          ) : null}
          <button
            type="button"
            onClick={openAssistant}
            className="rounded-xl border border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          >
            Generate Follow Up
          </button>
          <button
            type="button"
            onClick={() => proposalMutation.mutate()}
            disabled={proposalMutation.isPending}
            className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {proposalMutation.isPending ? "Menyusun…" : "Generate Proposal"}
          </button>
          <button
            type="button"
            onClick={openAssistant}
            className="rounded-xl border border-primary/40 px-3 py-2 text-xs font-medium text-primary transition hover:bg-primary/10"
          >
            Ask AI About Lead
          </button>
        </div>
      </header>

      <LeadOrderBriefCard leadId={id} />

      <GlassCard>
        <p className="text-sm font-medium">Sales Pipeline</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {PIPELINE_STAGES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={stageMutation.isPending}
              onClick={() => stageMutation.mutate(s)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
                s === stage
                  ? "border-primary/50 bg-primary/20 text-primary"
                  : "border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Terakhir diubah: {formatDate(lead.status_updated_at)}
        </p>
      </GlassCard>

      <GlassCard>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Lead Score Explanation</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {temperatureReason(lead.lead_temperature, score.total)}
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-primary">
            {score.total}
            <span className="text-muted-foreground">/{score.max}</span>
          </span>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted/30">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, Math.round((score.total / score.max) * 100))}%` }}
          />
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {score.factors.map((factor) => (
            <li
              key={factor.label}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-3 text-sm ${
                factor.earned
                  ? "border-primary/30 bg-primary/5"
                  : "border-border/40 bg-background/30 opacity-60"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate">{factor.label}</p>
                {factor.detail ? (
                  <p className="truncate text-xs text-muted-foreground">{factor.detail}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                +{factor.points}
              </span>
            </li>
          ))}
        </ul>
      </GlassCard>


      <div id="ai-assistant" className="scroll-mt-24">
        <SalesAssistant lead={lead} leadId={id} open={assistantOpen} onOpenChange={setAssistantOpen} />
      </div>


      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">AI Proposal Generator</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Draft proposal otomatis dari data CRM lead ini.
            </p>
          </div>
          <button
            type="button"
            onClick={() => proposalMutation.mutate()}
            disabled={proposalMutation.isPending}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {proposalMutation.isPending ? "Menyusun…" : "Generate Proposal"}
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {(proposals.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">Belum ada proposal untuk lead ini.</p>
          ) : (
            (proposals.data ?? []).map((p) => (
              <Link
                key={p.id}
                to="/admin/proposals/$id"
                params={{ id: p.id }}
                className="flex flex-wrap items-center gap-3 rounded-2xl bg-background/40 p-3 transition hover:opacity-80"
              >
                <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                <span className="text-xs text-muted-foreground">{formatDate(p.created_at)}</span>
                <Chip className={proposalStatusClass(p.status)}>{p.status}</Chip>
              </Link>
            ))
          )}
        </div>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <p className="text-sm font-medium">Customer</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Nama" value={lead.name} />
            <Field label="Email" value={lead.email} />
            <Field label="WhatsApp" value={lead.whatsapp} />
            <Field label="Company" value={lead.company} />
            <Field label="Business" value={lead.business_name} />
            <Field label="Kategori Bisnis" value={lead.ai_business_category} />
            <Field label="Jenis Project" value={lead.project_type} />
            <Field label="Budget" value={lead.budget} />
            <Field label="Timeline" value={lead.timeline} />
            <Field label="Device" value={lead.device_type} />
          </div>
        </GlassCard>

        <GlassCard>
          <p className="text-sm font-medium">AI Analysis</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Rekomendasi Paket" value={lead.ai_recommended_package} />
            <Field label="Kompleksitas" value={lead.ai_complexity} />
            <Field label="AI Score" value={lead.ai_lead_score} />
            <Field label="Qualification" value={lead.ai_qualification_status} />
            <Field label="Lead Score" value={lead.lead_score} />
            <Field label="Durasi Kunjungan" value={`${lead.visit_duration_seconds}s`} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                Masalah Bisnis
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {problems.length ? (
                  problems.map((p) => <li key={p}>• {p}</li>)
                ) : (
                  <li className="text-muted-foreground">-</li>
                )}
              </ul>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                Kebutuhan
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {requirements.length ? (
                  requirements.map((r) => <li key={r}>• {r}</li>)
                ) : (
                  <li className="text-muted-foreground">-</li>
                )}
              </ul>
            </div>
          </div>
          {lead.ai_summary ? (
            <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-background/40 p-3 text-sm text-muted-foreground">
              {lead.ai_summary}
            </p>
          ) : null}
        </GlassCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <p className="text-sm font-medium">Kebutuhan dari Form</p>
          <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
            {lead.requirement}
          </p>
          {lead.features ? (
            <p className="mt-3 text-sm text-muted-foreground">Fitur: {lead.features}</p>
          ) : null}
          {lead.notes ? (
            <p className="mt-3 text-sm text-muted-foreground">Catatan klien: {lead.notes}</p>
          ) : null}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Source"
              value={lead.first_touch_channel || lead.visitor_source}
            />
            <Field
              label="Landing Page"
              value={lead.first_touch_landing_page || lead.landing_page}
            />
            <Field
              label="First Content"
              value={lead.first_content_title || lead.first_content_path}
            />
            <Field label="Conversion" value={lead.conversion_surface} />
            <Field label="Campaign" value={lead.utm_campaign} />
            <Field
              label="Last Touch"
              value={lead.last_touch_channel || lead.utm_source}
            />
          </div>
        </GlassCard>

        <GlassCard>
          <p className="text-sm font-medium">Conversation History</p>
          <div className="mt-4 space-y-3">
            {conversation.length ? (
              conversation.map((turn, index) => (
                <div key={index} className="rounded-2xl bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">{turn.q}</p>
                  <p className="mt-1 text-sm">{turn.a}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">Tidak ada percakapan AI.</p>
            )}
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <p className="text-sm font-medium">Catatan Internal</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="mt-3 w-full rounded-2xl border border-border/60 bg-background/40 p-3 text-sm outline-none focus:border-primary/60"
          placeholder="Catatan follow-up, hasil call, kesepakatan…"
        />
        <button
          type="button"
          onClick={() => notesMutation.mutate()}
          disabled={notesMutation.isPending}
          className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {notesMutation.isPending ? "Menyimpan…" : "Simpan catatan"}
        </button>
      </GlassCard>
    </div>
  );
}
