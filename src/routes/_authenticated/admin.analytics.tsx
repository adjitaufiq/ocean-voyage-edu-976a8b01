import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  BadgeDollarSign,
  CheckCircle2,
  Clock,
  FolderKanban,
  Gauge,
  LineChart,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { AcquisitionPanel } from "@/components/admin/AcquisitionPanel";
import { BarRows, Chip, Funnel, GlassCard, MetricTile, SectionCard } from "@/components/admin/ui";
import { formatMoney } from "@/lib/admin/payments";
import { getExecutiveIntelligence } from "@/lib/bi.functions";
import { getAdminOverview, getProposalAnalytics } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  component: AnalyticsPage,
});

function compactMoney(value: number): string {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)} M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} jt`;
  if (value >= 1_000) return `Rp ${Math.round(value / 1_000)} rb`;
  return formatMoney(value);
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("id-ID", { month: "short" });
}

function RevenueTrend({ points }: { points: { month: string; revenue: number; leads: number }[] }) {
  const max = Math.max(1, ...points.map((p) => p.revenue));
  return (
    <div className="grid grid-cols-6 items-end gap-2 sm:gap-3">
      {points.map((point) => (
        <div key={point.month} className="min-w-0 text-center">
          <div className="flex h-28 items-end justify-center">
            <div
              className="w-full max-w-[2.5rem] rounded-t-xl bg-gradient-to-t from-primary/30 to-primary/80 transition-all"
              style={{ height: `${Math.max(4, (point.revenue / max) * 100)}%` }}
            />
          </div>
          <p className="mt-2 truncate text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
            {monthLabel(point.month)}
          </p>
          <p className="truncate text-[0.65rem] text-foreground">
            {point.revenue > 0 ? compactMoney(point.revenue) : "—"}
          </p>
          <p className="truncate text-[0.6rem] text-muted-foreground">{point.leads} lead</p>
        </div>
      ))}
    </div>
  );
}

function ConversionBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="min-w-0 truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 font-medium text-foreground">{value}%</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted/25">
        <div
          className={cn(
            "h-full rounded-full",
            value >= 50
              ? "bg-primary"
              : value >= 20
                ? "bg-gradient-to-r from-primary/80 to-primary/40"
                : "bg-amber-400/70",
          )}
          style={{ width: `${Math.min(100, Math.max(2, value))}%` }}
        />
      </div>
    </div>
  );
}

function AnalyticsPage() {
  const fetchBi = useServerFn(getExecutiveIntelligence);
  const fetchOverview = useServerFn(getAdminOverview);
  const fetchProposalStats = useServerFn(getProposalAnalytics);

  const bi = useQuery({ queryKey: ["admin", "executive-bi"], queryFn: () => fetchBi() });
  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: () => fetchOverview() });
  const proposalStats = useQuery({
    queryKey: ["admin", "proposal-analytics"],
    queryFn: () => fetchProposalStats(),
  });

  if (bi.isLoading) return <p className="text-sm text-muted-foreground">Memuat analitik…</p>;
  if (bi.error || !bi.data)
    return <p className="text-sm text-destructive">Gagal memuat analitik bisnis.</p>;

  const { overview: exec, sales, finance, projects } = bi.data;

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
            Executive Intelligence
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ringkasan performa bisnis KERJAKU: revenue, sales, keuangan, dan delivery.
          </p>
        </div>
        <Chip className="shrink-0 border-primary/30 bg-primary/10 text-primary">Owner view</Chip>
      </header>

      {/* 1. Executive Overview */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricTile
          label="Total Revenue"
          value={compactMoney(exec.revenue)}
          hint={`${finance.paidCount} invoice lunas`}
          icon={BadgeDollarSign}
          tone="primary"
        />
        <MetricTile
          label="Pipeline Value"
          value={compactMoney(exec.pipelineValue)}
          hint="proposal aktif + tagihan"
          icon={TrendingUp}
        />
        <MetricTile
          label="Active Projects"
          value={exec.activeProjects}
          hint={`${projects.completed} selesai`}
          icon={FolderKanban}
        />
        <MetricTile label="Total Clients" value={exec.totalClients} icon={Users} tone="primary" />
        <MetricTile label="Total Leads" value={exec.totalLeads} icon={Target} />
        <MetricTile
          label="Conversion Rate"
          value={`${exec.conversionRate}%`}
          hint={`avg deal ${compactMoney(exec.avgDealSize)}`}
          icon={Gauge}
        />
      </div>

      <AcquisitionPanel />

      {/* 2. Sales Analytics */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <SectionCard
          title="Sales Funnel"
          description="Visitor → AI Assessment → Lead → Proposal → Paid Client"
        >
          <Funnel steps={sales.funnel} />
        </SectionCard>

        <div className="min-w-0 space-y-4">
          <SectionCard title="Conversion Performance" description="Efisiensi tiap tahap">
            <div className="space-y-3">
              <ConversionBar label="Lead → Proposal" value={sales.conversion.leadToProposal} />
              <ConversionBar label="Proposal → Paid" value={sales.conversion.proposalToPaid} />
              <ConversionBar label="Lead → Client" value={sales.conversion.leadToClient} />
              <div className="grid grid-cols-3 gap-2 pt-1">
                <Chip className="justify-center border-destructive/30 bg-destructive/10 text-destructive">
                  Hot {sales.conversion.hot}
                </Chip>
                <Chip className="justify-center border-amber-500/30 bg-amber-500/10 text-amber-300">
                  Warm {sales.conversion.warm}
                </Chip>
                <Chip className="justify-center border-border/60 bg-muted/30 text-muted-foreground">
                  Cold {sales.conversion.cold}
                </Chip>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Proposal Engine" description="Performa dokumen penawaran">
            <div className="grid gap-2 sm:grid-cols-2">
              <MetricTile label="Proposal" value={proposalStats.data?.total ?? 0} />
              <MetricTile
                label="Approved"
                value={`${proposalStats.data?.conversionRate ?? 0}%`}
                hint={`${proposalStats.data?.approved ?? 0} approved`}
                tone="primary"
              />
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Lead Sources" description="Asal lead masuk">
          <BarRows items={sales.sources} empty="Belum ada sumber lead" />
        </SectionCard>
        <SectionCard title="Most Requested Packages" description="Paket paling diminati">
          <BarRows items={sales.packages} empty="Belum ada paket diminati" />
        </SectionCard>
        <SectionCard title="Kategori Bisnis" description="Segmen klien">
          <BarRows
            items={(overview.data?.categories ?? []).map((c) => ({ label: c.name, value: c.count }))}
            empty="Belum ada kategori"
          />
        </SectionCard>
      </div>

      {/* 3. Financial Analytics */}
      <SectionCard title="Financial Analytics" description="Kesehatan keuangan dan proyeksi">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Paid Invoices"
            value={finance.paidCount}
            hint={compactMoney(finance.paidAmount)}
            icon={CheckCircle2}
            tone="primary"
          />
          <MetricTile
            label="Outstanding"
            value={compactMoney(finance.outstandingAmount)}
            hint={`${finance.outstandingCount} invoice belum lunas`}
            icon={Wallet}
          />
          <MetricTile
            label="Overdue"
            value={finance.overdueCount}
            icon={AlertTriangle}
            tone={finance.overdueCount ? "hot" : "default"}
          />
          <MetricTile
            label="Forecast Bulan Depan"
            value={compactMoney(finance.forecast.nextMonth)}
            hint={`kuartal ${compactMoney(finance.forecast.quarter)}`}
            icon={LineChart}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="min-w-0 rounded-2xl border border-border/40 bg-background/30 p-4">
            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
              Monthly Revenue Trend
            </p>
            <div className="mt-3">
              <RevenueTrend points={finance.monthly} />
            </div>
            <p className="mt-3 text-[0.7rem] text-muted-foreground">
              Basis forecast: {finance.forecast.basis}.
            </p>
          </div>
          <div className="min-w-0">
            <SectionCard title="Invoice per Status" description="Distribusi tagihan">
              <BarRows items={finance.byStatus} empty="Belum ada invoice" />
            </SectionCard>
          </div>
        </div>
      </SectionCard>

      {/* 4. Project Analytics */}
      <SectionCard title="Project Analytics" description="Kapasitas dan kesehatan delivery">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <MetricTile label="Active" value={projects.active} icon={FolderKanban} tone="primary" />
          <MetricTile label="Completed" value={projects.completed} icon={CheckCircle2} />
          <MetricTile
            label="Delayed"
            value={projects.delayed}
            hint={`${projects.atRisk} at risk`}
            icon={AlertTriangle}
            tone={projects.delayed ? "hot" : "default"}
          />
          <MetricTile
            label="Avg Completion"
            value={`${projects.avgCompletionDays} hari`}
            icon={Clock}
          />
          <MetricTile label="Avg Progress" value={`${projects.avgProgress}%`} icon={Gauge} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <SectionCard title="Delivery Stage" description="Sebaran tahap project">
            <BarRows items={projects.byStage} empty="Belum ada project" />
          </SectionCard>
          <SectionCard title="Workload Distribution" description="Task aktif per anggota tim">
            <BarRows items={projects.workload} empty="Belum ada task aktif" />
          </SectionCard>
        </div>
      </SectionCard>

      <GlassCard className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <TrendingUp className="h-4 w-4" />
        </span>
        <p className="min-w-0 text-xs text-muted-foreground">
          Semua angka dihitung langsung dari data CRM, proposal, invoice, klien, dan project yang
          sudah ada — tidak ada data terpisah atau duplikat.
        </p>
      </GlassCard>
    </div>
  );
}
