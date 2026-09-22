import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { GlassCard, MetricTile } from "@/components/admin/ui";
import {
  listEntityReviewQueueFn,
  listUnifiedEntitiesFn,
  resolveEntityReviewFn,
  runEntityBackfillFn,
} from "@/lib/entity-resolution.functions";

export const Route = createFileRoute("/_authenticated/admin/entities")({
  head: () => ({
    meta: [
      { title: "Business Entities — KERJAKU" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: EntitiesPage,
});

const SOURCE_LABELS: Record<string, string> = {
  prospect_candidate: "Kandidat",
  prospect: "Prospek",
  consultation: "Konsultasi",
  ai_conversation: "Percakapan AI",
};

function EntitiesPage() {
  const queryClient = useQueryClient();
  const listEntities = useServerFn(listUnifiedEntitiesFn);
  const listReview = useServerFn(listEntityReviewQueueFn);
  const runBackfill = useServerFn(runEntityBackfillFn);
  const resolveReview = useServerFn(resolveEntityReviewFn);

  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const entities = useQuery({
    queryKey: ["unified-entities", search],
    queryFn: () => listEntities({ data: { limit: 200, search: search || undefined } }),
  });
  const review = useQuery({
    queryKey: ["entity-review-queue"],
    queryFn: () => listReview({ data: { limit: 100 } }),
  });

  const rows = entities.data?.rows ?? [];
  const reviewRows = review.data?.rows ?? [];
  const withCandidate = rows.filter((r) => r.candidateLinks > 0).length;
  const withProspect = rows.filter((r) => r.prospectLinks > 0).length;
  const multiSource = rows.filter((r) => r.sources > 1).length;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["unified-entities"] });
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
      toast.success(decision === "link" ? "Ditautkan ke bisnis yang sama." : "Ditandai sebagai bisnis berbeda.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan keputusan.");
    }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Daftar bisnis terpadu</h1>
        <p className="text-xs text-muted-foreground">
          Pratinjau — satu identitas bisnis untuk semua sumber data. Dashboard lama tidak berubah.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Bisnis unik" value={String(rows.length)} />
        <MetricTile label="Punya kandidat" value={String(withCandidate)} />
        <MetricTile label="Punya prospek" value={String(withProspect)} />
        <MetricTile label="Lebih dari satu sumber" value={String(multiSource)} />
      </div>

      <GlassCard className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama bisnis"
            className="min-w-[200px] flex-1 rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => backfill(true)}
            className="rounded-xl border border-border/50 px-3 py-2 text-xs transition hover:text-foreground disabled:opacity-50"
          >
            Uji coba penautan
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => backfill(false)}
            className="rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition disabled:opacity-50"
          >
            Jalankan penautan
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Bisnis</th>
                <th className="py-2 pr-3">Kota</th>
                <th className="py-2 pr-3">Sumber</th>
                <th className="py-2 pr-3">Kandidat</th>
                <th className="py-2 pr-3">Prospek</th>
                <th className="py-2 pr-3">Kontak</th>
                <th className="py-2 pr-3">Tahap</th>
                <th className="py-2">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border/30">
                  <td className="py-2 pr-3 font-medium">{row.name}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{row.city ?? "—"}</td>
                  <td className="py-2 pr-3">{row.sources}</td>
                  <td className="py-2 pr-3">{row.candidateLinks}</td>
                  <td className="py-2 pr-3">{row.prospectLinks}</td>
                  <td className="py-2 pr-3">{row.hasContact ? "Ada" : "Belum"}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{row.stage}</td>
                  <td className="py-2 text-amber-500">
                    {row.duplicateWarning ? "Kemungkinan duplikat" : ""}
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={8} className="py-4 text-muted-foreground">
                    Belum ada bisnis tertaut. Jalankan penautan untuk mengisi daftar ini.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <GlassCard className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Antrean tinjauan duplikat ({reviewRows.length})</h2>
        <p className="text-xs text-muted-foreground">
          Kemiripan tidak cukup kuat untuk ditautkan otomatis. Tidak ada data yang digabung sampai Anda memutuskan.
        </p>
        {reviewRows.map((row) => (
          <div key={row.id} className="space-y-2 rounded-xl border border-border/40 p-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{row.businessA ?? "(tanpa nama)"}</span>
              <span className="text-muted-foreground">vs</span>
              <span className="font-medium">{row.businessB ?? "(tanpa nama)"}</span>
              <span className="rounded-lg border border-border/50 px-2 py-0.5 text-muted-foreground">
                {SOURCE_LABELS[row.sourceType] ?? row.sourceType}
              </span>
              <span className="text-muted-foreground">Keyakinan {row.confidence}%</span>
            </div>
            <p className="text-muted-foreground">{row.reason ?? "—"}</p>
            <pre className="max-h-32 overflow-auto rounded-lg bg-background/40 p-2 text-[10px] text-muted-foreground">
              {row.comparison}
            </pre>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => decide(row.id, "link")}
                className="rounded-lg border border-border/50 px-3 py-1.5 transition hover:text-foreground"
              >
                Bisnis yang sama
              </button>
              <button
                type="button"
                onClick={() => decide(row.id, "reject")}
                className="rounded-lg border border-border/50 px-3 py-1.5 transition hover:text-foreground"
              >
                Bisnis berbeda
              </button>
            </div>
          </div>
        ))}
        {!reviewRows.length ? (
          <p className="text-xs text-muted-foreground">Tidak ada yang perlu ditinjau.</p>
        ) : null}
      </GlassCard>
    </div>
  );
}
