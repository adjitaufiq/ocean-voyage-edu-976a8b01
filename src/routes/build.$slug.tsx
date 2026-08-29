import { createFileRoute, notFound } from "@tanstack/react-router";

import { DemoVideo } from "@/components/kerjaku/marketing/DemoVideo";
import { DocPage } from "@/components/kerjaku/marketing/DocPage";
import { WorkflowFlow } from "@/components/kerjaku/marketing/WorkflowFlow";
import { getBuildLog } from "@/lib/seo/build-log";
import { buildDocHead } from "@/lib/seo/head";
import { SITE_URL } from "@/lib/seo/types";

export const Route = createFileRoute("/build/$slug")({
  loader: ({ params }) => {
    const log = getBuildLog(params.slug);
    if (!log) throw notFound();
    return { slug: log.slug };
  },
  head: ({ params }) => {
    const log = getBuildLog(params.slug);
    if (!log) {
      return {
        meta: [
          { title: "Build Log tidak ditemukan — KERJAKU" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    return buildDocHead(log, {
      ogType: "article",
      extraSchemas: [
        {
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: log.h1,
          description: log.description,
          url: `${SITE_URL}${log.path}`,
          datePublished: log.datePublished,
          dateModified: log.dateModified,
          inLanguage: "id-ID",
          author: { "@id": `${SITE_URL}/#organization` },
          publisher: { "@id": `${SITE_URL}/#organization` },
          mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}${log.path}` },
          about: log.project,
        },
      ],
    });
  },
  notFoundComponent: BuildLogNotFound,
  component: BuildLogDetail,
});

function BuildLogNotFound() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-28 text-center">
      <h1 className="font-display text-3xl">Build Log tidak ditemukan</h1>
      <p className="mt-4 text-sm text-muted-foreground">Silakan kembali ke daftar Build Log.</p>
    </main>
  );
}

function BuildLogDetail() {
  const { slug } = Route.useParams();
  const log = getBuildLog(slug);
  if (!log) return <BuildLogNotFound />;

  return (
    <DocPage doc={log}>
      <section className="mt-12" aria-labelledby="bukti-dan-alur">
        <h2 id="bukti-dan-alur" className="font-display text-[clamp(1.4rem,3.6vw,2rem)] leading-tight">
          Status & alur sistem
        </h2>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-primary/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-primary">
            {log.projectStatus}
          </span>
          {log.proof.map((label) => (
            <span
              key={label}
              className="rounded-full border border-border/60 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>
        {log.flow?.length ? (
          <WorkflowFlow steps={log.flow} label={`Alur kerja ${log.project}`} />
        ) : null}
        {log.demoUrl ? (
          <a
            href={log.demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full border border-primary/50 px-6 text-sm text-primary transition-colors hover:bg-primary/10"
          >
            {log.demoLabel ?? "Lihat demo"}
          </a>
        ) : null}
        <DemoVideo video={log.video} />
      </section>
    </DocPage>
  );
}
