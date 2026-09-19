import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, RefreshCcw, Sparkles } from "lucide-react";
import { useState } from "react";

import { GlassCard, MetricTile, SectionCard } from "@/components/admin/ui";
import { leadTemperatureClass, type LeadTemperature } from "@/lib/admin/discovery";
import {
  APPROACH_LABELS,
  SALES_STAGE_LABELS,
  type ApproachCategory,
  type SalesStage,
} from "@/lib/admin/sales-prep";
import type { SalesPrepBoard } from "@/lib/prospecting-salesprep.server";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm outline-none transition focus:border-primary/50";

type CampaignOption = { id: string; name: string };

type Props = {
  campaigns: CampaignOption[];
  load: (input: { campaignId?: string; stage?: string }) => Promise<SalesPrepBoard>;
  onPrepare: (campaignId?: string) => Promise<unknown>;
  onStage: (id: string, stage: SalesStage) => Promise<unknown>;
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

export function SalesPrepPanel({ campaigns, load, onPrepare, onStage }: Props) {
  const [campaignId, setCampaignId] = useState("all");
  const [stage, setStage] = useState("all");
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="space-y-4">
      {counts ? (
        <div className="grid grid-cols-3 gap-3">
          <MetricTile label="Qualified" value={counts.qualified} />
          <MetricTile label="Sales prepared" value={counts.prepared} tone="primary" />
          <MetricTile label="Ready outreach" value={counts.ready} tone="hot" />
        </div>
      ) : null}

      <SectionCard
        title="Sales preparation"
        description="Brief bisnis, rekomendasi pendekatan, draf pesan, dan aset pendukung. Tidak ada pesan yang terkirim otomatis."
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
            disabled={busy}
            onClick={() => void act(() => onPrepare(campaignId === "all" ? undefined : campaignId))}
            className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm transition hover:border-primary/50 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" /> Siapkan penjualan
          </button>
          <button
            type="button"
            onClick={() => void board.refetch()}
            className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm transition hover:border-primary/50"
          >
            <RefreshCcw className="h-4 w-4" /> Muat ulang
          </button>
        </div>
      </SectionCard>

      <div className="space-y-2">
        {board.isLoading ? (
          <GlassCard className="p-4 text-sm text-muted-foreground">Memuat persiapan…</GlassCard>
        ) : (board.data?.rows.length ?? 0) === 0 ? (
          <GlassCard className="p-4 text-sm text-muted-foreground">
            Belum ada materi persiapan. Klik “Siapkan penjualan” untuk kandidat yang sudah
            tervalidasi.
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
                      {APPROACH_LABELS[(row.approach_category as ApproachCategory) ?? "website_opportunity"] ??
                        row.approach_category}
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
