import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { GlassCard } from "@/components/admin/ui";
import { REVIEW_RISK_LABELS, type ReviewRisk } from "@/lib/admin/entity-review";
import {
  entityRepairActionFn,
  entityRepairStatusFn,
  entityReviewAuditFn,
  listEntityReviewFilteredFn,
  resolveEntityReviewFn,
  undoEntityReviewFn,
} from "@/lib/entity-resolution.functions";

export const Route = createFileRoute("/_authenticated/admin/entities/review")({
  head: () => ({
    meta: [
      { title: "Tinjauan & perbaikan bisnis — KERJAKU" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ReviewPage,
});

type Filter = "open" | "suggested" | "review_required" | "decided";
type Source = "prospect_candidate" | "prospect" | "consultation" | "ai_conversation" | "client";

const SOURCE_LABELS: Record<string, string> = {
  prospect_candidate: "Kandidat",
  prospect: "Prospek",
  consultation: "Konsultasi",
  ai_conversation: "Percakapan AI",
  client: "Klien",
};
const STATUS_LABELS: Record<string, string> = {
  suggested: "Saran",
  review_required: "Perlu ditinjau",
  confirmed: "Disetujui",
  rejected: "Ditolak",
};
const RISK_CLASS: Record<ReviewRisk, string> = {
  high: "text-destructive",
  medium: "text-amber-500",
  low: "text-primary",
};
const btn = "rounded-lg border border-border/50 px-3 py-1.5 text-xs disabled:opacity-50";

function fmt(date: string | null) {
  return date ? new Date(date).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function ReviewPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listEntityReviewFilteredFn);
  const resolveFn = useServerFn(resolveEntityReviewFn);
  const undoFn = useServerFn(undoEntityReviewFn);
  const auditFn = useServerFn(entityReviewAuditFn);
  const statusFn = useServerFn(entityRepairStatusFn);
  const actionFn = useServerFn(entityRepairActionFn);

  const [filter, setFilter] = useState<Filter>("open");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [source, setSource] = useState<Source>("client");
  const [dryRun, setDryRun] = useState(true);

  const list = useQuery({
    queryKey: ["entity-review", filter],
    queryFn: () => listFn({ data: { filter, limit: 150 } }),
  });
  const audit = useQuery({ queryKey: ["entity-review-audit"], queryFn: () => auditFn() });
  const repair = useQuery({ queryKey: ["entity-repair-status"], queryFn: () => statusFn() });

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["entity-review"] }),
      qc.invalidateQueries({ queryKey: ["entity-review-audit"] }),
      qc.invalidateQueries({ queryKey: ["entity-repair-status"] }),
      qc.invalidateQueries({ queryKey: ["entity-page"] }),
    ]);
  }

  async function act(id: string, fn: () => Promise<unknown>, ok: string) {
    setBusyId(id);
    try {
      await fn();
      toast.success(ok);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan.");
    } finally {
      setBusyId(null);
    }
  }

  const rows = list.data?.rows ?? [];
  const runs = repair.data?.runs ?? [];
  const openFailures = repair.data?.openFailures ?? {};

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link to="/admin/entities" className="text-xs text-muted-foreground hover:underline">
          ← Kembali ke bisnis terpadu
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Tinjauan & perbaikan bisnis</h1>
        <p className="text-xs text-muted-foreground">
          Tidak ada yang digabung otomatis. Setiap keputusan tercatat dan bisa dibatalkan.
        </p>
      </header>

      {/* Audit report */}
      <GlassCard className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Laporan audit antrean</h2>
        {audit.isLoading ? <p className="text-xs text-muted-foreground">Memuat…</p> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {(["suggested", "review_required"] as const).map((key) => {
            const a = audit.data?.[key];
            if (!a) return null;
            return (
              <div key={key} className="space-y-1.5 rounded-xl border border-border/40 p-3 text-xs">
                <p className="font-medium">
                  {STATUS_LABELS[key]}: {a.count}
                </p>
                <p className="text-muted-foreground">Rata-rata keyakinan {a.avgConfidence}%</p>
                <p>
                  {(Object.keys(a.byRisk) as ReviewRisk[]).map((r) => (
                    <span key={r} className={`mr-3 ${RISK_CLASS[r]}`}>
                      {REVIEW_RISK_LABELS[r]}: {a.byRisk[r]}
                    </span>
                  ))}
                </p>
                <p className="text-muted-foreground">
                  Keyakinan: {Object.entries(a.byConfidence).map(([k, v]) => `${k}: ${v}`).join(" • ") || "—"}
                </p>
                <p className="text-muted-foreground">
                  Sumber: {Object.entries(a.bySource).map(([k, v]) => `${SOURCE_LABELS[k] ?? k} ${v}`).join(" • ") || "—"}
                </p>
                <ul className="list-disc pl-4 text-muted-foreground">
                  {a.sample.map((s) => (
                    <li key={s.id}>
                      {s.sourceName ?? "—"} → {s.businessB ?? "—"} ({s.confidence}%)
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Review queue */}
      <GlassCard className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-sm font-semibold">Antrean tinjauan ({rows.length})</h2>
          {(["open", "suggested", "review_required", "decided"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`${btn} ${filter === f ? "bg-primary text-primary-foreground" : ""}`}
            >
              {f === "open" ? "Semua terbuka" : f === "decided" ? "Sudah diputuskan" : STATUS_LABELS[f]}
            </button>
          ))}
        </div>
        {list.isLoading ? <p className="text-xs text-muted-foreground">Memuat…</p> : null}
        {rows.map((row) => (
          <div key={row.id} className="space-y-2 rounded-xl border border-border/40 p-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-border/50 px-2 py-0.5">
                {STATUS_LABELS[row.status] ?? row.status}
              </span>
              <span className={RISK_CLASS[row.risk]}>{REVIEW_RISK_LABELS[row.risk]}</span>
              <span className="text-muted-foreground">Keyakinan {row.confidence}%</span>
              <span className="ml-auto text-muted-foreground">Dibuat {fmt(row.createdAt)}</span>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <div>
                <p className="text-muted-foreground">Data sumber</p>
                <p className="font-medium">
                  {row.sourceName ?? "(tanpa nama)"}{" "}
                  <span className="text-muted-foreground">({SOURCE_LABELS[row.sourceType] ?? row.sourceType})</span>
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Bisnis saat ini</p>
                {row.currentEntityId ? (
                  <Link to="/admin/entities/$id" params={{ id: row.currentEntityId }} className="font-medium underline-offset-2 hover:underline">
                    {row.businessA ?? "(tanpa nama)"}
                  </Link>
                ) : (
                  <p>—</p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground">Bisnis yang disarankan</p>
                {row.suggestedEntityId ? (
                  <Link to="/admin/entities/$id" params={{ id: row.suggestedEntityId }} className="font-medium underline-offset-2 hover:underline">
                    {row.businessB ?? "(tanpa nama)"}
                  </Link>
                ) : (
                  <p>—</p>
                )}
              </div>
            </div>
            <p className="text-muted-foreground">Sinyal: {row.signals.join(" • ") || "—"}</p>
            <p className="text-muted-foreground">Alasan: {row.reason ?? "—"}</p>
            {row.decidedAt ? <p className="text-muted-foreground">Diputuskan {fmt(row.decidedAt)}</p> : null}
            <div className="flex flex-wrap gap-2">
              {row.decidedAt ? (
                <button
                  type="button"
                  disabled={busyId === row.id}
                  className={btn}
                  onClick={() => act(row.id, () => undoFn({ data: { id: row.id } }), "Keputusan dibatalkan, item dibuka lagi.")}
                >
                  Batalkan keputusan
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busyId === row.id || !row.suggestedEntityId}
                    className={btn}
                    onClick={() => act(row.id, () => resolveFn({ data: { id: row.id, decision: "link" } }), "Disetujui: bisnis yang sama.")}
                  >
                    Setujui — bisnis sama
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    className={btn}
                    onClick={() => act(row.id, () => resolveFn({ data: { id: row.id, decision: "reject" } }), "Ditolak: bisnis berbeda.")}
                  >
                    Tolak — bisnis berbeda
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {!list.isLoading && !rows.length ? (
          <p className="text-xs text-muted-foreground">Tidak ada item untuk filter ini.</p>
        ) : null}
      </GlassCard>

      {/* Repair controls */}
      <GlassCard className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Perbaikan massal penautan</h2>
        <p className="text-xs text-muted-foreground">
          Tidak pernah berjalan sendiri. Uji coba tidak mengubah data. Setiap langkah memproses satu halaman.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as Source)}
            className="rounded-xl border border-border/50 bg-background/40 px-3 py-2"
          >
            {Object.entries(SOURCE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-muted-foreground">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} /> Uji coba saja
          </label>
          <button
            type="button"
            className={btn}
            disabled={busyId === "start"}
            onClick={() => act("start", () => actionFn({ data: { action: "start", source, dryRun } }), "Job dibuat.")}
          >
            Mulai job
          </button>
          <button
            type="button"
            className={btn}
            disabled={busyId === "retry" || !openFailures[source]}
            onClick={() => act("retry", () => actionFn({ data: { action: "retry", source } }), "Percobaan ulang selesai.")}
          >
            Coba ulang gagal ({openFailures[source] ?? 0})
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Sumber</th>
                <th className="py-2 pr-3">Mode</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Diproses</th>
                <th className="py-2 pr-3">Baru / cocok / gagal</th>
                <th className="py-2 pr-3">Dibuat</th>
                <th className="py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const active = run.status === "pending" || run.status === "running";
                return (
                  <tr key={run.id} className="border-t border-border/30">
                    <td className="py-2 pr-3">{SOURCE_LABELS[run.source_type] ?? run.source_type}</td>
                    <td className="py-2 pr-3">{run.dry_run ? "Uji coba" : "Nyata"}</td>
                    <td className="py-2 pr-3">
                      {run.status}
                      {run.last_error ? <span className="block text-destructive">{run.last_error}</span> : null}
                    </td>
                    <td className="py-2 pr-3">{run.processed}</td>
                    <td className="py-2 pr-3">
                      {run.created} / {run.matched} / {run.failed}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{fmt(run.created_at)}</td>
                    <td className="flex gap-1 py-2">
                      {active ? (
                        <>
                          <button type="button" className={btn} disabled={busyId === run.id}
                            onClick={() => act(run.id, () => actionFn({ data: { action: "step", runId: run.id } }), "Satu halaman diproses.")}>
                            Jalankan langkah
                          </button>
                          <button type="button" className={btn} disabled={busyId === run.id}
                            onClick={() => act(run.id, () => actionFn({ data: { action: "pause", runId: run.id } }), "Job dijeda.")}>
                            Jeda
                          </button>
                        </>
                      ) : run.status === "paused" ? (
                        <button type="button" className={btn} disabled={busyId === run.id}
                          onClick={() => act(run.id, () => actionFn({ data: { action: "resume", runId: run.id } }), "Job dilanjutkan.")}>
                          Lanjutkan
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {!runs.length ? (
                <tr>
                  <td colSpan={7} className="py-3 text-muted-foreground">Belum ada job perbaikan.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
