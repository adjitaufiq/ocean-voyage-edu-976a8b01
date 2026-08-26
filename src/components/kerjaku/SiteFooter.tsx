import { Link } from "@tanstack/react-router";

const SOCIAL_LINKS = [
  { label: "LinkedIn", href: "https://www.linkedin.com/in/adji-taufiq-0713aa42a" },
  { label: "GitHub", href: "https://github.com/kerjaku-space" },
] as const;

const linkClass =
  "transition-colors hover:text-white hover:underline underline-offset-4";

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-border px-5 py-8 text-xs text-muted-foreground sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 text-center">
        {/* Baris 1 — Brand */}
        <p className="text-zinc-400">© KERJAKU — Digital Product Studio</p>

        {/* Baris 2 — Legal navigation */}
        <nav
          className="flex flex-wrap items-center justify-center gap-2 text-zinc-400"
          aria-label="Legal"
        >
          <Link to="/privacy-policy" className={linkClass}>
            Privacy Policy
          </Link>
          <span className="text-zinc-600">•</span>
          <Link to="/terms" className={linkClass}>
            Terms of Service
          </Link>
        </nav>

        {/* Baris 3 — Trust links & location */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-zinc-400">
          <a
            href="https://maps.app.goo.gl/H6JTQU6GLQgd28zT9"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            📍 Jakarta, Indonesia
          </a>
          <span className="text-zinc-600">|</span>
          {SOCIAL_LINKS.map((link, i) => (
            <span key={link.href} className="inline-flex items-center gap-2">
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {link.label}
              </a>
              {i < SOCIAL_LINKS.length - 1 && (
                <span className="text-zinc-600">•</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}
