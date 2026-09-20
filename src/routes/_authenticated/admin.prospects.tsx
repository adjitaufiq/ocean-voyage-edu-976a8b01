import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Ban,
  CalendarClock,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { QualificationPanel } from "@/components/admin/QualificationPanel";
import { SalesPrepPanel } from "@/components/admin/SalesPrepPanel";
import type { SalesStage } from "@/lib/admin/sales-prep";
import { GlassCard, MetricTile, SectionCard } from "@/components/admin/ui";
import {
  CAMPAIGN_INDUSTRIES,
  CAMPAIGN_SOLUTIONS,
  campaignSolutionList,
  CAMPAIGN_STATUS_LABELS,
  FIT_TIER_LABELS,
  OUTREACH_CHANNELS,
  PIPELINE_STAGES,
  contactQuality,
  isQueueEligible,
  priorityClass,
  PROSPECT_SOURCES,
  PROSPECT_SOURCE_LABELS,
  PROSPECT_STATUS_LABELS,
  PROSPECT_STATUSES,
  queueBlockers,
  salesPriority,
  VERIFICATION_LABELS,
  verificationClass,
  AUDIT_ACCURACY_THRESHOLD,
  AUDIT_VERDICTS,
  AUDIT_VERDICT_LABELS,
  parseQualityGate,
  parseValidationChecks,
  validationCheckClass,
  VALIDATION_STAGE_LABELS,
  validationStageClass,
  type AuditVerdict,
  type ValidationStage,
  CONTACT_SOURCE_TYPES,
  CONTACT_SOURCE_LABELS,
  PROVENANCE_LABELS,
  type CampaignRow,
  type FitTier,
  type OutreachChannel,
  type ProspectStatus,
} from "@/lib/admin/prospecting";
import {
  addNoteFn,
  convertProspectFn,
  createProspectFn,
  deleteCampaignFn,
  discoverProspectsFn,
  generateIntelligenceFn,
  generateOutreachFn,
  getCampaignsFn,
  getProspectDetail,
  getProspects,
  recordOutreachFn,
  rescoreProspectFn,
  saveCampaignFn,
  saveOutreachDraftFn,
  setDoNotContactFn,
  setFollowUpFn,
  setPipelineStageFn,
  updateProspectFn,
  reverifyProspectsFn,
  validateProspectsFn,
  listAuditsFn,
  sampleAuditFn,
  submitAuditFn,
  getCandidatesFn,
  discoverCandidatesFn,
  rejectCandidateFn,
  restoreCandidateFn,
  requestCandidateReviewFn,
  approveCandidateFn,
  enrichCandidateFn,
  promoteCandidateFn,
  getCandidateEventsFn,
  recomputeTrustFn,
  runEntityResolutionFn,
  getEntityMatchesFn,
  reviewEntityMatchFn,
  planDiscoveryFn,
  runDiscoveryBatchFn,
  retryDiscoveryTasksFn,
  discoveryOverviewFn,
  qualificationBoardFn,
  qualifyCandidatesFn,
  setCandidateQcFn,
  prepareSalesFn,
  prepareSalesOneFn,
  setSalesStageFn,
  salesPrepBoardFn,
  setVerificationItemFn,
  setContactStageFn,
} from "@/lib/prospecting.functions";
import {
  CANDIDATE_STATUS_LABELS,
  candidateStatusClass,
  canTransition,
  ICP_REVIEW_THRESHOLD,
  ACTOR_KIND_LABELS,
  CONTACT_CHANNEL_LABELS,
  type CandidateRow,
  type CandidateEventRow,
} from "@/lib/admin/prospect-candidates";
import {
  DISCOVERY_TASK_STATUS_LABELS,
  type DiscoveryTaskRow,
} from "@/lib/admin/discovery";
import {
  MATCH_STATUS_LABELS,
  TRUST_TIER_LABELS,
  trustTierClass,
  type EntityMatchRow,
  type MatchStatus,
  type TrustTier,
} from "@/lib/admin/trust";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/prospects")({
  head: () => ({
    meta: [
      { title: "Outbound Prospects — KERJAKU" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ProspectsPage,
});

const inputClass =
  "w-full rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm outline-none transition focus:border-primary/60";

type ListRow = {
  id: string;
  business_name: string;
  industry: string | null;
  city: string | null;
  website: string | null;
  contact_name: string | null;
  contact_title?: string | null;
  contact_email: string | null;
  contact_whatsapp: string | null;
  contact_phone?: string | null;
  social_media?: string | null;
  source?: string;
  source_detail?: string | null;
  status: string;
  fit_score: number;
  fit_tier: string;
  trust_score?: number;
  trust_tier?: string;
  do_not_contact: boolean;
  next_follow_up_at: string | null;
  lead_id: string | null;
  business_summary?: string | null;
  business_profile?: string | null;
  industry_fit?: string | null;
  opportunity_reason?: string | null;
  potential_need?: string | null;
  business_problem?: string | null;
  buying_signal?: string | null;
  decision_maker?: string | null;
  sales_priority?: string | null;
  validation_stage?: string | null;
  validation_score?: number | null;
  validation_notes?: string | null;
  validated_at?: string | null;
  quality_gate_passed?: boolean | null;
  rejected_reason?: string | null;

  recommended_solution?: string | null;
  sales_approach?: string | null;
  research_summary?: string | null;
  outreach_draft?: string | null;
  outreach_subject?: string | null;
  fit_breakdown?: unknown;
};

type CampaignDraft = {
  name: string;
  industry: string;
  location: string;
  keywords: string;
  solutions: string[];
  customSolutions: string[];
  primarySolution: string;
  dailyTarget: string;
  notes: string;
};

const emptyDraft = {
  businessName: "",
  industry: "",
  city: "",
  website: "",
  contactName: "",
  contactEmail: "",
  contactWhatsapp: "",
  contactPhone: "",
  socialMedia: "",
  source: "manual",
  researchSummary: "",
  painSignals: "",
  evidence: "",
};

const emptyCampaign: CampaignDraft = {
  name: "",
  industry: CAMPAIGN_INDUSTRIES[0],
  location: "Jakarta",
  keywords: "",
  solutions: [CAMPAIGN_SOLUTIONS[0]],
  customSolutions: [],
  primarySolution: CAMPAIGN_SOLUTIONS[0],
  dailyTarget: "10",
  notes: "",
};

function tierClass(tier: string): string {
  switch (tier) {
    case "high":
      return "border-primary/40 bg-primary/15 text-primary";
    case "medium":
      return "border-accent/40 bg-accent/20 text-accent-foreground";
    default:
      return "border-border/60 bg-muted/30 text-muted-foreground";
  }
}


function ProspectsPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(getProspects);
  const detailFn = useServerFn(getProspectDetail);
  const createFn = useServerFn(createProspectFn);
  const rescoreFn = useServerFn(rescoreProspectFn);
  const draftFn = useServerFn(saveOutreachDraftFn);
  const outreachFn = useServerFn(recordOutreachFn);
  const dncFn = useServerFn(setDoNotContactFn);
  const handoffFn = useServerFn(convertProspectFn);
  const campaignListFn = useServerFn(getCampaignsFn);
  const saveCampaign = useServerFn(saveCampaignFn);
  const deleteCampaign = useServerFn(deleteCampaignFn);
  const discover = useServerFn(discoverProspectsFn);
  const intelligenceFn = useServerFn(generateIntelligenceFn);
  const outreachGenerator = useServerFn(generateOutreachFn);
  const pipelineFn = useServerFn(setPipelineStageFn);
  const followUpFn = useServerFn(setFollowUpFn);
  const noteFn = useServerFn(addNoteFn);
  const updateFn = useServerFn(updateProspectFn);
  const reverifyFn = useServerFn(reverifyProspectsFn);
  const validateFn = useServerFn(validateProspectsFn);
  const auditsFn = useServerFn(listAuditsFn);
  const sampleFn = useServerFn(sampleAuditFn);
  const verdictFn = useServerFn(submitAuditFn);
  const candidatesFn = useServerFn(getCandidatesFn);
  const discoverCandidates = useServerFn(discoverCandidatesFn);
  const rejectCandidate = useServerFn(rejectCandidateFn);
  const restoreCandidate = useServerFn(restoreCandidateFn);
  const requestCandidateReview = useServerFn(requestCandidateReviewFn);
  const approveCandidate = useServerFn(approveCandidateFn);
  const candidateEventsFn = useServerFn(getCandidateEventsFn);
  const enrichCandidate = useServerFn(enrichCandidateFn);
  const promoteCandidate = useServerFn(promoteCandidateFn);
  const [reverifying, setReverifying] = useState(false);
  const [validating, setValidating] = useState(false);

  const [tab, setTab] = useState<
    | "queue"
    | "discovery"
    | "candidates"
    | "qc"
    | "salesprep"
    | "campaigns"
    | "prospects"
    | "duplicates"
    | "audit"
  >("queue");
  const [status, setStatus] = useState("all");
  const [tier, setTier] = useState("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [campaignDraft, setCampaignDraft] = useState(emptyCampaign);
  const [channel, setChannel] = useState<OutreachChannel>("whatsapp");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [followUp, setFollowUp] = useState("");
  const recomputeTrust = useServerFn(recomputeTrustFn);
  const runEntityResolution = useServerFn(runEntityResolutionFn);
  const entityMatchesFn = useServerFn(getEntityMatchesFn);
  const reviewEntityMatch = useServerFn(reviewEntityMatchFn);
  const planDiscovery = useServerFn(planDiscoveryFn);
  const runDiscovery = useServerFn(runDiscoveryBatchFn);
  const retryDiscovery = useServerFn(retryDiscoveryTasksFn);
  const discoveryOverview = useServerFn(discoveryOverviewFn);
  const qualificationBoard = useServerFn(qualificationBoardFn);
  const qualifyCandidates = useServerFn(qualifyCandidatesFn);
  const setCandidateQc = useServerFn(setCandidateQcFn);
  const prepareSales = useServerFn(prepareSalesFn);
  const prepareSalesOne = useServerFn(prepareSalesOneFn);
  const setSalesStage = useServerFn(setSalesStageFn);
  const salesPrepBoard = useServerFn(salesPrepBoardFn);

  const list = useQuery({
    queryKey: ["admin", "prospects", status, tier, search, tab],
    queryFn: () =>
      listFn({
        data: {
          status: tab === "queue" ? "all" : status,
          tier: tab === "queue" ? "all" : tier,
          search,
          actionableOnly: tab === "queue",
        },
      }),
  });
  const campaigns = useQuery({
    queryKey: ["admin", "prospect-campaigns"],
    queryFn: () => campaignListFn(),
  });
  const detail = useQuery({
    queryKey: ["admin", "prospect", openId],
    queryFn: () => detailFn({ data: { id: openId as string } }),
    enabled: Boolean(openId),
  });
  // Acquisition pipeline metrics stay separate from CRM metrics on purpose.
  const acquisitionSummary = useQuery({
    queryKey: ["admin", "prospect-candidates", "summary"],
    queryFn: () => candidatesFn({ data: { limit: 1, status: "all" } }),
  });
  const acquisitionStages = useQuery({
    queryKey: ["admin", "sales-prep-board", "summary"],
    queryFn: () => salesPrepBoard({ data: {} }),
  });


  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "prospects"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "prospect"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "prospect-campaigns"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "prospect-audits"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "prospect-candidates"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "entity-matches"] });
  };
  const run = <T,>(promise: Promise<T>, okMessage: string) =>
    promise
      .then(() => {
        toast.success(okMessage);
        invalidate();
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Gagal memproses aksi.");
      });

  const runReverify = (payload: { id?: string; scope: "one" | "all" }) => {
    setReverifying(true);
    reverifyFn({ data: payload })
      .then((result) => {
        toast.success(
          `Reverifikasi selesai: ${result.scanned} dipindai, ${result.updated} diperbarui, ${result.salesReady} sales ready.`,
        );
        invalidate();
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Gagal memproses reverifikasi.");
      })
      .finally(() => setReverifying(false));
  };

  const runValidation = (payload: { id?: string; scope: "one" | "all" }) => {
    setValidating(true);
    validateFn({ data: payload })
      .then((result) => {
        toast.success(
          `Validasi selesai: ${result.scanned} diperiksa, ${result.verified} verified, ${result.salesReady} sales ready, ${result.rejected} ditolak.`,
        );
        invalidate();
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Gagal menjalankan validasi.");
      })
      .finally(() => setValidating(false));
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          businessName: draft.businessName.trim(),
          industry: draft.industry.trim() || null,
          city: draft.city.trim() || null,
          website: draft.website.trim() || null,
          contactName: draft.contactName.trim() || null,
          contactEmail: draft.contactEmail.trim() || null,
          contactWhatsapp: draft.contactWhatsapp.trim() || null,
          contactPhone: draft.contactPhone.trim() || null,
          socialMedia: draft.socialMedia.trim() || null,
          source: draft.source || "manual",
          researchSummary: draft.researchSummary.trim() || null,
          painSignals: draft.painSignals
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          evidence: draft.evidence
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: (result) => {
      if (result.status === "duplicate") {
        toast.warning("Prospek sudah ada (duplikat terdeteksi).");
        setOpenId(result.id);
      } else {
        toast.success(`Prospek tersimpan. Skor ICP ${result.fitScore}.`);
        setDraft(emptyDraft);
        setShowForm(false);
      }
      invalidate();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan prospek."),
  });

  const rows = (list.data?.prospects ?? []) as ListRow[];
  const summary = list.data?.summary ?? null;
  const campaignRows = (campaigns.data ?? []) as CampaignRow[];
  const selected = detail.data?.prospect as (ListRow & Record<string, unknown>) | undefined;
  const breakdown = useMemo(() => {
    const raw = selected?.fit_breakdown;
    return Array.isArray(raw)
      ? (raw as { label: string; score: number; max: number; detail: string }[])
      : [];
  }, [selected]);
  // Daily Sales Queue hanya berisi prospek yang memenuhi seluruh kriteria
  // verifikasi kontak dan kualitas minimum V3.
  const queueRows = rows.filter((row) => isQueueEligible(row));
  const todayFollowUps = summary?.followUpsToday ?? 0;
  const salesReady = rows.filter((row) => contactQuality(row).status === "sales_ready").length;
  const needVerification = rows.filter(
    (row) => !row.do_not_contact && contactQuality(row).score < 75,
  ).length;
  // Prospek yang hampir layak masuk queue: kontak belum lengkap / belum diverifikasi.
  const verificationRows = rows
    .filter((row) => !row.do_not_contact && !isQueueEligible(row))
    .map((row) => ({ row, quality: contactQuality(row) }))
    .sort((a, b) => b.quality.score - a.quality.score)
    .slice(0, 8);


  const generateMessage = () => {
    if (!selected) return;
    void outreachGenerator({ data: { id: selected.id, channel } })
      .then((result) => {
        setMessage(result.message);
        toast.success("Pesan personal berhasil dibuat.");
      })
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Gagal membuat pesan."),
      );
  };

  const saveCampaignMutation = useMutation({
    mutationFn: () =>
      saveCampaign({
        data: {
          name: campaignDraft.name.trim(),
          industry: campaignDraft.industry,
          location: campaignDraft.location.trim(),
          keywords: campaignDraft.keywords
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          solutions: campaignDraft.solutions,
          customSolutions: campaignDraft.customSolutions,
          primarySolution: campaignDraft.primarySolution || campaignDraft.solutions[0] || null,
          dailyTarget: Number(campaignDraft.dailyTarget) || 10,
          notes: campaignDraft.notes.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Kampanye tersimpan.");
      setCampaignDraft(emptyCampaign);
      setShowCampaignForm(false);
      invalidate();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan kampanye."),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.2em] text-primary">
            Sales acquisition engine
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Prospek outbound</h1>
          <p className="text-sm text-muted-foreground">
            Temukan bisnis yang bisa dihubungi, siapkan konteks, lalu biarkan sales mengirim secara
            manual.
          </p>
        </div>
        <button
          type="button"
          disabled={reverifying}
          onClick={() => runReverify({ scope: "all" })}
          className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm transition hover:border-primary/50 disabled:opacity-60"
        >
          <RefreshCcw className={`h-4 w-4 ${reverifying ? "animate-spin" : ""}`} /> Refresh data
          verification
        </button>
        <button
          type="button"
          disabled={validating}
          onClick={() => runValidation({ scope: "all" })}
          className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm transition hover:border-primary/50 disabled:opacity-60"
        >
          <ShieldCheck className={`h-4 w-4 ${validating ? "animate-pulse" : ""}`} /> Jalankan
          validasi
        </button>
        <button
          type="button"
          onClick={() =>
            void run(recomputeTrust({ data: { scope: "all" } }), "Trust score diperbarui.")
          }
          className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm transition hover:border-primary/50"
        >
          <Sparkles className="h-4 w-4" /> Hitung ulang trust
        </button>
        <button
          type="button"
          onClick={() => setShowCampaignForm((value) => !value)}
          className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm transition hover:border-primary/50"
        >
          <Target className="h-4 w-4" /> Kampanye
        </button>
        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="inline-flex items-center gap-2 rounded-xl border border-border/50 bg-primary/15 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/25"
        >
          <Plus className="h-4 w-4" /> Prospek manual
        </button>
      </header>

      <section className="space-y-2">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Acquisition pipeline (kandidat)
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <MetricTile
            label="Kandidat ditemukan"
            value={acquisitionSummary.data?.summary?.discovered ?? 0}
          />
          <MetricTile
            label="Terverifikasi"
            value={acquisitionSummary.data?.summary?.verified ?? 0}
          />
          <MetricTile
            label="QC approved"
            value={acquisitionSummary.data?.summary?.approved ?? 0}
            tone="primary"
          />
          <MetricTile
            label="Sales prepared"
            value={acquisitionStages.data?.counts?.prepared ?? 0}
          />
          <MetricTile
            label="Ready outreach"
            value={acquisitionStages.data?.counts?.ready ?? 0}
            tone="hot"
          />
        </div>
      </section>

      {summary ? (
        <section className="space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            CRM pipeline (prospek)
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <MetricTile label="Prospek aktif" value={summary.total} />
            <MetricTile label="Sales ready" value={salesReady} tone="primary" />
            <MetricTile label="Perlu verifikasi" value={needVerification} />
            <MetricTile label="Follow-up hari ini" value={todayFollowUps} tone="hot" />
            <MetricTile label="Dihubungi" value={summary.contacted} />
            <MetricTile label="Reply rate" value={`${summary.replyRate}%`} />
            <MetricTile label="Meeting" value={summary.meetings} />
            <MetricTile label="Deal" value={summary.deals} tone="primary" />
          </div>
        </section>
      ) : null}


      <div className="flex flex-wrap gap-2 border-b border-border/40 pb-3">
        {([
          "queue",
          "discovery",
          "candidates",
          "qc",
          "salesprep",
          "campaigns",
          "prospects",
          "duplicates",
          "audit",
        ] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={cn(
              "rounded-xl px-3 py-2 text-sm transition",
              tab === item
                ? "bg-primary/15 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted/30",
            )}
          >
            {item === "queue"
              ? "Daily sales queue"
              : item === "discovery"
                ? "Discovery"
              : item === "candidates"
                ? "Candidate inbox"
                : item === "qc"
                ? "QC review"
                : item === "salesprep"
                ? "Sales preparation"
                : item === "campaigns"
                  ? "Campaigns"
                  : item === "prospects"
                    ? "All prospects"
                    : item === "duplicates"
                      ? "Duplicate review"
                      : "Audit"}
          </button>
        ))}
      </div>

      {showCampaignForm ? (
        <SectionCard
          title="Campaign builder"
          description="Tentukan target pasar sebelum meminta AI menyiapkan kandidat bisnis."
        >
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1 text-sm lg:col-span-2">
              <span className="text-xs text-muted-foreground">Nama kampanye*</span>
              <input
                className={inputClass}
                value={campaignDraft.name}
                onChange={(e) => setCampaignDraft({ ...campaignDraft, name: e.target.value })}
                placeholder="Contoh: Klinik Bandung — AI Assistant"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Target harian</span>
              <input
                type="number"
                min="1"
                max="500"
                className={inputClass}
                value={campaignDraft.dailyTarget}
                onChange={(e) =>
                  setCampaignDraft({ ...campaignDraft, dailyTarget: e.target.value })
                }
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Industri target</span>
              <select
                className={inputClass}
                value={campaignDraft.industry}
                onChange={(e) => setCampaignDraft({ ...campaignDraft, industry: e.target.value })}
              >
                {CAMPAIGN_INDUSTRIES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Lokasi</span>
              <input
                className={inputClass}
                value={campaignDraft.location}
                onChange={(e) => setCampaignDraft({ ...campaignDraft, location: e.target.value })}
                placeholder="Jakarta, Bandung, Indonesia"
              />
            </label>
            <div className="space-y-1 text-sm lg:col-span-3">
              <SolutionPicker draft={campaignDraft} onChange={setCampaignDraft} />
            </div>
            <label className="space-y-1 text-sm lg:col-span-2">
              <span className="text-xs text-muted-foreground">
                Kata kunci, pisahkan dengan koma
              </span>
              <input
                className={inputClass}
                value={campaignDraft.keywords}
                onChange={(e) => setCampaignDraft({ ...campaignDraft, keywords: e.target.value })}
                placeholder="coffee shop, booking, reservasi"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Catatan</span>
              <input
                className={inputClass}
                value={campaignDraft.notes}
                onChange={(e) => setCampaignDraft({ ...campaignDraft, notes: e.target.value })}
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={
                campaignDraft.name.trim().length < 2 ||
                campaignDraft.solutions.length + campaignDraft.customSolutions.length === 0 ||
                saveCampaignMutation.isPending
              }
              onClick={() => saveCampaignMutation.mutate()}
              className="rounded-xl bg-primary/20 px-4 py-2 text-sm font-medium text-primary disabled:opacity-50"
            >
              Simpan kampanye
            </button>
            <button
              type="button"
              onClick={() => setShowCampaignForm(false)}
              className="rounded-xl border border-border/50 px-4 py-2 text-sm"
            >
              Batal
            </button>
          </div>
        </SectionCard>
      ) : null}

      {showForm ? (
        <SectionCard
          title="Prospek baru"
          description="Isi hasil riset manual; skor ICP dihitung otomatis."
        >
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["businessName", "Nama bisnis*"],
                ["industry", "Industri"],
                ["city", "Kota"],
                ["website", "Website"],
                ["contactName", "Nama PIC"],
                ["contactEmail", "Email"],
                ["contactWhatsapp", "WhatsApp"],
                ["contactPhone", "Telepon"],
                ["socialMedia", "Instagram / social media"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="space-y-1 text-sm">
                <span className="text-xs text-muted-foreground">{label}</span>
                <input
                  className={inputClass}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              </label>
            ))}
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Sumber</span>
              <select
                className={inputClass}
                value={draft.source}
                onChange={(e) => setDraft({ ...draft, source: e.target.value })}
              >
                {PROSPECT_SOURCES.map((item) => (
                  <option key={item} value={item}>
                    {PROSPECT_SOURCE_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Ringkasan riset</span>
              <textarea
                rows={4}
                className={inputClass}
                value={draft.researchSummary}
                onChange={(e) => setDraft({ ...draft, researchSummary: e.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Sinyal masalah (1 per baris)</span>
              <textarea
                rows={4}
                className={inputClass}
                value={draft.painSignals}
                onChange={(e) => setDraft({ ...draft, painSignals: e.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Bukti / sumber (1 per baris)</span>
              <textarea
                rows={4}
                className={inputClass}
                value={draft.evidence}
                onChange={(e) => setDraft({ ...draft, evidence: e.target.value })}
              />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={draft.businessName.trim().length < 2 || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              className="rounded-xl bg-primary/20 px-4 py-2 text-sm font-medium text-primary disabled:opacity-50"
            >
              Simpan prospek
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-border/50 px-4 py-2 text-sm"
            >
              Batal
            </button>
          </div>
        </SectionCard>
      ) : null}

      {tab === "discovery" ? (
        <DiscoveryPanel
          campaigns={campaignRows}
          load={() => discoveryOverview({})}
          onPlan={(campaignId) =>
            void run(planDiscovery({ data: { campaignId } }), "Tugas discovery dibuat.")
          }
          onRun={(campaignId) =>
            void run(
              runDiscovery({ data: campaignId ? { campaignId } : {} }),
              "Batch discovery selesai.",
            )
          }
          onRetry={(campaignId) =>
            void run(
              retryDiscovery({ data: campaignId ? { campaignId } : {} }),
              "Tugas gagal dimasukkan ulang ke antrean.",
            )
          }
        />
      ) : tab === "qc" ? (
        <QualificationPanel
          campaigns={campaignRows.map((item) => ({ id: item.id, name: item.name }))}
          load={(input) => qualificationBoard({ data: input })}
          onQualify={(campaignId) =>
            run(
              qualifyCandidates({ data: campaignId ? { campaignId } : {} }),
              "Kualifikasi ulang selesai.",
            )
          }
          onQc={(id, statusValue, reason) =>
            run(
              setCandidateQc({ data: { id, status: statusValue, ...(reason ? { reason } : {}) } }),
              "Keputusan QC tersimpan.",
            )
          }
        />
      ) : tab === "salesprep" ? (
        <SalesPrepPanel
          campaigns={campaignRows.map((item) => ({ id: item.id, name: item.name }))}
          load={(input) => salesPrepBoard({ data: input })}
          onPrepareOne={async (candidateId) => {
            const result = await prepareSalesOne({ data: { candidateId } });
            invalidate();
            return result;
          }}
          onPrepareBatch={async (input) => {
            const result = await prepareSales({ data: input });
            invalidate();
            return result;
          }}
          onStage={(id, stage: SalesStage) =>
            run(setSalesStage({ data: { id, stage } }), "Tahap penjualan diperbarui.")
          }
        />
      ) : tab === "candidates" ? (
        <CandidateInbox
          campaigns={campaignRows}
          load={(input) => candidatesFn({ data: input })}
          onDiscover={(campaignId, count) =>
            run(
              discoverCandidates({ data: { campaignId, count } }),
              "Discovery kandidat selesai.",
            )
          }
          onReject={(id) => run(rejectCandidate({ data: { id } }), "Kandidat ditolak.")}
          onRestore={(id) => run(restoreCandidate({ data: { id } }), "Kandidat dipulihkan.")}
          onRequestReview={(id) =>
            run(requestCandidateReview({ data: { id } }), "Kandidat masuk antrean tinjauan.")
          }
          onApprove={(id, note) =>
            run(approveCandidate({ data: { id, note } }), "Kandidat disetujui.")
          }
          onEnrich={(id) =>
            run(
              enrichCandidate({ data: { id } }),
              "Verifikasi data eksternal selesai.",
            )
          }
          onPromote={(id) => run(promoteCandidate({ data: { id } }), "Kandidat diproses.")}
          loadEvents={(id) => candidateEventsFn({ data: { id } })}
        />
      ) : tab === "campaigns" ? (
        <CampaignList
          campaigns={campaignRows}
          onDiscover={(id) => {
            // Discovery always lands in the candidate pipeline, never in prospects.
            setTab("candidates");
            void run(
              discoverCandidates({ data: { campaignId: id } }),
              "Kandidat baru masuk Candidate inbox.",
            );
          }}

          onDelete={(id) => void run(deleteCampaign({ data: { id } }), "Kampanye dihapus.")}
        />
      ) : tab === "duplicates" ? (
        <DuplicateReview
          load={(input) => entityMatchesFn({ data: input })}
          onScan={() =>
            void run(runEntityResolution({}), "Pemindaian usaha kembar selesai.")
          }
          onReview={(id, status) =>
            void run(reviewEntityMatch({ data: { id, status } }), "Keputusan tersimpan.")
          }
          onOpenProspect={(id) => setOpenId(id)}
        />
      ) : tab === "audit" ? (
        <AuditPanel
          load={(input) => auditsFn({ data: input })}
          onSample={() =>
            void run(sampleFn({ data: {} }), "Sampling audit baru dibuat.")
          }
          onVerdict={(id, verdict, notes) =>
            void run(verdictFn({ data: { id, verdict, notes } }), "Penilaian audit tersimpan.")
          }
          onOpenProspect={(id) => setOpenId(id)}
        />
      ) : (
        <GlassCard className="p-4">
          {tab === "queue" ? (
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Today sales target</h2>
                <p className="text-xs text-muted-foreground">
                  Prioritas bisnis yang punya minimal satu kanal kontak.
                </p>
              </div>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                {queueRows.length} siap ditindaklanjuti
              </span>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Cari bisnis, industri, kota, PIC…"
                className={cn(inputClass, "pl-9")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {tab === "prospects" ? (
              <>
                <select
                  className={cn(inputClass, "w-auto")}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">Semua status</option>
                  {PROSPECT_STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {PROSPECT_STATUS_LABELS[item]}
                    </option>
                  ))}
                </select>
                <select
                  className={cn(inputClass, "w-auto")}
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                >
                  <option value="all">Semua tier</option>
                  {(["high", "medium", "low"] as FitTier[]).map((item) => (
                    <option key={item} value={item}>
                      {FIT_TIER_LABELS[item]}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
          </div>
          <div className="mt-4 space-y-2">
            {list.isLoading ? (
              <p className="text-sm text-muted-foreground">Memuat prospek…</p>
            ) : (tab === "queue" ? queueRows : rows).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tab === "queue"
                  ? "Belum ada prospek yang memenuhi syarat Daily Sales Queue."
                  : "Belum ada prospek. Jalankan discovery AI dari sebuah kampanye atau tambahkan prospek manual."}
              </p>
            ) : (
              (tab === "queue" ? queueRows : rows).map((row) => (
                <ProspectRow key={row.id} row={row} onOpen={() => setOpenId(row.id)} />
              ))
            )}
          </div>
          {tab === "queue" && !list.isLoading && verificationRows.length > 0 ? (
            <div className="mt-6 border-t border-border/40 pt-4">
              <div className="mb-3">
                <h3 className="text-sm font-medium">Prioritas verifikasi</h3>
                <p className="text-xs text-muted-foreground">
                  Kandidat terdekat ke queue, diurutkan dari contact quality tertinggi. Buka detail
                  lalu lengkapi data kontak agar prospek bisa masuk queue.
                </p>
              </div>
              <div className="space-y-2">
                {verificationRows.map(({ row, quality }) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setOpenId(row.id)}
                    className="flex w-full items-start gap-3 rounded-xl border border-border/40 px-3 py-2 text-left transition hover:border-primary/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {row.business_name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {quality.score}/100 · {VERIFICATION_LABELS[quality.status]}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {queueBlockers(row).slice(0, 2).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-primary">Lengkapi</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </GlassCard>
      )}

      {openId ? (
        <ProspectDetail
          selected={selected}
          detail={detail.data}
          breakdown={breakdown}
          channel={channel}
          setChannel={setChannel}
          message={message}
          setMessage={setMessage}
          note={note}
          setNote={setNote}
          followUp={followUp}
          setFollowUp={setFollowUp}
          onClose={() => setOpenId(null)}
          onRun={run}
          onGenerateMessage={generateMessage}
          onIntelligence={() =>
            selected &&
            void run(intelligenceFn({ data: { id: selected.id } }), "Intelligence diperbarui.")
          }
          onRescore={() =>
            selected && void run(rescoreFn({ data: { id: selected.id } }), "Skor diperbarui.")
          }
          onReverify={() => selected && runReverify({ id: selected.id, scope: "one" })}
          reverifying={reverifying}
          onValidate={() => selected && runValidation({ id: selected.id, scope: "one" })}
          validating={validating}
          onSaveDraft={(approve) =>
            selected &&
            void run(
              draftFn({
                data: {
                  id: selected.id,
                  channel,
                  draft: message || selected.outreach_draft || "",
                  approve,
                },
              }),
              approve ? "Draft disetujui." : "Draft tersimpan.",
            )
          }
          onOutreach={(event) =>
            selected &&
            void run(
              outreachFn({
                data: { id: selected.id, event, followUpInDays: event === "sent" ? 3 : null },
              }),
              event === "reply" ? "Balasan tercatat." : "Outreach tercatat.",
            )
          }
          onDnc={() =>
            selected &&
            void run(
              dncFn({
                data: {
                  id: selected.id,
                  enabled: !selected.do_not_contact,
                  reason: "Keputusan manual sales",
                },
              }),
              selected.do_not_contact ? "DNC dicabut." : "Ditandai DO_NOT_CONTACT.",
            )
          }
          onStage={(stage) =>
            selected &&
            void run(
              pipelineFn({ data: { id: selected.id, status: stage } }),
              "Pipeline dipindahkan.",
            )
          }
          onFollowUp={() =>
            selected &&
            void run(
              followUpFn({
                data: {
                  id: selected.id,
                  date: followUp ? new Date(`${followUp}T09:00:00`).toISOString() : null,
                },
              }),
              "Jadwal follow-up disimpan.",
            )
          }
          onNote={() =>
            selected &&
            note.trim() &&
            void run(
              noteFn({ data: { id: selected.id, note: note.trim() } }),
              "Catatan ditambahkan.",
            )
          }
          onHandoff={() =>
            selected && void run(handoffFn({ data: { id: selected.id } }), "Prospek jadi lead CRM.")
          }
          onSaveSources={(payload) =>
            selected &&
            void run(
              updateFn({ data: { id: selected.id, ...payload } }),
              "Sumber kontak diperbarui.",
            )
          }
        />
      ) : null}
    </div>
  );
}

function ProspectRow({ row, onOpen }: { row: ListRow; onOpen: () => void }) {
  const quality = contactQuality(row);
  const priority = salesPriority(quality.score, row.fit_score);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-wrap items-center gap-3 rounded-2xl border border-border/40 bg-card/30 px-4 py-3 text-left transition hover:border-primary/40"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{row.business_name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {[row.industry, row.city, row.contact_name, row.contact_title]
            .filter(Boolean)
            .join(" • ") || "Belum ada detail"}
        </span>
      </span>
      {row.source ? (
        <span className="hidden rounded-full border border-border/50 px-2 py-0.5 text-[0.65rem] text-muted-foreground sm:inline">
          {PROSPECT_SOURCE_LABELS[row.source] ?? row.source}
        </span>
      ) : null}
      {row.do_not_contact ? (
        <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[0.65rem] text-destructive">
          DNC
        </span>
      ) : null}
      <span
        className={cn(
          "rounded-full border px-2 py-0.5 text-[0.65rem] font-medium",
          validationStageClass(String(row.validation_stage ?? "raw")),
        )}
        title="Tahap validasi"
      >
        {VALIDATION_STAGE_LABELS[(row.validation_stage ?? "raw") as ValidationStage] ?? "RAW"}
      </span>
      <span
        className={cn(
          "rounded-full border px-2 py-0.5 text-[0.65rem] font-medium",
          verificationClass(quality.status),
        )}
        title="Contact quality score"
      >
        {quality.score} · {VERIFICATION_LABELS[quality.status]}
      </span>
      <span
        className={cn(
          "hidden rounded-full border px-2 py-0.5 text-[0.65rem] font-medium sm:inline",
          priorityClass(priority),
        )}
      >
        {priority}
      </span>
      <span className="rounded-full border border-border/50 px-2 py-0.5 text-[0.65rem] text-muted-foreground">
        {PROSPECT_STATUS_LABELS[row.status as ProspectStatus] ?? row.status}
      </span>
      <span
        className={cn(
          "rounded-full border px-2 py-0.5 text-[0.65rem] font-medium",
          tierClass(row.fit_tier),
        )}
      >
        {row.fit_score} · {FIT_TIER_LABELS[row.fit_tier as FitTier] ?? row.fit_tier}
      </span>
      <span
        className={cn(
          "rounded-full border px-2 py-0.5 text-[0.65rem] font-medium",
          trustTierClass(row.trust_tier ?? "untrusted"),
        )}
        title="Skor kepercayaan gabungan (ICP, validasi, kualitas AI, bukti eksternal)"
      >
        Trust {row.trust_score ?? 0} ·{" "}
        {TRUST_TIER_LABELS[(row.trust_tier ?? "untrusted") as TrustTier] ?? row.trust_tier}
      </span>
    </button>
  );
}

function SolutionPicker({
  draft,
  onChange,
}: {
  draft: CampaignDraft;
  onChange: (draft: CampaignDraft) => void;
}) {
  const [customInput, setCustomInput] = useState("");
  const all = [...draft.solutions, ...draft.customSolutions];
  const primary = all.includes(draft.primarySolution) ? draft.primarySolution : (all[0] ?? "");
  const secondary = all.filter((item) => item !== primary);

  const toggle = (item: string) => {
    const next = draft.solutions.includes(item)
      ? draft.solutions.filter((value) => value !== item)
      : [...draft.solutions, item];
    const remaining = [...next, ...draft.customSolutions];
    onChange({
      ...draft,
      solutions: next,
      primarySolution: remaining.includes(primary) ? primary : (remaining[0] ?? ""),
    });
  };

  const addCustom = () => {
    const value = customInput.trim();
    if (!value || [...draft.solutions, ...draft.customSolutions].includes(value)) return;
    const customs = [...draft.customSolutions, value];
    onChange({
      ...draft,
      customSolutions: customs,
      primarySolution: primary || value,
    });
    setCustomInput("");
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-background/30 p-3">
      <div>
        <span className="text-xs text-muted-foreground">Solusi ditawarkan (bisa lebih dari satu)</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {CAMPAIGN_SOLUTIONS.map((item) => {
            const active = draft.solutions.includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggle(item)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition",
                  active
                    ? "border-primary/50 bg-primary/20 text-primary"
                    : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {active ? "✓ " : "+ "}
                {item}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs text-muted-foreground">+ Tambahkan solusi custom</span>
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="Contoh: Integrasi WhatsApp Bot"
          />
          <button
            type="button"
            onClick={addCustom}
            className="shrink-0 rounded-xl bg-primary/20 px-3 py-2 text-xs font-medium text-primary"
          >
            Tambah
          </button>
        </div>
        {draft.customSolutions.length ? (
          <div className="flex flex-wrap gap-2">
            {draft.customSolutions.map((item) => (
              <span
                key={item}
                className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary"
              >
                {item}
                <button
                  type="button"
                  aria-label={`Hapus ${item}`}
                  onClick={() => {
                    const customs = draft.customSolutions.filter((value) => value !== item);
                    const remaining = [...draft.solutions, ...customs];
                    onChange({
                      ...draft,
                      customSolutions: customs,
                      primarySolution: remaining.includes(primary) ? primary : (remaining[0] ?? ""),
                    });
                  }}
                  className="text-primary/70 hover:text-primary"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {all.length ? (
        <div className="space-y-2 rounded-lg border border-border/50 bg-background/40 p-3 text-xs">
          <label className="block space-y-1">
            <span className="text-muted-foreground">Primary solution (entry offer)</span>
            <select
              className={inputClass}
              value={primary}
              onChange={(e) => onChange({ ...draft, primarySolution: e.target.value })}
            >
              {all.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <p className="text-muted-foreground">
            <span className="text-foreground">Secondary (upsell):</span>{" "}
            {secondary.join(", ") || "—"}
          </p>
          <p className="text-muted-foreground">
            <span className="text-foreground">Solusi preset:</span>{" "}
            {draft.solutions.join(", ") || "—"}
          </p>
          <p className="text-muted-foreground">
            <span className="text-foreground">Solusi custom:</span>{" "}
            {draft.customSolutions.join(", ") || "—"}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Pilih minimal satu solusi.</p>
      )}
    </div>
  );
}

function CampaignList({
  campaigns,
  onDiscover,
  onDelete,
}: {
  campaigns: CampaignRow[];
  onDiscover: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {campaigns.length === 0 ? (
        <GlassCard>
          <p className="text-sm text-muted-foreground">
            Belum ada kampanye. Buat target pasar pertama untuk memulai discovery.
          </p>
        </GlassCard>
      ) : (
        campaigns.map((campaign) => (
          <GlassCard key={campaign.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold">{campaign.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {campaign.industry} · {campaign.location} · target {campaign.daily_target}/hari
                </p>
              </div>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[0.65rem] text-primary">
                {CAMPAIGN_STATUS_LABELS[campaign.status as keyof typeof CAMPAIGN_STATUS_LABELS] ??
                  campaign.status}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
              {campaignSolutionList(campaign).map((item, index) => (
                <span
                  key={item}
                  className={cn(
                    "rounded-full px-2 py-0.5",
                    index === 0
                      ? "bg-primary/20 text-primary"
                      : "bg-muted/40 text-muted-foreground",
                  )}
                >
                  {index === 0 ? "Primary: " : ""}
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {campaign.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-full bg-muted/30 px-2 py-1 text-[0.65rem] text-muted-foreground"
                >
                  {keyword}
                </span>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{campaign.total_discovered} prospek ditemukan</span>
              <span>
                {campaign.last_run_at
                  ? new Date(campaign.last_run_at).toLocaleDateString("id-ID")
                  : "Belum dijalankan"}
              </span>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => onDiscover(campaign.id)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary"
              >
                <Sparkles className="h-3.5 w-3.5" /> Cari kandidat baru
              </button>
              <button
                type="button"
                aria-label={`Hapus ${campaign.name}`}
                onClick={() => onDelete(campaign.id)}
                className="grid h-8 w-8 place-items-center rounded-xl border border-destructive/30 text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </GlassCard>
        ))
      )}
    </div>
  );
}

function ContactQualityPanel({ selected }: { selected: ListRow & Record<string, unknown> }) {
  const quality = contactQuality(selected);
  const priority = salesPriority(quality.score, selected.fit_score);

  return (
    <div className="mt-4 border-t border-border/40 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Kualitas kontak</span>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[0.65rem] font-medium",
            verificationClass(quality.status),
          )}
        >
          {quality.score}/100 · {VERIFICATION_LABELS[quality.status]}
        </span>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[0.65rem] font-medium",
            priorityClass(priority),
          )}
        >
          Priority {priority}
        </span>
      </div>
      <ul className="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
        {quality.factors.map((factor) => (
          <li key={factor.key} className="flex items-center justify-between gap-3">
            <span>{factor.label}</span>
            <span className="text-foreground">
              {factor.score}/{factor.max}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Asal data kontak</p>
        {quality.provenance
          .filter((entry) => entry.value)
          .map((entry) => (
            <div
              key={entry.channel}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-xs"
            >
              <span className="text-foreground">{entry.label}</span>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[0.65rem]",
                  entry.level === "verified"
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : entry.level === "declared"
                      ? "border-accent/40 bg-accent/20 text-accent-foreground"
                      : "border-destructive/40 bg-destructive/10 text-destructive",
                )}
              >
                {entry.sourceLabel ?? "Tanpa sumber"} · {PROVENANCE_LABELS[entry.level]}
              </span>
              {entry.sourceUrl ? (
                <a
                  href={entry.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Lihat sumber <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          ))}
        {typeof selected.google_maps_url === "string" && selected.google_maps_url ? (
          <a
            href={selected.google_maps_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Open Google Maps <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
        {!quality.hasProvenSource ? (
          <p className="text-xs text-destructive">
            Sumber kontak belum terbukti — prospek tidak akan masuk Daily Sales Queue dan tidak bisa
            berstatus SALES READY.
          </p>
        ) : null}
      </div>
      {quality.socialOnly ? (
        <p className="mt-2 text-xs text-secondary-foreground">
          Social media menjadi satu-satunya kanal; verifikasi kontak diperlukan sebelum outreach.
        </p>
      ) : null}
    </div>
  );
}

const SOURCE_CHANNELS = [
  { key: "phone", label: "Telepon / WhatsApp", type: "phone_source", url: "phone_source_url" },
  { key: "email", label: "Email", type: "email_source", url: "email_source_url" },
  { key: "website", label: "Website", type: "website_source", url: "website_source_url" },
  { key: "social", label: "Social media", type: "social_source", url: "social_source_url" },
] as const;

function ContactSourceForm({
  selected,
  onSave,
}: {
  selected: ListRow & Record<string, unknown>;
  onSave: (payload: Record<string, string | null>) => void;
}) {
  const initial = useMemo(() => {
    const base: Record<string, string> = { google_maps_url: String(selected.google_maps_url ?? "") };
    for (const channel of SOURCE_CHANNELS) {
      base[channel.type] = String(selected[channel.type] ?? "");
      base[channel.url] = String(selected[channel.url] ?? "");
    }
    return base;
  }, [selected]);
  const [form, setForm] = useState(initial);
  const [lastId, setLastId] = useState(selected.id);
  if (lastId !== selected.id) {
    setLastId(selected.id);
    setForm(initial);
  }

  const field = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-3">
      {SOURCE_CHANNELS.map((channel) => (
        <div key={channel.key} className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            {channel.label} — sumber
            <select
              value={form[channel.type] ?? ""}
              onChange={(event) => field(channel.type, event.target.value)}
              className="mt-1 w-full rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-sm text-foreground"
            >
              <option value="">Belum dicatat</option>
              {CONTACT_SOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CONTACT_SOURCE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            URL bukti
            <input
              value={form[channel.url] ?? ""}
              onChange={(event) => field(channel.url, event.target.value)}
              placeholder="https://..."
              className="mt-1 w-full rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-sm text-foreground"
            />
          </label>
        </div>
      ))}
      <label className="block text-xs text-muted-foreground">
        Google Maps URL
        <input
          value={form.google_maps_url ?? ""}
          onChange={(event) => field("google_maps_url", event.target.value)}
          placeholder="https://maps.google.com/..."
          className="mt-1 w-full rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-sm text-foreground"
        />
      </label>
      <button
        type="button"
        onClick={() =>
          onSave({
            phoneSource: form.phone_source || null,
            phoneSourceUrl: form.phone_source_url || null,
            emailSource: form.email_source || null,
            emailSourceUrl: form.email_source_url || null,
            websiteSource: form.website_source || null,
            websiteSourceUrl: form.website_source_url || null,
            socialSource: form.social_source || null,
            socialSourceUrl: form.social_source_url || null,
            googleMapsUrl: form.google_maps_url || null,
          })
        }
        className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary"
      >
        Simpan verifikasi sumber
      </button>
    </div>
  );
}

function ProspectDetail({
  selected,
  detail,
  breakdown,
  channel,
  setChannel,
  message,
  setMessage,
  note,
  setNote,
  followUp,
  setFollowUp,
  onClose,
  onRun,
  onGenerateMessage,
  onIntelligence,
  onRescore,
  onReverify,
  reverifying,
  onValidate,
  validating,
  onSaveDraft,
  onOutreach,
  onDnc,
  onStage,
  onFollowUp,
  onNote,
  onHandoff,
  onSaveSources,
}: {
  selected?: ListRow & Record<string, unknown>;
  detail?: {
    prospect?: Record<string, unknown>;
    activities?: {
      id: string;
      action: string;
      label: string | null;
      content: string | null;
      created_at: string;
      created_by_email: string | null;
    }[];
  };
  breakdown: { label: string; score: number; max: number; detail: string }[];
  channel: OutreachChannel;
  setChannel: (value: OutreachChannel) => void;
  message: string;
  setMessage: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  followUp: string;
  setFollowUp: (value: string) => void;
  onClose: () => void;
  onRun: <T>(promise: Promise<T>, message: string) => void;
  onGenerateMessage: () => void;
  onIntelligence: () => void;
  onRescore: () => void;
  onReverify: () => void;
  reverifying: boolean;
  onValidate: () => void;
  validating: boolean;
  onSaveDraft: (approve: boolean) => void;
  onOutreach: (event: "sent" | "reply") => void;
  onDnc: () => void;
  onStage: (stage: ProspectStatus) => void;
  onFollowUp: () => void;
  onNote: () => void;
  onHandoff: () => void;
  onSaveSources: (payload: Record<string, string | null>) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Tutup detail"
        onClick={onClose}
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
      />
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col gap-4 overflow-y-auto border-l border-border/40 bg-card/95 p-5 backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">
              {selected?.business_name ?? "Memuat…"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {[selected?.industry, selected?.city].filter(Boolean).join(" • ")}
            </p>
          </div>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {selected ? (
          <>
            <SectionCard
              title="Contact information"
              description={
                selected.source
                  ? `Sumber: ${PROSPECT_SOURCE_LABELS[selected.source] ?? selected.source}${selected.source_detail ? ` · ${selected.source_detail}` : ""}`
                  : "Sumber belum dicatat"
              }
            >
              <div className="space-y-2 text-sm">
                {selected.contact_phone ? (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {selected.contact_phone}
                    <button
                      type="button"
                      aria-label="Salin telepon"
                      onClick={() =>
                        void navigator.clipboard?.writeText(selected.contact_phone ?? "")
                      }
                      className="ml-auto text-muted-foreground hover:text-primary"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </p>
                ) : null}
                {selected.contact_whatsapp ? (
                  <p className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    {selected.contact_whatsapp}
                    <button
                      type="button"
                      aria-label="Salin WhatsApp"
                      onClick={() =>
                        void navigator.clipboard?.writeText(selected.contact_whatsapp ?? "")
                      }
                      className="ml-auto text-muted-foreground hover:text-primary"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </p>
                ) : null}
                {selected.contact_email ? (
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {selected.contact_email}
                    <button
                      type="button"
                      aria-label="Salin email"
                      onClick={() =>
                        void navigator.clipboard?.writeText(selected.contact_email ?? "")
                      }
                      className="ml-auto text-muted-foreground hover:text-primary"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </p>
                ) : null}
                {selected.website ? (
                  <a
                    href={selected.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <Globe className="h-4 w-4" />
                    {selected.website}
                    <ExternalLink className="ml-auto h-3.5 w-3.5" />
                  </a>
                ) : null}
                {selected.social_media ? (
                  <a
                    href={selected.social_media}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Social media
                  </a>
                ) : null}
                {selected.contact_title ? (
                  <p className="text-xs text-muted-foreground">
                    Posisi PIC: <span className="text-foreground">{selected.contact_title}</span>
                  </p>
                ) : null}
              </div>
              <ContactQualityPanel selected={selected} />
            </SectionCard>
            <SectionCard
              title="Verifikasi sumber kontak"
              description="Setiap kontak wajib punya source type dan URL bukti sebelum masuk queue."
            >
              <ContactSourceForm selected={selected} onSave={onSaveSources} />
            </SectionCard>
            <SectionCard
              title="Opportunity analysis"
              description="Konteks yang membantu sales membuka percakapan."
            >
              <div className="space-y-3 text-sm">
                <Info
                  label="Business profile"
                  value={selected.business_profile || selected.business_summary || selected.research_summary}
                />
                <Info label="Industry fit" value={selected.industry_fit} />
                <Info label="Mengapa relevan" value={selected.opportunity_reason} />
                <Info label="Kebutuhan potensial" value={selected.potential_need} />
                <Info label="Masalah bisnis" value={selected.business_problem} />
                <Info label="Buying signal" value={selected.buying_signal} />
                <Info label="Decision maker" value={selected.decision_maker} />
                <Info label="Priority" value={selected.sales_priority} />
                <Info label="Solusi disarankan" value={selected.recommended_solution} />
                <Info label="Pendekatan sales" value={selected.sales_approach} />
              </div>
              <button
                type="button"
                onClick={onIntelligence}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-1.5 text-xs"
              >
                <Sparkles className="h-3.5 w-3.5" /> Generate intelligence
              </button>
            </SectionCard>
            <ValidationPanel
              stage={String(selected.validation_stage ?? "raw")}
              score={Number(selected.validation_score ?? 0)}
              notes={(selected.validation_notes as string | null) ?? null}
              rejectedReason={(selected.rejected_reason as string | null) ?? null}
              validatedAt={(selected.validated_at as string | null) ?? null}
              checksRaw={detail?.prospect?.["validation_checks"]}
              gateRaw={detail?.prospect?.["quality_gate"]}
              onValidate={onValidate}
              validating={validating}
            />
            <SectionCard title="ICP score" description={`${selected.fit_score} poin`}>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {breakdown.map((factor) => (
                  <li key={factor.label}>
                    <span className="text-foreground">
                      {factor.label}: {factor.score}/{factor.max}
                    </span>{" "}
                    — {factor.detail}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={onRescore}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-1.5 text-xs"
              >
                <RefreshCcw className="h-3.5 w-3.5" /> Hitung ulang
              </button>
              <button
                type="button"
                onClick={onReverify}
                disabled={reverifying}
                className="ml-2 mt-3 inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-1.5 text-xs disabled:opacity-60"
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${reverifying ? "animate-spin" : ""}`} /> Refresh
                data verification
              </button>
            </SectionCard>
            <SectionCard
              title="Sales action center"
              description="Siapkan dan catat langkah berikutnya."
            >
              <div className="flex flex-wrap gap-2">
                {PIPELINE_STAGES.map((stage) => (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => onStage(stage)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[0.65rem]",
                      selected.status === stage
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-border/50 text-muted-foreground",
                    )}
                  >
                    {PROSPECT_STATUS_LABELS[stage]}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-muted-foreground">
                  Follow-up date
                  <input
                    type="date"
                    className={cn(inputClass, "mt-1")}
                    value={followUp || selected.next_follow_up_at?.slice(0, 10) || ""}
                    onChange={(e) => setFollowUp(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={onFollowUp}
                  className="self-end rounded-xl border border-border/50 px-3 py-2 text-xs"
                >
                  Simpan follow-up
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className={inputClass}
                  placeholder="Tambah catatan…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <button
                  type="button"
                  onClick={onNote}
                  disabled={!note.trim()}
                  className="rounded-xl border border-border/50 px-3 text-xs disabled:opacity-50"
                >
                  Catat
                </button>
              </div>
              <button
                type="button"
                onClick={onDnc}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-destructive/40 px-3 py-1.5 text-xs text-destructive"
              >
                <Ban className="h-3.5 w-3.5" />
                {selected.do_not_contact ? "Cabut DNC" : "DO_NOT_CONTACT"}
              </button>
            </SectionCard>
            <SectionCard
              title="Outreach assistant"
              description="AI membantu menyiapkan; sales tetap mengirim manual."
            >
              <div className="flex flex-wrap gap-2">
                {OUTREACH_CHANNELS.filter((item) => item !== "other").map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setChannel(item)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs capitalize",
                      channel === item
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-border/50 text-muted-foreground",
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <textarea
                rows={7}
                className={cn(inputClass, "mt-3")}
                placeholder="Buat pesan personal berbasis konteks bisnis…"
                value={message || selected.outreach_draft || ""}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onGenerateMessage}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Generate message
                </button>
                <button
                  type="button"
                  disabled={(message || selected.outreach_draft || "").length < 10}
                  onClick={() => onSaveDraft(false)}
                  className="rounded-xl border border-border/50 px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Simpan draft
                </button>
                <button
                  type="button"
                  disabled={(message || selected.outreach_draft || "").length < 10}
                  onClick={() => onSaveDraft(true)}
                  className="rounded-xl border border-primary/30 bg-primary/15 px-3 py-1.5 text-xs text-primary disabled:opacity-50"
                >
                  <Check className="mr-1 inline h-3.5 w-3.5" />
                  Setujui
                </button>
              </div>
            </SectionCard>
            <SectionCard title="Activity & CRM" description="Riwayat keputusan sales dan handoff.">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onOutreach("sent")}
                  className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-1.5 text-xs"
                >
                  <Send className="h-3.5 w-3.5" /> Sudah dikirim
                </button>
                <button
                  type="button"
                  onClick={() => onOutreach("reply")}
                  className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-1.5 text-xs"
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Membalas
                </button>
              </div>
              <div className="mt-3">
                {selected.lead_id ? (
                  <Link
                    to="/admin/leads/$id"
                    params={{ id: selected.lead_id }}
                    className="text-sm text-primary hover:underline"
                  >
                    Buka lead di CRM
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={onHandoff}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Convert prospect → lead
                  </button>
                )}
              </div>
              <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
                {(detail?.activities ?? []).map((item) => (
                  <li key={item.id} className="rounded-xl border border-border/40 px-3 py-2">
                    <span className="text-foreground">{item.label ?? item.action}</span>
                    <span className="block">
                      {new Date(item.created_at).toLocaleString("id-ID")}
                      {item.created_by_email ? ` · ${item.created_by_email}` : ""}
                    </span>
                    {item.content ? (
                      <span className="mt-1 block whitespace-pre-wrap">{item.content}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </SectionCard>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Memuat detail…</p>
        )}
      </aside>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{value || "Belum tersedia"}</p>
    </div>
  );
}

/** Six-check validation result + AI quality gate for a single prospect. */
function ValidationPanel({
  stage,
  score,
  notes,
  rejectedReason,
  validatedAt,
  checksRaw,
  gateRaw,
  onValidate,
  validating,
}: {
  stage: string;
  score: number;
  notes: string | null;
  rejectedReason: string | null;
  validatedAt: string | null;
  checksRaw: unknown;
  gateRaw: unknown;
  onValidate: () => void;
  validating: boolean;
}) {
  const checks = parseValidationChecks(checksRaw);
  const gate = parseQualityGate(gateRaw);
  return (
    <SectionCard
      title="Validasi prospek"
      description={
        validatedAt
          ? `Terakhir divalidasi ${new Date(validatedAt).toLocaleString("id-ID")}`
          : "Prospek belum pernah divalidasi."
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-[0.65rem] font-medium",
            validationStageClass(stage),
          )}
        >
          {VALIDATION_STAGE_LABELS[stage as ValidationStage] ?? "RAW"}
        </span>
        <span className="text-xs text-muted-foreground">Skor validasi {score}/100</span>
      </div>

      {checks.length ? (
        <ul className="mt-3 space-y-1.5">
          {checks.map((check) => (
            <li key={check.key} className="flex items-start gap-2 text-xs">
              <span
                className={cn(
                  "mt-0.5 shrink-0 rounded-full border px-1.5 py-0.5 text-[0.6rem] font-medium uppercase",
                  validationCheckClass(check.state),
                )}
              >
                {check.state}
              </span>
              <span className="min-w-0">
                <span className="text-foreground">{check.label}</span>
                <span className="block text-muted-foreground">{check.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Belum ada hasil pengecekan. Jalankan validasi untuk memeriksa keberadaan bisnis, Google
          Maps, sumber kontak, website, social media, dan duplikat.
        </p>
      )}

      {gate ? (
        <div className="mt-3 rounded-xl border border-border/40 p-3 text-xs">
          <p className="font-medium text-foreground">
            AI quality gate: {gate.passed ? "LULUS" : "TIDAK LULUS"} ({gate.score}/100)
          </p>
          {gate.reasons.length ? (
            <p className="mt-1 text-muted-foreground">Alasan: {gate.reasons.join("; ")}</p>
          ) : null}
          {gate.risks.length ? (
            <p className="mt-1 text-muted-foreground">Risiko: {gate.risks.join("; ")}</p>
          ) : null}
        </div>
      ) : null}

      {rejectedReason ? (
        <p className="mt-3 text-xs text-destructive">Ditolak: {rejectedReason}</p>
      ) : notes ? (
        <p className="mt-3 text-xs text-muted-foreground">{notes}</p>
      ) : null}

      <button
        type="button"
        onClick={onValidate}
        disabled={validating}
        className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-1.5 text-xs disabled:opacity-60"
      >
        <ShieldCheck className={cn("h-3.5 w-3.5", validating && "animate-pulse")} /> Jalankan
        validasi
      </button>
    </SectionCard>
  );
}

type AuditOverviewData = {
  audits: {
    id: string;
    prospect_id: string;
    ai_stage: string | null;
    reviewer_verdict: string | null;
    reviewer_notes: string | null;
    reviewed_by_email: string | null;
    reviewed_at: string | null;
    created_at: string;
    businessName: string;
    city: string | null;
    industry: string | null;
    website: string | null;
    checks: { key: string; label: string; state: string; detail: string }[];
    qualityGate: { passed: boolean; score: number } | null;
  }[];
  pending: number;
  reviewed: number;
  accuracy: number | null;
  campaigns: { id: string; name: string; accuracy: number | null; needsReview: boolean; reviewReason: string | null }[];
};

/** Random Audit Dashboard — owner reviews a 10% sample of validated prospects. */
function AuditPanel({
  load,
  onSample,
  onVerdict,
  onOpenProspect,
}: {
  load: (input: { pendingOnly?: boolean }) => Promise<unknown>;
  onSample: () => void;
  onVerdict: (id: string, verdict: AuditVerdict, notes: string | null) => void;
  onOpenProspect: (id: string) => void;
}) {
  const [pendingOnly, setPendingOnly] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const audits = useQuery({
    queryKey: ["admin", "prospect-audits", pendingOnly],
    queryFn: () => load({ pendingOnly }) as Promise<AuditOverviewData>,
  });
  const data = audits.data;

  return (
    <div className="space-y-4">
      <GlassCard className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Random audit</h2>
            <p className="text-xs text-muted-foreground">
              Sampling acak 10% prospek tervalidasi. Owner menilai akurasi klaim AI; akurasi rendah
              menandai kampanye untuk direview.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={pendingOnly}
              onChange={(e) => setPendingOnly(e.target.checked)}
            />
            Hanya belum direview
          </label>
          <button
            type="button"
            onClick={onSample}
            className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm transition hover:border-primary/50"
          >
            <Sparkles className="h-4 w-4" /> Ambil sampel baru
          </button>
        </div>

        {data ? (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            <MetricTile label="Belum direview" value={data.pending} />
            <MetricTile label="Sudah direview" value={data.reviewed} />
            <MetricTile
              label="Akurasi AI"
              value={data.accuracy === null ? "—" : `${data.accuracy}%`}
              tone={data.accuracy !== null && data.accuracy < AUDIT_ACCURACY_THRESHOLD ? "hot" : "primary"}
            />
          </div>
        ) : null}
      </GlassCard>

      {data?.campaigns.some((campaign) => campaign.needsReview) ? (
        <SectionCard
          title="Kampanye perlu review"
          description={`Akurasi validasi di bawah ${AUDIT_ACCURACY_THRESHOLD}%.`}
        >
          <ul className="space-y-2 text-xs">
            {data.campaigns
              .filter((campaign) => campaign.needsReview)
              .map((campaign) => (
                <li key={campaign.id} className="rounded-xl border border-destructive/30 px-3 py-2">
                  <span className="text-foreground">{campaign.name}</span>
                  <span className="block text-muted-foreground">
                    {campaign.reviewReason ?? `Akurasi ${campaign.accuracy ?? 0}%`}
                  </span>
                </li>
              ))}
          </ul>
        </SectionCard>
      ) : null}

      <GlassCard className="p-4">
        {audits.isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat audit…</p>
        ) : !data?.audits.length ? (
          <p className="text-sm text-muted-foreground">
            Belum ada sampel audit. Klik “Ambil sampel baru” setelah menjalankan validasi.
          </p>
        ) : (
          <div className="space-y-3">
            {data.audits.map((audit) => (
              <div key={audit.id} className="rounded-2xl border border-border/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenProspect(audit.prospect_id)}
                    className="min-w-0 flex-1 text-left text-sm font-medium hover:text-primary"
                  >
                    {audit.businessName}
                  </button>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[0.65rem] font-medium",
                      validationStageClass(audit.ai_stage ?? "raw"),
                    )}
                  >
                    {VALIDATION_STAGE_LABELS[(audit.ai_stage ?? "raw") as ValidationStage] ?? "RAW"}
                  </span>
                  {audit.qualityGate ? (
                    <span className="rounded-full border border-border/50 px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                      Gate {audit.qualityGate.passed ? "lulus" : "gagal"} · {audit.qualityGate.score}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[audit.industry, audit.city, audit.website].filter(Boolean).join(" • ") ||
                    "Tanpa detail"}
                </p>
                {audit.checks.length ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {audit.checks
                      .map((check) => `${check.label}: ${check.state.toUpperCase()}`)
                      .join(" · ")}
                  </p>
                ) : null}

                {audit.reviewer_verdict ? (
                  <p className="mt-2 text-xs text-primary">
                    {AUDIT_VERDICT_LABELS[audit.reviewer_verdict as AuditVerdict] ??
                      audit.reviewer_verdict}
                    {audit.reviewer_notes ? ` — ${audit.reviewer_notes}` : ""}
                    {audit.reviewed_by_email ? ` (${audit.reviewed_by_email})` : ""}
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    <input
                      className={inputClass}
                      placeholder="Catatan reviewer (opsional)"
                      value={notes[audit.id] ?? ""}
                      onChange={(e) => setNotes({ ...notes, [audit.id]: e.target.value })}
                    />
                    <div className="flex flex-wrap gap-2">
                      {AUDIT_VERDICTS.map((verdict) => (
                        <button
                          key={verdict}
                          type="button"
                          onClick={() => onVerdict(audit.id, verdict, notes[audit.id] ?? null)}
                          className="rounded-xl border border-border/50 px-3 py-1.5 text-xs transition hover:border-primary/50"
                        >
                          {AUDIT_VERDICT_LABELS[verdict]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

/* ---------------------------- Candidate inbox ----------------------------- */

const CANDIDATE_STATUS_FILTERS = [
  "discovered",
  "enriching",
  "verified",
  "enrichment_failed",
  "pending_review",
  "approved",
  "promoted",
  "rejected",
] as const;

function CandidateHistory({
  id,
  loadEvents,
}: {
  id: string;
  loadEvents: (id: string) => Promise<CandidateEventRow[]>;
}) {
  const query = useQuery({
    queryKey: ["admin", "prospect-candidate-events", id],
    queryFn: () => loadEvents(id),
  });
  const events = query.data ?? [];

  if (query.isLoading)
    return <p className="mt-3 text-xs text-muted-foreground">Memuat riwayat…</p>;
  if (events.length === 0)
    return <p className="mt-3 text-xs text-muted-foreground">Belum ada riwayat perubahan.</p>;

  return (
    <ul className="mt-3 space-y-2 border-t border-border/40 pt-3 text-xs text-muted-foreground">
      {events.map((event) => (
        <li key={event.id} className="flex flex-wrap gap-x-2">
          <span className="text-foreground/80">{event.event}</span>
          <span>· {ACTOR_KIND_LABELS[event.actor_kind]}</span>
          {event.actor_label ? <span>· {event.actor_label}</span> : null}
          <span>· {new Date(event.created_at).toLocaleString("id-ID")}</span>
          {event.field ? (
            <span>
              · {event.field}: {event.old_value ?? "—"} → {event.new_value ?? "—"}
            </span>
          ) : null}
          {event.data_source ? <span>· sumber {event.data_source}</span> : null}
          {event.reason ? <span className="w-full text-foreground/60">{event.reason}</span> : null}
        </li>
      ))}
    </ul>
  );
}

type CandidateInboxProps = {
  campaigns: CampaignRow[];
  load: (input: { status?: string; campaignId?: string; search?: string }) => Promise<{
    candidates: CandidateRow[];
    summary: Record<string, number>;
  }>;
  onDiscover: (campaignId: string, count: number) => Promise<unknown>;
  onReject: (id: string) => Promise<unknown>;
  onRestore: (id: string) => Promise<unknown>;
  onRequestReview: (id: string) => Promise<unknown>;
  onApprove: (id: string, note: string | null) => Promise<unknown>;
  onEnrich: (id: string) => Promise<unknown>;
  onPromote: (id: string) => Promise<unknown>;
  loadEvents: (id: string) => Promise<CandidateEventRow[]>;
};

function CandidateInbox({
  campaigns,
  load,
  onDiscover,
  onReject,
  onRestore,
  onRequestReview,
  onApprove,
  onEnrich,
  onPromote,
  loadEvents,
}: CandidateInboxProps) {
  const [status, setStatus] = useState("all");
  const [campaignId, setCampaignId] = useState("");
  const [search, setSearch] = useState("");
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [historyFor, setHistoryFor] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin", "prospect-candidates", status, campaignId, search],
    queryFn: () =>
      load({
        status,
        campaignId: campaignId || undefined,
        search: search || undefined,
      }),
  });

  const rows = query.data?.candidates ?? [];
  const summary = query.data?.summary ?? {};

  const guard = (action: () => Promise<unknown>) => {
    setBusy(true);
    void action().finally(() => setBusy(false));
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Candidate inbox"
        description="Kandidat adalah hipotesis AI: hanya nama bisnis dan alasan potensi. Data kontak tidak pernah datang dari AI — kandidat harus diverifikasi dulu sebelum jadi prospek."
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CANDIDATE_STATUS_FILTERS.map((key) => (
            <MetricTile key={key} label={CANDIDATE_STATUS_LABELS[key]} value={summary[key] ?? 0} />
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Kampanye</span>
            <select
              className={inputClass}
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
            >
              <option value="">Semua kampanye</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Status</span>
            <select
              className={inputClass}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">Semua status</option>
              {CANDIDATE_STATUS_FILTERS.map((key) => (
                <option key={key} value={key}>
                  {CANDIDATE_STATUS_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Cari nama bisnis</span>
            <input
              className={inputClass}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nama bisnis"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Jumlah kandidat</span>
            <input
              type="number"
              min={1}
              max={25}
              className={inputClass}
              value={count}
              onChange={(e) => setCount(Number(e.target.value) || 10)}
            />
          </label>
          <button
            type="button"
            disabled={busy || !campaignId}
            onClick={() => guard(() => onDiscover(campaignId, count))}
            className="rounded-xl bg-primary/20 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/30 disabled:opacity-50"
          >
            {busy ? "Memproses…" : "Cari kandidat baru"}
          </button>
        </div>
        {!campaignId ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Pilih satu kampanye dulu untuk menjalankan pencarian kandidat.
          </p>
        ) : null}
      </SectionCard>

      <GlassCard className="p-4">
        {query.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Memuat kandidat…</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Belum ada kandidat pada filter ini.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-border/40 bg-muted/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{row.business_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[row.industry, row.city, row.country].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px]",
                        candidateStatusClass(row.candidate_status),
                      )}
                    >
                      {CANDIDATE_STATUS_LABELS[row.candidate_status]}
                    </span>
                    <span className="rounded-full border border-border/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                      ICP {row.icp_score}
                    </span>
                    {["discovered", "enrichment_failed", "enriching"].includes(
                      row.candidate_status,
                    ) ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => guard(() => onEnrich(row.id))}
                        className="rounded-lg border border-sky-300/40 px-3 py-1 text-xs text-sky-100 transition hover:bg-sky-300/10 disabled:opacity-50"
                      >
                        Verifikasi data eksternal
                      </button>
                    ) : null}
                    {row.candidate_status === "approved" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => guard(() => onPromote(row.id))}
                        className="rounded-lg border border-primary/40 px-3 py-1 text-xs text-primary transition hover:bg-primary/10 disabled:opacity-50"
                      >
                        Promosikan ke prospek
                      </button>
                    ) : null}
                    {canTransition(row.candidate_status, "pending_review") ? (
                      <button
                        type="button"
                        disabled={busy || row.icp_score < ICP_REVIEW_THRESHOLD}
                        title={
                          row.icp_score < ICP_REVIEW_THRESHOLD
                            ? `Skor ICP minimal ${ICP_REVIEW_THRESHOLD} sebelum bisa diajukan.`
                            : undefined
                        }
                        onClick={() => guard(() => onRequestReview(row.id))}
                        className="rounded-lg border border-amber-300/40 px-3 py-1 text-xs text-amber-100 transition hover:bg-amber-300/10 disabled:opacity-50"
                      >
                        Ajukan tinjauan
                      </button>
                    ) : null}
                    {canTransition(row.candidate_status, "approved") ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const note = window.prompt("Catatan persetujuan (opsional)") ?? null;
                          guard(() => onApprove(row.id, note));
                        }}
                        className="rounded-lg border border-emerald-300/40 px-3 py-1 text-xs text-emerald-100 transition hover:bg-emerald-300/10 disabled:opacity-50"
                      >
                        Setujui
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setHistoryFor(historyFor === row.id ? null : row.id)}
                      className="rounded-lg border border-border/50 px-3 py-1 text-xs transition hover:bg-muted/30"
                    >
                      {historyFor === row.id ? "Tutup riwayat" : "Riwayat"}
                    </button>
                    {row.candidate_status === "rejected" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => guard(() => onRestore(row.id))}
                        className="rounded-lg border border-border/50 px-3 py-1 text-xs transition hover:bg-muted/30 disabled:opacity-50"
                      >
                        Pulihkan
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => guard(() => onReject(row.id))}
                        className="rounded-lg border border-border/50 px-3 py-1 text-xs transition hover:bg-muted/30 disabled:opacity-50"
                      >
                        Tolak
                      </button>
                    )}
                  </div>
                </div>
                <dl className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                  {row.why_match_icp ? (
                    <div>
                      <dt className="text-foreground/80">Kenapa cocok</dt>
                      <dd>{row.why_match_icp}</dd>
                    </div>
                  ) : null}
                  {row.potential_problem_hypothesis ? (
                    <div>
                      <dt className="text-foreground/80">Dugaan masalah</dt>
                      <dd>{row.potential_problem_hypothesis}</dd>
                    </div>
                  ) : null}
                  {row.buying_signal_hypothesis ? (
                    <div>
                      <dt className="text-foreground/80">Dugaan sinyal beli</dt>
                      <dd>{row.buying_signal_hypothesis}</dd>
                    </div>
                  ) : null}
                  {row.suggested_solution ? (
                    <div>
                      <dt className="text-foreground/80">Solusi pembuka</dt>
                      <dd>{row.suggested_solution}</dd>
                    </div>
                  ) : null}
                  {row.icp_reason ? (
                    <div>
                      <dt className="text-foreground/80">Alasan skor ICP</dt>
                      <dd>{row.icp_reason}</dd>
                    </div>
                  ) : null}
                </dl>
                {row.approved_at ? (
                  <p className="mt-2 text-xs text-emerald-200">
                    Disetujui {row.approved_by_email ?? "tim"} ·{" "}
                    {new Date(row.approved_at).toLocaleString("id-ID")}
                    {row.approval_note ? ` · ${row.approval_note}` : ""}
                  </p>
                ) : null}
                {row.rejected_reason ? (
                  <p className="mt-2 text-xs text-rose-200">Alasan tolak: {row.rejected_reason}</p>
                ) : null}
                {row.duplicate_status === "duplicate" ? (
                  <p className="mt-2 text-xs text-amber-200">
                    Duplikat{row.duplicate_confidence ? ` (keyakinan ${row.duplicate_confidence}%)` : ""}
                    {row.duplicate_reason ? ` — ${row.duplicate_reason}` : ""}
                    {row.duplicate_detected_at
                      ? ` · terdeteksi ${new Date(row.duplicate_detected_at).toLocaleString("id-ID")}`
                      : ""}
                  </p>
                ) : null}
                {Object.keys(row.contact_data ?? {}).length ? (
                  <div className="mt-3 space-y-1 rounded-lg border border-border/40 bg-background/30 p-3 text-xs">
                    <p className="font-medium text-foreground/80">Data kontak & asal datanya</p>
                    {Object.entries(row.contact_data).map(([channel, entry]) => (
                      <p key={channel} className="text-muted-foreground">
                        <span className="text-foreground/80">
                          {CONTACT_CHANNEL_LABELS[channel] ?? channel}:
                        </span>{" "}
                        {entry.value} · sumber {entry.source}
                        {entry.source_url ? (
                          <>
                            {" "}
                            ·{" "}
                            <a
                              href={entry.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary underline"
                            >
                              Lihat sumber
                            </a>
                          </>
                        ) : null}{" "}
                        · {new Date(entry.verified_at).toLocaleDateString("id-ID")}
                      </p>
                    ))}
                  </div>
                ) : null}
                {historyFor === row.id ? (
                  <CandidateHistory id={row.id} loadEvents={loadEvents} />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

type EntityMatchListItem = EntityMatchRow & {
  business_a: string | null;
  business_b: string | null;
};

function DuplicateReview({
  load,
  onScan,
  onReview,
  onOpenProspect,
}: {
  load: (input: { status?: MatchStatus | "open" }) => Promise<unknown>;
  onScan: () => void;
  onReview: (id: string, status: MatchStatus) => void;
  onOpenProspect: (id: string) => void;
}) {
  const [filter, setFilter] = useState<MatchStatus | "open">("open");
  const matches = useQuery({
    queryKey: ["admin", "entity-matches", filter],
    queryFn: () => load({ status: filter }) as Promise<EntityMatchListItem[]>,
  });
  const rows = matches.data ?? [];

  return (
    <div className="space-y-4">
      <GlassCard className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Duplicate review</h2>
            <p className="text-xs text-muted-foreground">
              Dugaan usaha kembar dari kemiripan nama, domain, telepon, email, kota, dan Google
              Maps. Tidak ada penggabungan otomatis — keputusan tetap di tangan Anda.
            </p>
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as MatchStatus | "open")}
            className={cn(inputClass, "w-auto")}
          >
            <option value="open">Perlu keputusan</option>
            <option value="flagged">{MATCH_STATUS_LABELS.flagged}</option>
            <option value="needs_review">{MATCH_STATUS_LABELS.needs_review}</option>
            <option value="confirmed_duplicate">{MATCH_STATUS_LABELS.confirmed_duplicate}</option>
            <option value="not_duplicate">{MATCH_STATUS_LABELS.not_duplicate}</option>
            <option value="ignored">{MATCH_STATUS_LABELS.ignored}</option>
          </select>
          <button
            type="button"
            onClick={onScan}
            className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm transition hover:border-primary/50"
          >
            <Search className="h-4 w-4" /> Pindai usaha kembar
          </button>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        {matches.isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat dugaan kembar…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada dugaan usaha kembar. Klik “Pindai usaha kembar” untuk memeriksa ulang.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-border/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenProspect(row.prospect_a)}
                    className="text-sm font-medium hover:text-primary"
                  >
                    {row.business_a ?? "Prospek A"}
                  </button>
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  <button
                    type="button"
                    onClick={() => onOpenProspect(row.prospect_b)}
                    className="text-sm font-medium hover:text-primary"
                  >
                    {row.business_b ?? "Prospek B"}
                  </button>
                  <span className="rounded-full border border-border/50 px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                    Kemiripan {row.similarity_score}
                  </span>
                  <span className="rounded-full border border-border/50 px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                    {MATCH_STATUS_LABELS[row.status] ?? row.status}
                  </span>
                </div>
                {row.match_reason.length ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.match_reason.join(" • ")}
                  </p>
                ) : null}
                {row.reviewed_by_email ? (
                  <p className="mt-1 text-[0.65rem] text-muted-foreground">
                    Ditinjau oleh {row.reviewed_by_email}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onReview(row.id, "confirmed_duplicate")}
                    className="inline-flex items-center gap-1 rounded-xl border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive transition hover:bg-destructive/10"
                  >
                    <Check className="h-3.5 w-3.5" /> Memang kembar
                  </button>
                  <button
                    type="button"
                    onClick={() => onReview(row.id, "not_duplicate")}
                    className="inline-flex items-center gap-1 rounded-xl border border-border/50 px-2.5 py-1.5 text-xs transition hover:border-primary/50"
                  >
                    <X className="h-3.5 w-3.5" /> Bukan kembar
                  </button>
                  <button
                    type="button"
                    onClick={() => onReview(row.id, "ignored")}
                    className="inline-flex items-center gap-1 rounded-xl border border-border/50 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-primary/50"
                  >
                    <Ban className="h-3.5 w-3.5" /> Abaikan
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function DiscoveryPanel({
  campaigns,
  load,
  onPlan,
  onRun,
  onRetry,
}: {
  campaigns: CampaignRow[];
  load: () => Promise<unknown>;
  onPlan: (campaignId: string) => void;
  onRun: (campaignId?: string) => void;
  onRetry: (campaignId?: string) => void;
}) {
  const [campaignId, setCampaignId] = useState("");
  const overview = useQuery({
    queryKey: ["admin", "discovery-overview"],
    queryFn: () => load() as Promise<DiscoveryOverviewData>,
  });
  const data = overview.data;
  const scope = campaignId || undefined;

  return (
    <div className="space-y-4">
      <GlassCard className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Discovery engine</h2>
            <p className="text-xs text-muted-foreground">
              Kampanye dipecah menjadi tugas kata kunci x wilayah, lalu dijalankan bertahap di
              server. Kandidat baru selalu masuk Candidate inbox untuk ditinjau.
            </p>
          </div>
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className={cn(inputClass, "w-auto")}
          >
            <option value="">Semua kampanye</option>
            {campaigns.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!campaignId}
            onClick={() => campaignId && onPlan(campaignId)}
            className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm transition hover:border-primary/50 disabled:opacity-40"
          >
            <Target className="h-4 w-4" /> Buat tugas
          </button>
          <button
            type="button"
            onClick={() => onRun(scope)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary/15 px-3 py-2 text-sm text-primary transition hover:bg-primary/25"
          >
            <Sparkles className="h-4 w-4" /> Jalankan batch
          </button>
          <button
            type="button"
            onClick={() => onRetry(scope)}
            className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm transition hover:border-primary/50"
          >
            <RefreshCcw className="h-4 w-4" /> Ulangi yang gagal
          </button>
        </div>
      </GlassCard>

      {data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile label="Tugas antre" value={data.tasks.queued} />
          <MetricTile label="Tugas selesai" value={data.tasks.completed} />
          <MetricTile label="Tugas gagal" value={data.tasks.failed} tone="hot" />
          <MetricTile label="Kandidat" value={data.candidates} />
          <MetricTile label="Hot lead" value={data.hotLeads} tone="primary" />
          <MetricTile label="Antre QC" value={data.qcPending} />
          <MetricTile
            label="Permintaan provider hari ini"
            value={data.usageToday.reduce((sum, row) => sum + row.requests, 0)}
          />
          <MetricTile
            label="Hasil provider hari ini"
            value={data.usageToday.reduce((sum, row) => sum + row.results, 0)}
          />
        </div>
      ) : null}

      <SectionCard title="Progres kampanye" description="Target kandidat vs yang sudah tersimpan.">
        {overview.isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat data discovery...</p>
        ) : !data || data.campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada kampanye dengan tugas discovery. Pilih kampanye lalu klik "Buat tugas".
          </p>
        ) : (
          <div className="space-y-3">
            {data.campaigns.map((row) => (
              <div key={row.id} className="rounded-2xl border border-border/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{row.name}</p>
                  <span className="rounded-full border border-border/50 px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                    {row.provider}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.saved} / {row.target} kandidat - {row.completed}/{row.tasks} tugas selesai
                  {row.failed ? ` - ${row.failed} gagal` : ""}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/40">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${Math.min(100, row.progress)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Tugas terbaru" description="Riwayat eksekusi termasuk catatan galat.">
        {!data || data.recentTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada tugas discovery.</p>
        ) : (
          <div className="space-y-2">
            {data.recentTasks.slice(0, 25).map((task) => (
              <div
                key={task.id}
                className="rounded-xl border border-border/40 px-3 py-2 text-xs text-muted-foreground"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">
                    {task.keyword} - {task.area}
                  </span>
                  <span className="rounded-full border border-border/50 px-2 py-0.5 text-[0.65rem]">
                    {DISCOVERY_TASK_STATUS_LABELS[task.status] ?? task.status}
                  </span>
                  <span>
                    {task.saved_count} tersimpan - {task.duplicate_count} kembar -{" "}
                    {task.rejected_count} ditolak
                  </span>
                  <span>
                    Percobaan {task.attempt}/{task.max_attempts}
                  </span>
                </div>
                {task.last_error ? (
                  <p className="mt-1 text-destructive">{task.last_error}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

type DiscoveryOverviewData = {
  tasks: { queued: number; running: number; completed: number; failed: number; total: number };
  candidates: number;
  hotLeads: number;
  qcPending: number;
  usageToday: { provider: string; requests: number; results: number; errors: number }[];
  campaigns: {
    id: string;
    name: string;
    provider: string;
    target: number;
    tasks: number;
    completed: number;
    failed: number;
    found: number;
    saved: number;
    progress: number;
  }[];
  recentTasks: DiscoveryTaskRow[];
};
