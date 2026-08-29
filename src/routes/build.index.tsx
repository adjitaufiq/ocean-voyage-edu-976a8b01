import { createFileRoute, Link } from "@tanstack/react-router";

import { DocPage } from "@/components/kerjaku/marketing/DocPage";
import { buildLogs } from "@/lib/seo/build-log";
import { buildDocHead } from "@/lib/seo/head";
import type { DocPageContent } from "@/lib/seo/types";

const doc: DocPageContent = {
  path: "/build",
  breadcrumb: [
    { name: "Beranda", path: "/" },
    { name: "Build Log", path: "/build" },
  ],
  eyebrow: "BUILD LOG KERJAKU",
  h1: "Build Log: Catatan Pembangunan Sistem Nyata KERJAKU",
  title: "Build Log KERJAKU — Catatan Pembangunan Sistem & AI",
  description:
    "Catatan pembangunan sistem yang benar-benar dipakai KERJAKU: AI Consultant, AI Business Assistant, alur order brief sampai invoice, dan produk internal.",
  intro:
    "Setiap entri menjelaskan masalah yang dihadapi, alur kerja yang dibangun, keputusan teknis tingkat tinggi, kontrol manusia yang tetap ada, dan pelajaran yang didapat. Hanya sistem yang sudah berjalan yang ditulis di sini.",
  answer:
    "Build Log KERJAKU adalah kumpulan catatan pembangunan sistem internal dan produk yang sudah berjalan, ditulis untuk menunjukkan cara KERJAKU merancang alur kerja, memakai AI, dan menjaga kontrol manusia di setiap keputusan penting.",
  sections: [],
  related: [
    { to: "/cara-kerjaku-menggunakan-ai", label: "Cara KERJAKU Menggunakan AI" },
    { to: "/products", label: "Produk KERJAKU" },
    { to: "/insight", label: "Insight KERJAKU" },
  ],
  cta: {
    title: "Punya alur kerja yang ingin dirapikan?",
    body: "Ceritakan kondisi bisnis Anda ke AI Consultant KERJAKU untuk mendapat pemetaan kebutuhan sebelum memutuskan solusi.",
    button: "Mulai konsultasi",
  },
};

export const Route = createFileRoute("/build/")({
  head: () => buildDocHead(doc),
  component: BuildIndex,
});

function BuildIndex() {
  return (
    <DocPage doc={doc}>
      <section className="mt-14" aria-labelledby="daftar-build-log">
        <h2
          id="daftar-build-log"
          className="font-display text-[clamp(1.5rem,4vw,2.2rem)] leading-tight"
        >
          Semua entri
        </h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {buildLogs.map((log) => (
            <Link
              key={log.slug}
              to="/build/$slug"
              params={{ slug: log.slug }}
              className="rounded-[1.75rem] glass-panel p-6 transition-colors hover:border-primary/50"
            >
              <div className="flex flex-wrap gap-2">
                {log.proof.map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-primary/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-primary"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <h3 className="mt-4 font-display text-lg leading-tight">{log.project}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{log.summary}</p>
            </Link>
          ))}
        </div>
      </section>
    </DocPage>
  );
}
