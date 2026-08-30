import { analytics } from "@/lib/analytics";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { ArrowUpRight, Hourglass } from "lucide-react";
import { products, projects, type Project } from "@/lib/site-content";
import { Reveal } from "../Reveal";

const offsets = ["md:translate-y-0", "md:translate-y-10"];

/** Same accordion behaviour/style as the FAQ section. */
function Accordion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group rounded-[1.25rem] border border-border/50 bg-background/20 p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-foreground">
        <span className="font-display text-base leading-snug">{label}</span>
        <span className="shrink-0 text-primary transition-transform duration-300 group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function ProjectCard({ p, index }: { p: Project; index: number }) {
const open = () => {
    if (!p.url) return;
    analytics.portfolioProjectClick(p.name, p.url);
    analytics.liveDemoClick(p.name, p.url);
    window.open(p.url, "_blank", "noopener,noreferrer");
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className={`relative flex h-full flex-col rounded-[2rem] glass-panel p-6 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-2 ${offsets[index % 2]}`}
    >
      {p.status && (
        <span className="absolute right-6 top-6 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-primary ring-1 ring-primary/40">
          {p.status === "IN DEVELOPMENT" && <Hourglass className="h-3 w-3" />}
          {p.status}
        </span>
      )}

      {p.url ? (
        <button
          type="button"
          onClick={open}
          className="w-full max-w-[70%] cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <h3 className="inline-flex items-center gap-1.5 font-display text-2xl leading-tight transition-colors hover:text-primary">
            {p.name}
            <ArrowUpRight className="h-4 w-4 text-primary" />
          </h3>
        </button>
      ) : (
        <h3 className="max-w-[70%] font-display text-2xl leading-tight">{p.name}</h3>
      )}

      <p className="mt-2 text-[11px] uppercase tracking-[0.24em] text-primary/90">
        {p.tagline ?? p.category}
      </p>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{p.description}</p>

      <div className="mt-6 space-y-3">
        {p.problem && (
          <Accordion label="Masalah">
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {p.problem}
            </p>
          </Accordion>
        )}

        {p.solution && (
          <Accordion label="Solusi">
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {p.solution}
            </p>
          </Accordion>
        )}

        {(p.featureGroups?.length || p.features?.length) && (
          <Accordion label="Fitur Utama">
            {p.featureGroups && p.featureGroups.length > 0 ? (
              <div className="space-y-4">
                {p.featureGroups.map((g) => (
                  <div key={g.title}>
                    <p className="text-xs font-medium text-foreground">{g.title}</p>
                    <ul className="mt-1.5 space-y-1">
                      {g.items.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-1.5">
                {(p.features ?? []).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </Accordion>
        )}
      </div>

      {p.url && (
        <a
          href={p.url}
          target="_blank"
          rel="noreferrer"
onClick={() => {
            analytics.portfolioProjectClick(p.name, p.url);
            analytics.liveDemoClick(p.name, p.url);
          }}
          className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border border-primary/40 px-4 py-2 text-xs text-primary transition-colors hover:bg-primary/10"
        >
          Kunjungi Produk
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      )}
    </motion.article>
  );
}

export function ProductsStage() {
  const ref = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const drift = useTransform(scrollYProgress, [0, 1], [60, -60]);

  const order = ["RO MEMORY", "QResto", "DOMPET GUE", "MATERIAL ESTIMATOR"];
  const list = [...projects.Products].sort(
    (a, b) => order.indexOf(a.name) - order.indexOf(b.name),
  );

  return (
    <section id="products" ref={ref} className="relative min-h-[100svh] px-5 py-28 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-[11px] uppercase tracking-[0.42em] text-primary/90">
            {products.eyebrow}
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="mt-6 max-w-3xl text-balance font-display text-[clamp(2.2rem,6vw,4rem)] leading-[1.05]">
            {products.title}
          </h2>
        </Reveal>
        <Reveal delay={0.18}>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            {products.body}
          </p>
        </Reveal>

        <motion.div style={{ y: drift }} className="mt-12 grid items-start gap-5 md:grid-cols-2">
          {list.map((p, i) => (
            <ProjectCard key={p.name} p={p} index={i} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
