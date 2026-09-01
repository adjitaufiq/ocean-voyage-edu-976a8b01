import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Ban, Plus, RefreshCcw, Search, Send, Target, UserPlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { GlassCard, MetricTile, SectionCard } from "@/components/admin/ui";
import {
  FIT_TIER_LABELS,
  OUTREACH_CHANNELS,
  PROSPECT_STATUSES,
  PROSPECT_STATUS_LABELS,
  type FitTier,
  type OutreachChannel,
  type ProspectStatus,
} from "@/lib/admin/prospecting";
import {
  convertProspectFn,
  createProspectFn,
  getProspectDetail,
  getProspects,
  recordOutreachFn,
  rescoreProspectFn,
  saveOutreachDraftFn,
  setDoNotContactFn,
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
  contact_email: string | null;
  contact_whatsapp: string | null;
  status: string;
  fit_score: number;
  fit_tier: string;
  do_not_contact: boolean;
  next_follow_up_at: string | null;
  lead_id: string | null;
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

const emptyDraft = {
  businessName: "",
  industry: "",
  city: "",
  website: "",
  contactName: "",
  contactEmail: "",
  contactWhatsapp: "",
  source: "manual",
  researchSummary: "",
  painSignals: "",
  evidence: "",
};

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

  const [status, setStatus] = useState<string>("all");
  const [tier, setTier] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [channel, setChannel] = useState<OutreachChannel>("whatsapp");
  const [message, setMessage] = useState("");

  const list = useQuery({
    queryKey: ["admin", "prospects", status, tier, search],
    queryFn: () => listFn({ data: { status, tier, search } }),
  });

  const detail = useQuery({
    queryKey: ["admin", "prospect", openId],
    queryFn: () => detailFn({ data: { id: openId as string } }),
    enabled: Boolean(openId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "prospects"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "prospect"] });
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
          source: draft.source.trim() || "manual",
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
  const selected = detail.data?.prospect as (ListRow & Record<string, unknown>) | undefined;

  const breakdown = useMemo(() => {
    const raw = selected?.fit_breakdown;
    return Array.isArray(raw)
      ? (raw as { label: string; score: number; max: number; detail: string }[])
      : [];
  }, [selected]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Outbound Prospects</h1>
          <p className="text-sm text-muted-foreground">
            Riset, skor ICP, dan siapkan outreach. Tidak ada pesan yang terkirim otomatis.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="inline-flex items-center gap-2 rounded-xl border border-border/50 bg-primary/15 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/25"
        >
          <Plus className="h-4 w-4" /> Prospek baru
        </button>
      </header>

      {summary ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricTile label="Prospek 30 hari" value={String(summary.total)} />
          <MetricTile label="Siap disetujui" value={String(summary.readyForApproval)} />
          <MetricTile label="Dihubungi" value={String(summary.contacted)} />
          <MetricTile label="Reply rate" value={`${summary.replyRate}%`} />
          <MetricTile label="Follow-up jatuh tempo" value={String(summary.dueFollowUps)} />
        </div>
      ) : null}

      {showForm ? (
        <SectionCard title="Prospek baru" description="Isi hasil riset manual; skor ICP dihitung otomatis.">
          <div className="grid gap-3 md:grid-cols-2">
            {(
              [
                ["businessName", "Nama bisnis*"],
                ["industry", "Industri"],
                ["city", "Kota"],
                ["website", "Website"],
                ["contactName", "Nama PIC"],
                ["contactEmail", "Email"],
                ["contactWhatsapp", "WhatsApp"],
                ["source", "Sumber"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="space-y-1 text-sm">
                <span className="text-xs text-muted-foreground">{label}</span>
                <input
                  className={inputClass}
                  value={draft[key]}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                />
              </label>
            ))}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm md:col-span-1">
              <span className="text-xs text-muted-foreground">Ringkasan riset</span>
              <textarea
                rows={4}
                className={inputClass}
                value={draft.researchSummary}
                onChange={(event) => setDraft({ ...draft, researchSummary: event.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Sinyal masalah (1 per baris)</span>
              <textarea
                rows={4}
                className={inputClass}
                value={draft.painSignals}
                onChange={(event) => setDraft({ ...draft, painSignals: event.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Bukti / sumber (1 per baris)</span>
              <textarea
                rows={4}
                className={inputClass}
                value={draft.evidence}
                onChange={(event) => setDraft({ ...draft, evidence: event.target.value })}
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

      <GlassCard className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Cari bisnis, industri, kota, PIC…"
              className={cn(inputClass, "pl-9")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className={cn(inputClass, "w-auto")}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
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
            onChange={(event) => setTier(event.target.value)}
          >
            <option value="all">Semua tier</option>
            {(["high", "medium", "low"] as FitTier[]).map((item) => (
              <option key={item} value={item}>
                {FIT_TIER_LABELS[item]}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 space-y-2">
          {list.isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat prospek…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada prospek. Tambahkan hasil riset pertama lewat tombol “Prospek baru”.
            </p>
          ) : (
            rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setOpenId(row.id)}
                className="flex w-full flex-wrap items-center gap-3 rounded-2xl border border-border/40 bg-card/30 px-4 py-3 text-left transition hover:border-primary/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{row.business_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[row.industry, row.city, row.contact_name].filter(Boolean).join(" • ") ||
                      "Belum ada detail"}
                  </span>
                </span>
                {row.do_not_contact ? (
                  <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-destructive">
                    DNC
                  </span>
                ) : null}
                <span className="rounded-full border border-border/50 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  {PROSPECT_STATUS_LABELS[row.status as ProspectStatus] ?? row.status}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide",
                    tierClass(row.fit_tier),
                  )}
                >
                  {row.fit_score} · {FIT_TIER_LABELS[row.fit_tier as FitTier] ?? row.fit_tier}
                </span>
              </button>
            ))
          )}
        </div>
      </GlassCard>

      {openId ? (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button
            type="button"
            aria-label="Tutup detail"
            onClick={() => setOpenId(null)}
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
                onClick={() => setOpenId(null)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border/50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selected ? (
              <>
                <SectionCard title="Skor ICP" description={`${selected.fit_score} poin`}>
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
                    onClick={() => void run(rescoreFn({ data: { id: selected.id } }), "Skor diperbarui.")}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-1.5 text-xs"
                  >
                    <RefreshCcw className="h-3.5 w-3.5" /> Hitung ulang skor
                  </button>
                </SectionCard>

                <SectionCard
                  title="Draft outreach"
                  description="Draft disiapkan manusia; pengiriman tetap manual."
                >
                  <div className="flex flex-wrap gap-2">
                    {OUTREACH_CHANNELS.map((item) => (
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
                    rows={6}
                    className={cn(inputClass, "mt-3")}
                    placeholder="Tulis draft pesan pembuka berbasis bukti riset…"
                    value={message || (selected.outreach_draft as string) || ""}
                    onChange={(event) => setMessage(event.target.value)}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={(message || (selected.outreach_draft as string) || "").length < 10}
                      onClick={() =>
                        void run(
                          draftFn({
                            data: {
                              id: selected.id,
                              channel,
                              draft: message || ((selected.outreach_draft as string) ?? ""),
                              approve: false,
                            },
                          }),
                          "Draft tersimpan.",
                        )
                      }
                      className="rounded-xl border border-border/50 px-3 py-1.5 text-xs disabled:opacity-50"
                    >
                      Simpan draft
                    </button>
                    <button
                      type="button"
                      disabled={(message || (selected.outreach_draft as string) || "").length < 10}
                      onClick={() =>
                        void run(
                          draftFn({
                            data: {
                              id: selected.id,
                              channel,
                              draft: message || ((selected.outreach_draft as string) ?? ""),
                              approve: true,
                            },
                          }),
                          "Draft disetujui.",
                        )
                      }
                      className="rounded-xl bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary disabled:opacity-50"
                    >
                      Setujui outreach
                    </button>
                  </div>
                </SectionCard>

                <SectionCard title="Catat aktivitas" description="Rekam apa yang benar-benar dilakukan.">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void run(
                          outreachFn({
                            data: { id: selected.id, event: "sent", followUpInDays: 3 },
                          }),
                          "Outreach tercatat, follow-up 3 hari.",
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-1.5 text-xs"
                    >
                      <Send className="h-3.5 w-3.5" /> Sudah dikirim
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void run(
                          outreachFn({ data: { id: selected.id, event: "reply" } }),
                          "Balasan tercatat.",
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-1.5 text-xs"
                    >
                      <Target className="h-3.5 w-3.5" /> Membalas
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void run(
                          dncFn({
                            data: {
                              id: selected.id,
                              enabled: !selected.do_not_contact,
                              reason: "Permintaan / keputusan manual",
                            },
                          }),
                          selected.do_not_contact ? "DNC dicabut." : "Ditandai DO_NOT_CONTACT.",
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-xl border border-destructive/40 px-3 py-1.5 text-xs text-destructive"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      {selected.do_not_contact ? "Cabut DNC" : "DO_NOT_CONTACT"}
                    </button>
                  </div>
                </SectionCard>

                <SectionCard title="Handoff ke CRM" description="Hanya setelah ada sinyal nyata.">
                  {selected.lead_id ? (
                    <Link
                      to="/admin/leads/$id"
                      params={{ id: selected.lead_id }}
                      className="inline-flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
                    >
                      Buka lead di CRM
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        void run(handoffFn({ data: { id: selected.id } }), "Prospek jadi lead CRM.")
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Jadikan lead
                    </button>
                  )}
                </SectionCard>

                <SectionCard title="Riwayat" description="Semua aksi tercatat.">
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    {(detail.data?.activities ?? []).map((item) => (
                      <li key={item.id} className="rounded-xl border border-border/40 px-3 py-2">
                        <span className="text-foreground">{item.label ?? item.action}</span>
                        <span className="block">
                          {new Date(item.created_at).toLocaleString("id-ID")}
                          {item.created_by_email ? ` • ${item.created_by_email}` : ""}
                        </span>
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
      ) : null}
    </div>
  );
}
