import { Link } from "@tanstack/react-router";
import { Reveal } from "../Reveal";

const pillars = [
  {
    to: "/jasa-pembuatan-website",
    label: "Website & Landing Page",
    note: "Company profile dan landing page dengan fondasi SEO teknis.",
  },
  {
    to: "/jasa-pembuatan-aplikasi-custom",
    label: "Aplikasi Custom & Web Application",
    note: "Sistem kerja internal yang mengikuti alur bisnis Anda.",
  },
  {
    to: "/jasa-dashboard-bisnis",
    label: "Sistem Perusahaan & Dashboard",
    note: "Data operasional terpusat, terpantau, dan bisa dilaporkan.",
  },
  {
    to: "/jasa-ai-automation-bisnis",
    label: "AI Automation & Integrasi AI",
    note: "AI yang bekerja di atas aturan bisnis dan kendali manusia.",
  },
] as const;

export function ServiceEntryStage() {
  return (
    <section id="service" className="relative px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <div className="flex flex-col gap-6 rounded-[2rem] glass-panel p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
            <div className="max-w-xl">
              <p className="text-[11px] uppercase tracking-[0.42em] text-primary/90">
                Build With KERJAKU
              </p>
              <h2 className="mt-4 font-display text-[clamp(1.5rem,3.6vw,2.1rem)] leading-tight">
                Punya masalah kerja yang ingin dijadikan sistem?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Website, landing page, web application, dashboard, hingga AI dan automation — dibuat
                mengikuti kebutuhan dan alur kerja nyata.
              </p>
            </div>
            <Link
              to="/jasa-pembuatan-website-aplikasi-landing-page"
              className="inline-flex h-12 shrink-0 items-center justify-center rounded-full border border-primary/40 px-6 text-sm text-primary transition-colors hover:bg-primary/10"
            >
              Jasa &amp; Project
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {pillars.map((pillar) => (
              <li key={pillar.to}>
                <Link
                  to={pillar.to}
                  className="block h-full rounded-2xl glass-panel p-5 transition-colors hover:border-primary/40"
                >
                  <span className="text-sm text-foreground">{pillar.label}</span>
                  <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">
                    {pillar.note}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
