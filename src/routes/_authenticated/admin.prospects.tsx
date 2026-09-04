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
  Sparkles,
  Target,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
} from "@/lib/prospecting.functions";
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

  const [tab, setTab] = useState<"queue" | "campaigns" | "prospects">("queue");
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

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "prospects"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "prospect"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "prospect-campaigns"] });
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

      {summary ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <MetricTile label="Ditemukan" value={summary.total} />
          <MetricTile label="Sales ready" value={salesReady} tone="primary" />
          <MetricTile label="Perlu verifikasi" value={needVerification} />
          <MetricTile label="Follow-up hari ini" value={todayFollowUps} tone="hot" />
          <MetricTile label="Dihubungi" value={summary.contacted} />
          <MetricTile label="Reply rate" value={`${summary.replyRate}%`} />
          <MetricTile label="Meeting" value={summary.meetings} />
          <MetricTile label="Deal" value={summary.deals} tone="primary" />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-border/40 pb-3">
        {(["queue", "campaigns", "prospects"] as const).map((item) => (
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
              : item === "campaigns"
                ? "Campaigns"
                : "All prospects"}
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
                max="50"
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

      {tab === "campaigns" ? (
        <CampaignList
          campaigns={campaignRows}
          onDiscover={(id) =>
            void run(discover({ data: { campaignId: id } }), "Discovery AI selesai.")
          }
          onDelete={(id) => void run(deleteCampaign({ data: { id } }), "Kampanye dihapus.")}
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
                <Sparkles className="h-3.5 w-3.5" /> Generate prospek AI
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
      {quality.socialOnly ? (
        <p className="mt-2 text-xs text-secondary-foreground">
          Social media menjadi satu-satunya kanal; verifikasi kontak diperlukan sebelum outreach.
        </p>
      ) : null}
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
  onSaveDraft,
  onOutreach,
  onDnc,
  onStage,
  onFollowUp,
  onNote,
  onHandoff,
}: {
  selected?: ListRow & Record<string, unknown>;
  detail?: {
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
  onSaveDraft: (approve: boolean) => void;
  onOutreach: (event: "sent" | "reply") => void;
  onDnc: () => void;
  onStage: (stage: ProspectStatus) => void;
  onFollowUp: () => void;
  onNote: () => void;
  onHandoff: () => void;
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
