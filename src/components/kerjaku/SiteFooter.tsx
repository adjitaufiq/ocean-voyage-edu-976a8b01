import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-border px-5 py-8 text-xs text-muted-foreground sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <p>© KERJAKU — Digital Product Studio</p>
        <nav className="flex flex-wrap items-center justify-center gap-4" aria-label="Legal">
          <Link to="/privacy-policy" className="transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
          <Link to="/terms" className="transition-colors hover:text-foreground">
            Terms of Service
          </Link>
        </nav>
        <p>Jakarta, Indonesia</p>
      </div>
    </footer>
  );
}
