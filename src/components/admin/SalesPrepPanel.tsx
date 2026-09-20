import { useQuery } from "@tanstack/react-query";
import {
  ClipboardCheck,
  Copy,
  Layers,
  MessageCircle,
  RefreshCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { GlassCard, MetricTile, SectionCard } from "@/components/admin/ui";
import { leadTemperatureClass, type LeadTemperature } from "@/lib/admin/discovery";
import {
  APPROACH_LABELS,
  SALES_STAGE_LABELS,
  type ApproachCategory,
  type SalesStage,
} from "@/lib/admin/sales-prep";
import {
  CONTACT_STAGE_LABELS,
  CONTACT_STAGES,
  VERIFICATION_ITEM_LABELS,
  VERIFICATION_ITEMS,
  composeOutreachMessage,
  contactStageClass,
  whatsappLink,
  type ContactStage,
  type VerificationItem,
} from "@/lib/admin/verification";
import type { SalesPrepBoard, SalesPrepRunResult } from "@/lib/prospecting-salesprep.server";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm outline-none transition focus:border-primary/50";

const BATCH_SIZE = 25;
const MAX_CHUNKS = 200;

type CampaignOption = { id: string; name: string };

type Progress = {
  total: number | null;
  scanned: number;
  prepared: number;
  skipped: number;
  failed: number;
  running: boolean;
};

type Props = {
  campaigns: CampaignOption[];
  load: (input: { campaignId?: string; stage?: string }) => Promise<SalesPrepBoard>;
  onPrepareOne: (candidateId: string) => Promise<SalesPrepRunResult>;
  onPrepareBatch: (input: {
    campaignId?: string;
    limit: number;
    offset: number;
  }) => Promise<SalesPrepRunResult>;
  onStage: (id: string, stage: SalesStage) => Promise<unknown>;
  onVerify: (id: string, item: VerificationItem, value: boolean) => Promise<unknown>;
  onContactStage: (id: string, stage: ContactStage) => Promise<unknown>;
};

const briefFields: Array<[string, string]> = [
  ["business_summary", "Ringkasan bisnis"],
  ["current_digital_condition", "Kondisi digital saat ini"],
  ["potential_problem", "Potensi masalah"],
  ["opportunity", "Peluang"],
];

const outreachFields: Array<[string, string]> = [
  ["opening_message", "Pembuka"],
  ["reason_contacting", "Alasan menghubungi"],
  ["value_proposition", "Nilai yang ditawarkan"],
  ["call_to_action", "Ajakan"],
];

function reasonSummary(reasons: Record<string, number>): string {
  return Object.entries(reasons)
    .map(([label, count]) => `${label} (${count})`)
    .join(", ");
}

export function SalesPrepPanel({
  campaigns,
  load,
  onPrepareOne,
  onPrepareBatch,
  onStage,
  onVerify,
  onContactStage,
}: Props) {
  const [campaignId, setCampaignId] = useState("all");
  const [stage, setStage] = useState("all");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);

  const board = useQuery({
    queryKey: ["admin", "sales-prep-board", campaignId, stage],
    queryFn: () =>
      load({
        ...(campaignId !== "all" ? { campaignId } : {}),
        ...(stage !== "all" ? { stage } : {}),
      }),
  });

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await board.refetch();
    } finally {
      setBusy(false);
    }
  };

  const counts = board.data?.counts;
  const pending = board.data?.pending ?? [];
  const eligibleCount = counts?.eligible ?? 0;

  /** Manual mode: never show success when nothing was written. */
  const prepareOne = async (candidateId: string, name: string) => {
    setBusy(true);
    try {
      const result = await onPrepareOne(candidateId);
      if (result.prepared > 0) {
        toast.success(`Materi persiapan untuk ${name} berhasil dibuat.`);
      } else if (result.failed > 0) {
        toast.error(result.errors[0] ?? "Gagal menyimpan materi persiapan.");
      } else {
        toast.error(
          `Kandidat belum memenuhi syarat: ${reasonSummary(result.skippedReasons) || "menunggu QC approval"}.`,
        );
      }
      await board.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memproses aksi.");
    } finally {
      setBusy(false);
    }
  };

  /** Batch mode: bounded chunks so thousands of candidates stay safe. */
  const prepareBatch = async () => {
    setBusy(true);
    const totals: Progress = {
      total: null,
      scanned: 0,
      prepared: 0,
      skipped: 0,
      failed: 0,
      running: true,
    };
    const reasons: Record<string, number> = {};
    const errors: string[] = [];
    setProgress({ ...totals });

    try {
      let offset = 0;
      for (let chunk = 0; chunk < MAX_CHUNKS; chunk += 1) {
        const result = await onPrepareBatch({
          ...(campaignId !== "all" ? { campaignId } : {}),
          limit: BATCH_SIZE,
          offset,
        });
        totals.total = result.total ?? totals.total;
        totals.scanned += result.scanned;
        totals.prepared += result.prepared;
        totals.skipped += result.skipped;
        totals.failed += result.failed;
        for (const [label, count] of Object.entries(result.skippedReasons)) {
          reasons[label] = (reasons[label] ?? 0) + count;
        }
        for (const message of result.errors) {
          if (errors.length < 5) errors.push(message);
        }
        setProgress({ ...totals });
        if (result.nextOffset == null) break;
        offset = result.nextOffset;
      }

      if (totals.prepared > 0) {
        toast.success(`${totals.prepared} materi persiapan berhasil dibuat.`);
        if (totals.failed > 0) toast.warning(`${totals.failed} kandidat gagal diproses.`);
      } else if (totals.failed > 0) {
        toast.error(errors[0] ?? "Semua pembuatan materi gagal.");
      } else {
        toast.error(
          "Tidak ada kandidat yang memenuhi syarat. Kandidat masih menunggu QC approval.",
        );
      }
      setProgress({ ...totals, running: false });
      await board.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memproses aksi.");
      setProgress({ ...totals, running: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {counts ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricTile label="Menunggu QC review" value={counts.awaitingQc} />
          <MetricTile label="Qualified" value={counts.qualified} />
          <MetricTile label="Sales prepared" value={counts.prepared} tone="primary" />
          <MetricTile label="Ready outreach" value={counts.ready} tone="hot" />
        </div>
      ) : null}

      <SectionCard
        title="Sales preparation"
        description="Hanya kandidat QC approved yang bisa disiapkan. Brief bisnis, rekomendasi pendekatan, draf pesan, dan aset pendukung — tidak ada pesan yang terkirim otomatis."
      >
        <div className="flex flex-wrap gap-2">
          <select
            className={cn(inputClass, "w-auto")}
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
          >
            <option value="all">Semua kampanye</option>
            {campaigns.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            className={cn(inputClass, "w-auto")}
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="all">Semua tahap</option>
            {(Object.keys(SALES_STAGE_LABELS) as SalesStage[]).map((item) => (
              <option key={item} value={item}>
                {SALES_STAGE_LABELS[item]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || eligibleCount === 0}
            onClick={() => void prepareBatch()}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary transition disabled:opacity-40"
          >
            <Layers className="h-4 w-4" /> Siapkan penjualan massal
          </button>
          <button
            type="button"
            onClick={() => void board.refetch()}
            className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm transition hover:border-primary/50"
          >
            <RefreshCcw className="h-4 w-4" /> Muat ulang
          </button>
        </div>

        {counts && counts.ineligible > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {counts.ineligible} kandidat QC approved belum memenuhi syarat (duplikat, sudah di CRM,
            atau kontak belum bersumber).
          </p>
        ) : null}

        {progress ? (
          <div className="mt-3 rounded-xl border border-border/40 bg-background/30 p-3 text-xs">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {progress.running ? "Sedang memproses…" : "Laporan batch"}
            </p>
            <p>
              Total kandidat: {progress.total ?? "—"} • Diproses: {progress.scanned} • Berhasil:{" "}
              {progress.prepared} • Gagal: {progress.failed} • Dilewati: {progress.skipped}
            </p>
          </div>
        ) : null}
      </SectionCard>

      {pending.length > 0 ? (
        <SectionCard
          title="Kandidat QC approved menunggu materi"
          description="Mode manual untuk review dan pengujian satu per satu."
        >
          <div className="space-y-2">
            {pending.map((row) => (
              <div
                key={row.candidate_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 bg-background/30 p-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{row.business_name}</span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px]",
                        leadTemperatureClass((row.lead_temperature as LeadTemperature) ?? "cold"),
                      )}
                    >
                      {row.lead_score}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[row.category, row.city].filter(Boolean).join(" • ") || "—"}
                    {row.blockers.length > 0 ? ` • ${row.blockers.join(", ")}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || !row.eligible}
                  onClick={() => void prepareOne(row.candidate_id, row.business_name)}
                  className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-1.5 text-xs transition hover:border-primary/50 disabled:opacity-40"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Siapkan penjualan
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <div className="space-y-2">
        {board.isLoading ? (
          <GlassCard className="p-4 text-sm text-muted-foreground">Memuat persiapan…</GlassCard>
        ) : (board.data?.rows.length ?? 0) === 0 ? (
          <GlassCard className="p-4 text-sm text-muted-foreground">
            Belum ada materi persiapan. Approve kandidat di tab QC review, lalu klik “Siapkan
            penjualan”.
          </GlassCard>
        ) : (
          board.data?.rows.map((row) => (
            <GlassCard key={row.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{row.business_name}</h3>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px]",
                        leadTemperatureClass((row.lead_temperature as LeadTemperature) ?? "cold"),
                      )}
                    >
                      {row.lead_score}
                    </span>
                    <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                      {SALES_STAGE_LABELS[(row.sales_stage as SalesStage) ?? "qualified"] ??
                        row.sales_stage}
                    </span>
                    <span className="rounded-full border border-border/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                      {APPROACH_LABELS[
                        (row.approach_category as ApproachCategory) ?? "website_opportunity"
                      ] ?? row.approach_category}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[row.category, row.city].filter(Boolean).join(" • ") || "—"}
                  </p>
                </div>
                {row.selected_asset?.url ? (
                  <a
                    href={row.selected_asset.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-border/50 px-3 py-1.5 text-xs text-muted-foreground"
                  >
                    {row.selected_asset.label ?? "Aset"}
                  </a>
                ) : null}
              </div>

              <div className="grid gap-2 text-xs md:grid-cols-2">
                {briefFields.map(([key, label]) =>
                  row.business_brief?.[key] ? (
                    <p key={key}>
                      <span className="text-muted-foreground">{label}: </span>
                      {row.business_brief[key]}
                    </p>
                  ) : null,
                )}
                {row.recommended_solution ? (
                  <p className="md:col-span-2">
                    <span className="text-muted-foreground">Rekomendasi solusi: </span>
                    {row.recommended_solution}
                    {row.approach_reason ? ` — ${row.approach_reason}` : ""}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1 rounded-xl border border-border/40 bg-background/30 p-3 text-xs">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Draf outreach (butuh persetujuan manusia)
                </p>
                {outreachFields.map(([key, label]) =>
                  row.outreach_message?.[key] ? (
                    <p key={key}>
                      <span className="text-muted-foreground">{label}: </span>
                      {row.outreach_message[key]}
                    </p>
                  ) : null,
                )}
              </div>

              {row.evidence.length > 0 ? (
                <div className="rounded-xl border border-border/40 bg-background/30 p-3 text-xs">
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    Bukti data (data → sumber → keyakinan)
                  </p>
                  <div className="space-y-1">
                    {row.evidence.map((item, index) => (
                      <div
                        key={`${item.field}-${index}`}
                        className="flex flex-wrap items-center gap-x-2"
                      >
                        <span className="text-muted-foreground">{item.field}:</span>
                        <span>{item.data}</span>
                        <span className="text-muted-foreground">
                          •{" "}
                          {item.source_url ? (
                            <a
                              href={item.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              {item.source}
                            </a>
                          ) : (
                            item.source
                          )}{" "}
                          • {item.confidence}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {row.sales_stage === "ready_outreach" ? (
                <div className="rounded-xl border border-border/40 bg-background/30 p-3 text-xs">
                  <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                    Ceklis verifikasi manusia —{" "}
                    {row.verified ? "Verified Ready Outreach" : "Pending Verification"}
                  </p>
                  <div className="grid gap-1 md:grid-cols-2">
                    {VERIFICATION_ITEMS.map((item) => (
                      <label key={item} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          disabled={busy}
                          checked={row.verification_checklist[item] === true}
                          onChange={(e) =>
                            void act(() => onVerify(row.candidate_id, item, e.target.checked))
                          }
                        />
                        <span>{VERIFICATION_ITEM_LABELS[item]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {row.verified ? (
                <div className="flex flex-wrap items-center gap-2">
                  {whatsappLink(row.phone, composeOutreachMessage(row.outreach_message)) ? (
                    <a
                      href={
                        whatsappLink(row.phone, composeOutreachMessage(row.outreach_message)) ?? "#"
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-200"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Hubungi WhatsApp
                    </a>
                  ) : (
                    <span className="text-xs text-amber-200">
                      Nomor WhatsApp Indonesia tidak valid.
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void act(() =>
                        navigator.clipboard.writeText(
                          composeOutreachMessage(row.outreach_message),
                        ),
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border/50 px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy message
                  </button>
                  {row.google_maps_url ? (
                    <a
                      href={row.google_maps_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border/50 px-3 py-1.5 text-xs"
                    >
                      <Search className="h-3.5 w-3.5" /> Lihat sumber
                    </a>
                  ) : null}
                  <select
                    className={cn(inputClass, "w-auto text-xs")}
                    value={row.contact_stage ?? ""}
                    disabled={busy}
                    onChange={(e) => {
                      const value = e.target.value as ContactStage;
                      if (!value) return;
                      void act(() => onContactStage(row.candidate_id, value));
                    }}
                  >
                    <option value="">Tahap CRM…</option>
                    {CONTACT_STAGES.map((item) => (
                      <option key={item} value={item}>
                        {CONTACT_STAGE_LABELS[item]}
                      </option>
                    ))}
                  </select>
                  {row.contact_stage ? (
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px]",
                        contactStageClass(row.contact_stage as ContactStage),
                      )}
                    >
                      {CONTACT_STAGE_LABELS[row.contact_stage as ContactStage] ?? row.contact_stage}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {row.ready_blockers.length > 0 ? (
                <p className="text-xs text-amber-200">
                  Belum bisa Ready Outreach: {row.ready_blockers.join(" ")}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || row.ready_blockers.length > 0}
                  onClick={() => void act(() => onStage(row.candidate_id, "ready_outreach"))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-200 disabled:opacity-40"
                >
                  <ClipboardCheck className="h-3.5 w-3.5" /> Tandai Ready Outreach
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(() => onStage(row.candidate_id, "sales_prepared"))}
                  className="rounded-xl border border-border/50 px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Kembalikan ke Sales Prepared
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void prepareOne(row.candidate_id, row.business_name)}
                  className="rounded-xl border border-border/50 px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Buat ulang materi
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void act(() =>
                      navigator.clipboard.writeText(
                        outreachFields
                          .map(([key]) => row.outreach_message?.[key])
                          .filter(Boolean)
                          .join("\n\n"),
                      ),
                    )
                  }
                  className="rounded-xl border border-border/50 px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Salin draf
                </button>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}
