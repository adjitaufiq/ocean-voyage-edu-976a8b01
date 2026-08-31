/**
 * Organic acquisition panel: where traffic comes from and which of it actually
 * turns into qualified leads and deals. Reads aggregated, anonymous data only.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getAcquisitionIntelligence } from "@/lib/acquisition.functions";
import { MetricTile, SectionCard } from "./ui";

function Ratio({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="min-w-0 truncate text-muted-foreground">{label}</span>
      <span className="shrink-0 text-foreground">{value}%</span>
    </div>
  );
}

export function AcquisitionPanel() {
  const fetchAcquisition = useServerFn(getAcquisitionIntelligence);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "acquisition"],
    queryFn: () => fetchAcquisition(),
  });

  if (isLoading) {
    return (
      <SectionCard title="Organic Acquisition" description="Memuat data akuisisi…">
        <p className="text-xs text-muted-foreground">Menghitung funnel…</p>
      </SectionCard>
    );
  }
  if (!data) return null;

  const { funnel, ratios, channels, content, dataQuality } = data;
  const thin = dataQuality.eventsTracked < 25;

  return (
    <SectionCard
      title="Organic Acquisition"
      description="Perjalanan pengunjung sampai jadi deal (90 hari terakhir)"
    >
      {thin ? (
        <p className="mb-4 rounded-2xl bg-background/40 p-3 text-xs text-muted-foreground">
          Data masih sedikit ({dataQuality.eventsTracked} event). Angka di bawah belum
          representatif — biarkan berjalan beberapa hari dulu.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Visitors" value={String(funnel.visitors)} />
        <MetricTile label="Consultant Opens" value={String(funnel.consultantOpens)} />
        <MetricTile label="Consultations Selesai" value={String(funnel.consultationsCompleted)} />
        <MetricTile label="Leads" value={String(funnel.leads)} />
        <MetricTile label="Qualified Leads" value={String(funnel.qualifiedLeads)} />
        <MetricTile label="Hot Leads" value={String(funnel.hotLeads)} />
        <MetricTile label="Proposals" value={String(funnel.proposals)} />
        <MetricTile label="Deals" value={String(funnel.deals)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Conversion</p>
          <div className="mt-3 space-y-2">
            <Ratio label="Visitor → Consultant Open" value={ratios.visitorToConsultantOpen} />
            <Ratio label="Open → Start" value={ratios.openToStart} />
            <Ratio label="Start → Complete" value={ratios.startToComplete} />
            <Ratio label="Complete → Lead" value={ratios.completeToLead} />
            <Ratio label="Lead → Qualified" value={ratios.leadToQualified} />
            <Ratio label="Qualified → Proposal" value={ratios.qualifiedToProposal} />
            <Ratio label="Proposal → Deal" value={ratios.proposalToDeal} />
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Channel</p>
          <div className="mt-3 space-y-2">
            {channels.length ? (
              channels.slice(0, 8).map((channel) => (
                <div
                  key={channel.label}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-background/40 px-3 py-2 text-xs"
                >
                  <span className="min-w-0 truncate text-foreground">{channel.label}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {channel.visitors} visitor · {channel.leads} lead · {channel.qualifiedLeads} qualified
                    {channel.deals ? ` · ${channel.deals} deal` : ""}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">Belum ada data channel.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Content Performance
        </p>
        <div className="mt-3 space-y-2">
          {content.length ? (
            content.slice(0, 10).map((item) => (
              <div
                key={item.path}
                className="rounded-2xl bg-background/40 px-3 py-2 text-xs"
              >
                <p className="truncate text-foreground">{item.title || item.path}</p>
                <p className="mt-1 text-muted-foreground">
                  {item.views} view · {item.consultantOpens} consultant open · {item.leads} lead ·{" "}
                  {item.qualifiedLeads} qualified
                </p>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">Belum ada konten dengan data cukup.</p>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
