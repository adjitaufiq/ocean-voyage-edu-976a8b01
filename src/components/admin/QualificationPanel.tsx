import { useQuery } from "@tanstack/react-query";
import { Check, RefreshCcw, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { GlassCard, MetricTile, SectionCard } from "@/components/admin/ui";
import {
  LEAD_TEMPERATURES,
  LEAD_TEMPERATURE_LABELS,
  leadTemperatureClass,
  QC_STATUSES,
  QC_STATUS_LABELS,
  qcStatusClass,
  type LeadTemperature,
  type QcStatus,
} from "@/lib/admin/discovery";
import {
  VALIDATION_STATUS_LABELS,
  validationStatusClass,
  type ValidationStatus,
} from "@/lib/admin/qualification";
import type { BoardFilter, QualificationBoard } from "@/lib/prospecting-qualification.server";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm outline-none transition focus:border-primary/50";

type CampaignOption = { id: string; name: string };

type Props = {
  campaigns: CampaignOption[];
  load: (input: BoardFilter) => Promise<QualificationBoard>;
  onQualify: (campaignId?: string) => Promise<unknown>;
  onQc: (id: string, status: QcStatus, reason?: string) => Promise<unknown>;
};

export function QualificationPanel({ campaigns, load, onQualify, onQc }: Props) {
  const [campaignId, setCampaignId] = useState("all");
  const [category, setCategory] = useState("all");
  const [city, setCity] = useState("all");
  const [temperature, setTemperature] = useState("all");
  const [qcStatus, setQcStatus] = useState("all");
  const [solution, setSolution] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [busy, setBusy] = useState(false);

  const filter: BoardFilter = {
    ...(campaignId !== "all" ? { campaignId } : {}),
    ...(category !== "all" ? { category } : {}),
    ...(city !== "all" ? { city } : {}),
    ...(temperature !== "all" ? { temperature } : {}),
    ...(qcStatus !== "all" ? { qcStatus } : {}),
    ...(solution !== "all" ? { solution } : {}),
    ...(minScore > 0 ? { minScore } : {}),
  };

  const board = useQuery({
    queryKey: [
      "admin",
      "qualification-board",
      campaignId,
      category,
      city,
      temperature,
      qcStatus,
      solution,
      minScore,
    ],
    queryFn: () => load(filter),
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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <MetricTile label="Ditemukan" value={counts.found} />
          <MetricTile label="Tervalidasi" value={counts.validated} tone="primary" />
          <MetricTile label="Ditolak" value={counts.rejected} />
          <MetricTile label="Terkualifikasi" value={counts.qualified} />
          <MetricTile label="Hot lead" value={counts.hot} tone="hot" />
          <MetricTile label="Warm lead" value={counts.warm} />
          <MetricTile label="Antre QC" value={counts.qcNew} />
          <MetricTile label="Disetujui" value={counts.approved} tone="primary" />
        </div>
      ) : null}

      <SectionCard
        title="QC review & hot lead"
        description="Saring kandidat hasil discovery, lalu setujui atau tolak dengan alasan tercatat."
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
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">Semua kategori</option>
            {(board.data?.categories ?? []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            className={cn(inputClass, "w-auto")}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            <option value="all">Semua kota</option>
            {(board.data?.cities ?? []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            className={cn(inputClass, "w-auto")}
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
          >
            <option value="all">Semua suhu lead</option>
            {LEAD_TEMPERATURES.map((item) => (
              <option key={item} value={item}>
                {LEAD_TEMPERATURE_LABELS[item]}
              </option>
            ))}
          </select>
          <select
            className={cn(inputClass, "w-auto")}
            value={qcStatus}
            onChange={(e) => setQcStatus(e.target.value)}
          >
            <option value="all">Semua status QC</option>
            {QC_STATUSES.map((item) => (
              <option key={item} value={item}>
                {QC_STATUS_LABELS[item]}
              </option>
            ))}
          </select>
          <select
            className={cn(inputClass, "w-auto")}
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
          >
            <option value="all">Semua solusi</option>
            {(board.data?.solutions ?? []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            max="100"
            className={cn(inputClass, "w-28")}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value) || 0)}
            placeholder="Skor min"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void act(() => onQualify(campaignId === "all" ? undefined : campaignId))
            }
            className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm transition hover:border-primary/50 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" /> Kualifikasi ulang
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
          <GlassCard className="p-4 text-sm text-muted-foreground">Memuat kandidat…</GlassCard>
        ) : (board.data?.rows.length ?? 0) === 0 ? (
          <GlassCard className="p-4 text-sm text-muted-foreground">
            Belum ada kandidat yang cocok dengan filter ini.
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
                      {LEAD_TEMPERATURE_LABELS[
                        (row.lead_temperature as LeadTemperature) ?? "cold"
                      ] ?? row.lead_temperature}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px]",
                        validationStatusClass(
                          (row.validation_status as ValidationStatus) ?? "pending",
                        ),
                      )}
                    >
                      {VALIDATION_STATUS_LABELS[
                        (row.validation_status as ValidationStatus) ?? "pending"
                      ] ?? row.validation_status}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px]",
                        qcStatusClass((row.qc_status as QcStatus) ?? "new"),
                      )}
                    >
                      {QC_STATUS_LABELS[(row.qc_status as QcStatus) ?? "new"] ?? row.qc_status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[row.category, row.city, row.province].filter(Boolean).join(" • ") || "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold text-primary">{row.lead_score}</p>
                  <p className="text-[11px] text-muted-foreground">skor lead</p>
                </div>
              </div>

              <div className="grid gap-2 text-xs md:grid-cols-2">
                {row.lead_reason ? (
                  <p>
                    <span className="text-muted-foreground">Alasan lead: </span>
                    {row.lead_reason}
                  </p>
                ) : null}
                {row.pain_signal ? (
                  <p>
                    <span className="text-muted-foreground">Sinyal masalah: </span>
                    {row.pain_signal}
                  </p>
                ) : null}
                {row.digital_gap ? (
                  <p>
                    <span className="text-muted-foreground">Celah digital: </span>
                    {row.digital_gap}
                  </p>
                ) : null}
                {row.recommended_solution ? (
                  <p>
                    <span className="text-muted-foreground">Solusi: </span>
                    {row.recommended_solution}
                  </p>
                ) : null}
                {row.validation_reason ? (
                  <p className="md:col-span-2">
                    <span className="text-muted-foreground">Catatan validasi: </span>
                    {row.validation_reason}
                  </p>
                ) : null}
                {row.qc_reviewed_by_email ? (
                  <p className="md:col-span-2 text-muted-foreground">
                    Ditinjau {row.qc_reviewed_by_email}
                    {row.qc_reviewed_at
                      ? ` • ${new Date(row.qc_reviewed_at).toLocaleString("id-ID")}`
                      : ""}
                    {row.qc_reason ? ` • ${row.qc_reason}` : ""}
                  </p>
                ) : null}
              </div>

              {row.validation_checks.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {row.validation_checks.map((check) => (
                    <span
                      key={check.key}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px]",
                        check.passed
                          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                          : "border-rose-400/40 bg-rose-400/10 text-rose-200",
                      )}
                      title={check.detail ?? undefined}
                    >
                      {check.label}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(() => onQc(row.id, "approved"))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-200 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" /> Approve
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const reason = window.prompt("Alasan penolakan?") ?? "";
                    if (!reason.trim()) return;
                    void act(() => onQc(row.id, "rejected", reason.trim()));
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-400/40 bg-rose-400/10 px-3 py-1.5 text-xs text-rose-200 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(() => onQc(row.id, "duplicate", "Ditandai duplikat manual"))}
                  className="rounded-xl border border-orange-400/40 bg-orange-400/10 px-3 py-1.5 text-xs text-orange-200 disabled:opacity-50"
                >
                  Mark duplicate
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(() => onQc(row.id, "reviewed", "Minta verifikasi ulang"))}
                  className="rounded-xl border border-border/50 px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Request verification
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(() => onQc(row.id, "contacted"))}
                  className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary disabled:opacity-50"
                >
                  Contact ready
                </button>
                {row.google_maps_url ? (
                  <a
                    href={row.google_maps_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-border/50 px-3 py-1.5 text-xs text-muted-foreground"
                  >
                    Google Maps
                  </a>
                ) : null}
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}
