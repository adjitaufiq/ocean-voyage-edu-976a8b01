import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { GlassCard, MetricTile } from "@/components/admin/ui";
import { entityFunnelFn, listEntityPageFn } from "@/lib/entity-dashboard.functions";
import { FUNNEL_LABELS, SOURCE_FILTERS, type FunnelStage } from "@/lib/entity-dashboard.shared";
import {
  listEntityReviewQueueFn,
  resolveEntityReviewFn,
  runEntityBackfillFn,
} from "@/lib/entity-resolution.functions";

export const Route = createFileRoute("/_authenticated/admin/entities/")({
  head: () => ({
    meta: [{ title: "Bisnis terpadu — KERJAKU" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: EntitiesPage,
});

const SOURCE_LABELS: Record<string, string> = {
  prospect_candidate: "Kandidat",
  prospect: "Prospek",
  consultation: "Konsultasi",
  ai_conversation: "Percakapan AI",
};

const selectClass =
  "rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-xs text-foreground";

type Filters = {
  search: string;
  industry: string;
  stage: FunnelStage | "";
  source: string;
  analysis: string;
  sales: string;
  contact: string;
  duplicatesOnly: boolean;
};

const EMPTY_FILTERS: Filters = {
  search: "",
  industry: "",
  stage: "",
  source: "",
  analysis: "",
  sales: "",
  contact: "",
  duplicatesOnly: false,
};

function toPayload(filters: Filters) {
  return {
    search: filters.search.trim() || undefined,
    industry: filters.industry.trim() || undefined,
    stage: (filters.stage || undefined) as FunnelStage | undefined,
    source: (filters.source || undefined) as
      | "prospect_candidate"
      | "prospect"
      | "consultation"
      | "ai_conversation"
      | undefined,
    analysis: (filters.analysis || undefined) as "with" | "without" | undefined,
    sales: (filters.sales || undefined) as "prepared" | "not_prepared" | "ready" | undefined,
    contact: (filters.contact || undefined) as "contacted" | "not_contacted" | undefined,
    duplicatesOnly: filters.duplicatesOnly || undefined,
  };
}

function EntitiesPage() {
  const queryClient = useQueryClient();
  const loadFunnel = useServerFn(entityFunnelFn);
  const loadPage = useServerFn(listEntityPageFn);
  const listReview = useServerFn(listEntityReviewQueueFn);
  const runBackfill = useServerFn(runEntityBackfillFn);
  const resolveReview = useServerFn(resolveEntityReviewFn);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);

  const payload = toPayload(filters);

  const funnel = useQuery({
    queryKey: ["entity-funnel", payload],
    queryFn: () => loadFunnel({ data: payload }),
  });
  const list = useQuery({
    queryKey: ["entity-page", payload, page],
    queryFn: () => loadPage({ data: { ...payload, page, pageSize: 25 } }),
  });
  const review = useQuery({
    queryKey: ["entity-review-queue"],
    queryFn: () => listReview({ data: { limit: 50 } }),
  });

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / (list.data?.pageSize ?? 25)));
  const reviewRows = review.data?.rows ?? [];

  function update(patch: Partial<Filters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["entity-funnel"] });
    await queryClient.invalidateQueries({ queryKey: ["entity-page"] });
    await queryClient.invalidateQueries({ queryKey: ["entity-review-queue"] });
  }

  async function backfill(dryRun: boolean) {
    setBusy(true);
    try {
      const report = await runBackfill({ data: { dryRun, limit: 1000 } });
      const t = report.totals;
      toast.success(
        `${dryRun ? "Uji coba" : "Penautan"} selesai — dipindai ${t.scanned}, cocok otomatis ${t.autoMatched}, saran ${t.suggested}, perlu ditinjau ${t.reviewRequired}, bisnis baru ${t.created}, sudah tertaut ${t.alreadyLinked}${t.failed ? `, gagal ${t.failed}` : ""}.`,
      );
      if (!dryRun) await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menjalankan penautan.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, decision: "link" | "reject") {
    try {
      await resolveReview({ data: { id, decision } });
      toast.success(
        decision === "link" ? "Ditautkan ke bisnis yang sama." : "Ditandai sebagai bisnis berbeda.",
      );
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan keputusan.");
    }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Bisnis terpadu</h1>
        <p className="text-xs text-muted-foreground">
          Semua angka dihitung per bisnis. Satu bisnis yang ditemukan berkali-kali dan sudah menjadi
          prospek tetap dihitung satu.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricTile label="Bisnis unik" value={String(funnel.data?.total ?? 0)} />
        {(funnel.data?.stages ?? []).slice(0, 4).map((stage) => (
          <button key={stage.stage} type="button" onClick={() => update({ stage: stage.stage })}>
            <MetricTile label={stage.label} value={String(stage.count)} />
          </button>
        ))}
      </div>

      <GlassCard className="space-y-2 p-4">
        <h2 className="text-sm font-semibold">Corong bisnis</h2>
        <div className="space-y-1.5">
          {(funnel.data?.stages ?? []).map((stage) => {
            const width = funnel.data?.total
              ? Math.round((stage.count / funnel.data.total) * 100)
              : 0;
            return (
              <button
                key={stage.stage}
                type="button"
                onClick={() => update({ stage: stage.stage })}
                className="flex w-full items-center gap-3 text-left text-xs"
              >
                <span className="w-44 shrink-0 text-muted-foreground">{stage.label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-background/50">
                  <span
                    className="block h-full rounded-full bg-primary/70"
                    style={{ width: `${width}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right font-medium">{stage.count}</span>
              </button>
            );
          })}
        </div>
      </GlassCard>

      <GlassCard className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
            placeholder="Cari nama, domain, nomor, kota, kategori, sumber"
            className="min-w-[220px] flex-1 rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm"
          />
          <input
            value={filters.industry}
            onChange={(event) => update({ industry: event.target.value })}
            placeholder="Industri"
            className={selectClass}
          />
          <select
            className={selectClass}
            value={filters.stage}
            onChange={(event) => update({ stage: event.target.value as FunnelStage | "" })}
          >
            <option value="">Semua tahap</option>
            {Object.entries(FUNNEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={filters.source}
            onChange={(event) => update({ source: event.target.value })}
          >
            <option value="">Semua sumber</option>
            {SOURCE_FILTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={filters.analysis}
            onChange={(event) => update({ analysis: event.target.value })}
          >
            <option value="">Analisis konsultan</option>
            <option value="with">Sudah dianalisis</option>
            <option value="without">Belum dianalisis</option>
          </select>
          <select
            className={selectClass}
            value={filters.sales}
            onChange={(event) => update({ sales: event.target.value })}
          >
            <option value="">Status penjualan</option>
            <option value="prepared">Materi aktif</option>
            <option value="not_prepared">Belum ada materi</option>
            <option value="ready">Siap dihubungi</option>
          </select>
          <select
            className={selectClass}
            value={filters.contact}
            onChange={(event) => update({ contact: event.target.value })}
          >
            <option value="">Status kontak</option>
            <option value="contacted">Sudah dihubungi</option>
            <option value="not_contacted">Belum dihubungi</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={filters.duplicatesOnly}
              onChange={(event) => update({ duplicatesOnly: event.target.checked })}
            />
            Hanya kemungkinan duplikat
          </label>
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setPage(1);
            }}
            className="rounded-xl border border-border/50 px-3 py-2 text-xs"
          >
            Reset
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => backfill(true)}
            className="rounded-xl border border-border/50 px-3 py-2 text-xs disabled:opacity-50"
          >
            Uji coba penautan
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => backfill(false)}
            className="rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Jalankan penautan
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Bisnis</th>
                <th className="py-2 pr-3">Industri</th>
                <th className="py-2 pr-3">Kota</th>
                <th className="py-2 pr-3">Sumber</th>
                <th className="py-2 pr-3">Skor</th>
                <th className="py-2 pr-3">Tahap</th>
                <th className="py-2 pr-3">Analisis</th>
                <th className="py-2">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border/30">
                  <td className="py-2 pr-3 font-medium">
                    <Link
                      to="/admin/entities/$id"
                      params={{ id: row.id }}
                      className="underline-offset-2 hover:underline"
                    >
                      {row.name || "(tanpa nama)"}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{row.industry ?? "—"}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{row.city ?? "—"}</td>
                  <td className="py-2 pr-3">
                    {row.sources}
                    <span className="ml-1 text-muted-foreground">
                      ({row.candidateLinks}K/{row.prospectLinks}P)
                    </span>
                  </td>
                  <td className="py-2 pr-3">{row.leadScore ?? "—"}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{FUNNEL_LABELS[row.stage]}</td>
                  <td className="py-2 pr-3">{row.analyzed ? "Ada" : "—"}</td>
                  <td className="py-2 text-amber-500">
                    {row.duplicateWarning ? "Kemungkinan duplikat" : ""}
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={8} className="py-4 text-muted-foreground">
                    {list.isLoading ? "Memuat…" : "Tidak ada bisnis untuk filter ini."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {total} bisnis • halaman {page} dari {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-border/50 px-3 py-1.5 disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              className="rounded-xl border border-border/50 px-3 py-1.5 disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="flex flex-wrap items-center gap-3 p-4">
        <div className="mr-auto space-y-1">
          <h2 className="text-sm font-semibold">Antrean tinjauan duplikat ({reviewRows.length})</h2>
          <p className="text-xs text-muted-foreground">
            Tinjau kecocokan, batalkan keputusan, lihat laporan audit, dan kelola perbaikan massal.
          </p>
        </div>
        <Link
          to="/admin/entities/review"
          className="rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
        >
          Buka tinjauan & perbaikan
        </Link>
      </GlassCard>
    </div>
  );
}
