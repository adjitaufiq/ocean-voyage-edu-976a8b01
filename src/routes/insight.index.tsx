import { createFileRoute, Link } from "@tanstack/react-router";

import { DocPage } from "@/components/kerjaku/marketing/DocPage";
import { buildDocHead } from "@/lib/seo/head";
import { articles } from "@/lib/seo/insights";
import type { DocPageContent } from "@/lib/seo/types";

const doc: DocPageContent = {
  path: "/insight",
  breadcrumb: [
    { name: "Beranda", path: "/" },
    { name: "Insight", path: "/insight" },
  ],
  eyebrow: "INSIGHT KERJAKU",
  h1: "Insight: Cara Berpikir Sebelum Membangun Sistem",
  title: "Insight KERJAKU — Aplikasi Custom, Dashboard & AI Automation",
  description:
    "Catatan praktis KERJAKU tentang aplikasi custom, digitalisasi proses manual, dashboard operasional, dan penggunaan AI dalam bisnis.",
  intro:
    "Tulisan di bawah ini berasal dari pekerjaan nyata: memetakan proses, memilih fitur yang benar-benar dipakai, dan menentukan kapan sebuah sistem layak dibangun.",
  sections: [],
  cta: {
    title: "Punya kasus yang mirip?",
    body: "Diskusikan alur kerja Anda dengan AI Consultant KERJAKU untuk mendapat pemetaan kebutuhan yang jelas sebelum memutuskan solusi.",
    button: "Mulai konsultasi",
  },
};

export const Route = createFileRoute("/insight/")({
  head: () => buildDocHead(doc),
  component: InsightIndex,
});

function InsightIndex() {
  return (
    <DocPage doc={doc}>
      <section className="mt-14" aria-labelledby="daftar-artikel">
        <h2
          id="daftar-artikel"
          className="font-display text-[clamp(1.5rem,4vw,2.2rem)] leading-tight"
        >
          Semua artikel
        </h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {articles.map((article) => (
            <Link
              key={article.slug}
              to="/insight/$slug"
              params={{ slug: article.slug }}
              className="rounded-[1.75rem] glass-panel p-6 transition-colors hover:border-primary/50"
            >
              <time
                dateTime={article.datePublished}
                className="text-[10px] uppercase tracking-[0.28em] text-primary"
              >
                {article.datePublished}
              </time>
              <h3 className="mt-3 font-display text-lg leading-tight">{article.h1}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {article.summary}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </DocPage>
  );
}
