import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { GlassCard } from "@/components/admin/ui";
import { entityDetailFn } from "@/lib/entity-dashboard.functions";
import { FUNNEL_LABELS } from "@/lib/entity-dashboard.shared";

export const Route = createFileRoute("/_authenticated/admin/entities/$id")({
  head: () => ({
    meta: [{ title: "Detail bisnis — KERJAKU" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: EntityDetailPage,
});

const FINDING_KIND: Record<string, string> = { fact: "Fakta", hypothesis: "Dugaan" };
const FINDING_STATUS: Record<string, string> = {
  unvalidated: "Belum divalidasi",
  confirmed: "Terkonfirmasi",
  rejected: "Ditolak",
  superseded: "Digantikan",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassCard className="space-y-2 p-4 text-xs">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </GlassCard>
  );
}

function EntityDetailPage() {
  const { id } = Route.useParams();
  const loadDetail = useServerFn(entityDetailFn);
  const detail = useQuery({
    queryKey: ["entity-detail", id],
    queryFn: () => loadDetail({ data: { id } }),
  });

  if (detail.isLoading) {
    return <GlassCard className="p-4 text-sm text-muted-foreground">Memuat bisnis…</GlassCard>;
  }
  if (!detail.data) {
    return (
      <GlassCard className="p-4 text-sm text-muted-foreground">Bisnis tidak ditemukan.</GlassCard>
    );
  }

  const { profile, sources, evidence, findings, consultant, sales, crm } = detail.data;

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <Link to="/admin/entities" className="text-xs text-muted-foreground hover:underline">
          ← Kembali ke bisnis terpadu
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">{profile.name}</h1>
        <p className="text-xs text-muted-foreground">
          {[profile.industry, profile.location].filter(Boolean).join(" • ") || "—"} •{" "}
          {FUNNEL_LABELS[profile.stage]}
        </p>
      </header>

      <Section title="Profil bisnis">
        <div className="grid gap-1 md:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Website: </span>
            {profile.website ? (
              <a href={profile.website} target="_blank" rel="noreferrer" className="underline">
                {profile.website}
              </a>
            ) : (
              "Belum ada"
            )}
          </p>
          <p>
            <span className="text-muted-foreground">Telepon: </span>
            {profile.phone ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">WhatsApp: </span>
            {profile.whatsapp ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Email: </span>
            {profile.email ?? "—"}
          </p>
          {profile.googleMapsUrl ? (
            <p className="md:col-span-2">
              <a
                href={profile.googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Lihat di Google Maps
              </a>
            </p>
          ) : null}
        </div>
      </Section>

      <Section title={`Sumber data (${sources.length})`}>
        {sources.length ? (
          <ul className="space-y-1">
            {sources.map((source) => (
              <li key={`${source.type}-${source.id}`} className="text-muted-foreground">
                {source.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Belum ada sumber tertaut.</p>
        )}
      </Section>

      <Section title="Bukti data (data → sumber → keyakinan)">
        {evidence.length ? (
          <div className="space-y-1">
            {evidence.map((item, index) => (
              <div key={`${item.field}-${index}`} className="flex flex-wrap gap-x-2">
                <span className="text-muted-foreground">{item.field}:</span>
                <span>{item.data}</span>
                <span className="text-muted-foreground">
                  •{" "}
                  {item.sourceUrl ? (
                    <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="underline">
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
        ) : (
          <p className="text-muted-foreground">Belum ada bukti tersimpan.</p>
        )}
      </Section>

      <Section title="Temuan (fakta vs dugaan)">
        {findings.length ? (
          <ul className="space-y-1">
            {findings.map((item, index) => (
              <li key={index}>
                <span className="text-muted-foreground">
                  {FINDING_KIND[item.kind] ?? item.kind} •{" "}
                  {FINDING_STATUS[item.status] ?? item.status}
                  {item.confidence == null ? "" : ` • ${item.confidence}%`}:{" "}
                </span>
                {item.statement}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Belum ada temuan tercatat.</p>
        )}
      </Section>

      <Section title="Pemahaman konsultan">
        {consultant ? (
          <div className="space-y-2">
            <p className="text-muted-foreground">
              Versi {consultant.version} • keyakinan {consultant.confidence}%
              {consultant.generatedAt
                ? ` • ${new Date(consultant.generatedAt).toLocaleString("id-ID")}`
                : ""}
            </p>
            {consultant.summary ? <p>{consultant.summary}</p> : null}
            {consultant.hypotheses.length ? (
              <div>
                <p className="text-muted-foreground">Dugaan masalah (belum dikonfirmasi)</p>
                <ul className="list-disc pl-4">
                  {consultant.hypotheses.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p>
              <span className="text-muted-foreground">Solusi inti: </span>
              {consultant.solution || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Fitur: </span>
              {consultant.features.join(", ") || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Paket: </span>
              {consultant.package || "—"}
            </p>
            {consultant.reasoning.length ? (
              <div>
                <p className="text-muted-foreground">Alasan konsultan</p>
                <ul className="list-disc pl-4">
                  {consultant.reasoning.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground">Belum ada analisis konsultan untuk bisnis ini.</p>
        )}
      </Section>

      <Section title="Penjualan">
        {sales.preparation ? (
          <div className="space-y-1">
            <p className="text-muted-foreground">
              Materi aktif sejak {new Date(sales.preparation.createdAt).toLocaleString("id-ID")}
            </p>
            <p>
              <span className="text-muted-foreground">Rekomendasi: </span>
              {sales.preparation.solution ?? "—"}
            </p>
            {sales.preparation.approach ? <p>{sales.preparation.approach}</p> : null}
            {sales.preparation.opening ? (
              <p>
                <span className="text-muted-foreground">Pembuka: </span>
                {sales.preparation.opening}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground">Belum ada materi penjualan aktif.</p>
        )}
        <p>
          <span className="text-muted-foreground">Tahap kontak: </span>
          {sales.contactStage ?? "Belum dihubungi"}
        </p>
      </Section>

      <Section title={`Riwayat CRM (${crm.length})`}>
        {crm.length ? (
          <ul className="space-y-1">
            {crm.map((item, index) => (
              <li key={index}>
                <span className="text-muted-foreground">
                  {new Date(item.at).toLocaleString("id-ID")} • {item.kind}:{" "}
                </span>
                {item.label}
                {item.detail ? (
                  <span className="text-muted-foreground"> — {item.detail}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Belum ada riwayat.</p>
        )}
      </Section>
    </div>
  );
}
