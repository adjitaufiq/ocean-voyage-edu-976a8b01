import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { initAnalytics, trackPageView } from "@/lib/analytics";
import { initLeadJourney } from "@/lib/lead-journey";
import { supabase } from "@/integrations/supabase/client";
import { syncStoredSession } from "@/lib/auth/biometric-unlock";



function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

const SITE_TITLE = "KERJAKU | Digital Product Studio - Website, Aplikasi & AI Solution";
const SITE_DESCRIPTION =
  "KERJAKU membangun website, aplikasi custom, dashboard bisnis, automation, dan solusi AI untuk membantu bisnis bekerja lebih efektif.";
const SITE_LOGO = "https://kerjaku.space/logo.webp";

const siteGraph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ProfessionalService",
      "@id": "https://kerjaku.space/#organization",
      name: "KERJAKU",
      url: "https://kerjaku.space",
      logo: { "@type": "ImageObject", url: SITE_LOGO },
      description:
        "KERJAKU adalah digital product studio yang membangun website, aplikasi custom, dashboard bisnis, automation, dan solusi AI untuk menyelesaikan masalah kerja nyata.",
      email: "admin.kerjaku@gmail.com",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Jakarta",
        addressCountry: "Indonesia",
      },
      founder: { "@id": "https://kerjaku.space/#founder" },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "5.0",
        reviewCount: "5",
        bestRating: "5",
        worstRating: "1",
      },
      sameAs: [
        "https://maps.app.goo.gl/H6JTQU6GLQgd28zT9",
        "https://www.instagram.com/kerjaku.space",
        "https://github.com/kerjaku-space",
      ],
    },
    {
      "@type": "Person",
      "@id": "https://kerjaku.space/#founder",
      name: "Adji Taufiq",
      jobTitle: "Founder & Digital Product Builder",
      worksFor: { "@id": "https://kerjaku.space/#organization" },
      sameAs: [
        "https://www.linkedin.com/in/adji-taufiq-0713aa42a",
        "https://github.com/adjitaufiq",
      ],
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://kerjaku.space/#ro-memory",
      name: "RO Memory",
      url: "https://demo-ro-memory.kerjaku.space/auth",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "RO Memory adalah Field Activity Intelligence System yang membantu bisnis mengelola aktivitas lapangan, monitoring operasional, database, dan analisis performa.",
      author: { "@id": "https://kerjaku.space/#organization" },
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://kerjaku.space/#qresto",
      name: "QResto",
      url: "https://qresto.kerjaku.space/",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "QResto adalah solusi digital restaurant management yang membantu bisnis kuliner meningkatkan proses pemesanan dan operasional layanan.",
      author: { "@id": "https://kerjaku.space/#organization" },
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://kerjaku.space/#dompet-gue",
      name: "Dompet Gue",
      url: "https://dompetgue.kerjaku.space/",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      description:
        "Dompet Gue adalah aplikasi digital untuk membantu pengguna melakukan pencatatan, pengelolaan, dan monitoring keuangan secara lebih mudah.",
      author: { "@id": "https://kerjaku.space/#organization" },
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://kerjaku.space/#material-estimator",
      name: "Material Estimator",
      url: "https://kerjaku.space/",
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Web",
      description:
        "Material Estimator adalah sistem digital untuk membantu estimasi kebutuhan material secara cepat, akurat, dan terstruktur.",
      author: { "@id": "https://kerjaku.space/#organization" },
    },
    {
      "@type": "FAQPage",
      "@id": "https://kerjaku.space/#faq",
      mainEntity: [
        {
          "@type": "Question",
          name: "Berapa biaya pembuatan website di KERJAKU?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Biaya pembuatan website di KERJAKU menyesuaikan kebutuhan dan kompleksitas project. KERJAKU menyediakan solusi mulai dari website sederhana, website bisnis profesional, hingga aplikasi custom dengan fitur yang dapat disesuaikan dengan kebutuhan client.",
          },
        },
        {
          "@type": "Question",
          name: "Apakah KERJAKU menerima pembuatan website custom?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Ya, KERJAKU melayani pengembangan sistem dan aplikasi custom sesuai kebutuhan spesifik klien.",
          },
        },
        {
          "@type": "Question",
          name: "Apakah domain dan hosting sudah termasuk?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Ya, paket pembuatan website/aplikasi dapat disesuaikan termasuk opsi domain, hosting, dan pengurusan teknis.",
          },
        },
        {
          "@type": "Question",
          name: "Berapa lama proses pembuatan website?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Waktu pengerjaan bervariasi tergantung skala project, umumnya berkisar dari beberapa hari hingga beberapa minggu.",
          },
        },
      ],
    },
  ],
};

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESCRIPTION },
      { name: "author", content: "KERJAKU" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "KERJAKU" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,500;6..96,600&family=Outfit:wght@600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&display=swap",
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(siteGraph),
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});


function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    initAnalytics();
    initLeadJourney(window.location.pathname);
    return router.subscribe("onResolved", ({ toLocation }) => {
      trackPageView(toLocation.pathname);
    });
  }, [router]);

  // Keeps the device quick-unlock snapshot in sync with rotated refresh tokens.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "TOKEN_REFRESHED" && event !== "INITIAL_SESSION")
        return;
      if (!session?.refresh_token) return;
      void syncStoredSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    });
    return () => data.subscription.unsubscribe();
  }, []);



  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
