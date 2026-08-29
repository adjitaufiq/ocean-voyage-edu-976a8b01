/**
 * Shared renderer for KERJAKU marketing/content pages.
 * Keeps the ocean glassmorphism visual language while enforcing a single H1,
 * semantic sections, and consistent internal linking.
 */
import { Link } from "@tanstack/react-router";

import { SiteFooter } from "@/components/kerjaku/SiteFooter";
import type { Block, DocPageContent } from "@/lib/seo/types";

function BlockView({ block }: { block: Block }) {
  if (block.kind === "p") {
    return <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">{block.text}</p>;
  }
  if (block.kind === "list") {
    return (
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {block.items.map((item) => (
          <li
            key={item}
            className="rounded-2xl glass-panel px-5 py-4 text-sm leading-relaxed text-muted-foreground"
          >
            {item}
          </li>
        ))}
      </ul>
    );
  }
  if (block.kind === "cards") {
    return (
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {block.items.map((item) => (
          <article key={item.title} className="rounded-[1.75rem] glass-panel p-6">
            <h3 className="font-display text-lg leading-tight">{item.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
          </article>
        ))}
      </div>
    );
  }
  return (
    <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {block.items.map((item, i) => (
        <li key={item.title} className="rounded-2xl glass-panel p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-primary">
            {String(i + 1).padStart(2, "0")}
          </p>
          <h3 className="mt-3 font-display text-base leading-tight">{item.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function DocPage({ doc, children }: { doc: DocPageContent; children?: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, color-mix(in oklab, var(--primary) 16%, transparent), transparent 60%), linear-gradient(to bottom, var(--abyss, #04121f), var(--background))",
        }}
      />

      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 sm:px-8">
        <Link to="/" className="nav-wordmark text-sm tracking-[0.22em]">
          KERJAKU
        </Link>
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
          Kembali ke Beranda
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24 sm:px-8">
        <nav aria-label="Breadcrumb" className="text-[11px] text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-2">
            {doc.breadcrumb.map((crumb, i) => (
              <li key={crumb.path} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden="true">/</span>}
                {i === doc.breadcrumb.length - 1 ? (
                  <span aria-current="page">{crumb.name}</span>
                ) : (
                  <Link to={crumb.path as never} className="hover:text-foreground">
                    {crumb.name}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <section className="pt-6 sm:pt-10">
          <p className="text-[11px] uppercase tracking-[0.42em] text-primary/90">{doc.eyebrow}</p>
          <h1 className="mt-6 max-w-3xl text-balance font-display text-[clamp(2rem,5.6vw,3.4rem)] leading-[1.08]">
            {doc.h1}
          </h1>
          {doc.answer ? (
            <p className="mt-6 max-w-3xl rounded-2xl glass-panel p-5 text-sm leading-relaxed text-foreground">
              {doc.answer}
            </p>
          ) : null}
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {doc.intro}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/"
              hash="konsultasi"
              className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-7 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Konsultasi dengan AI Consultant
            </Link>
          </div>
        </section>

        {doc.sections.map((section) => (
          <section key={section.id} className="mt-16" aria-labelledby={section.id}>
            <h2
              id={section.id}
              className="font-display text-[clamp(1.5rem,4vw,2.2rem)] leading-tight"
            >
              {section.heading}
            </h2>
            {section.blocks.map((block, i) => (
              <BlockView key={i} block={block} />
            ))}
          </section>
        ))}

        {children}

        {doc.faq?.length ? (
          <section className="mt-16" aria-labelledby="faq">
            <h2 id="faq" className="font-display text-[clamp(1.5rem,4vw,2.2rem)] leading-tight">
              Pertanyaan yang Sering Diajukan
            </h2>
            <div className="mt-6 space-y-4">
              {doc.faq.map((item) => (
                <article key={item.q} className="rounded-2xl glass-panel p-5">
                  <h3 className="text-sm font-medium leading-snug text-foreground">{item.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {doc.related?.length ? (
          <section className="mt-16" aria-labelledby="terkait">
            <h2 id="terkait" className="font-display text-[clamp(1.5rem,4vw,2.2rem)] leading-tight">
              Baca juga
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {doc.related.map((link) => (
                <Link
                  key={String(link.to)}
                  to={link.to as never}
                  className="rounded-2xl glass-panel p-5 transition-colors hover:border-primary/50"
                >
                  <span className="font-display text-base leading-tight text-foreground">
                    {link.label}
                  </span>
                  {link.note ? (
                    <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">
                      {link.note}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-16 rounded-[2rem] glass-panel p-7 sm:p-10" aria-labelledby="cta">
          <h2 id="cta" className="font-display text-[clamp(1.5rem,4vw,2.2rem)] leading-tight">
            {doc.cta.title}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {doc.cta.body}
          </p>
          <Link
            to="/"
            hash="konsultasi"
            className="mt-7 inline-flex h-12 items-center justify-center rounded-full bg-primary px-7 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            {doc.cta.button}
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
