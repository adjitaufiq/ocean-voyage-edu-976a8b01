import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/kerjaku/SiteFooter";

const title = "Kebijakan Privasi (Privacy Policy) — KERJAKU";
const description =
  "Kebijakan privasi KERJAKU: informasi yang dikumpulkan, penggunaan data, perlindungan data, dan ketentuan data demo produk.";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kerjaku.space/privacy-policy" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://kerjaku.space/privacy-policy" }],
  }),
  component: PrivacyPolicyPage,
});

function Card({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] glass-panel p-6 sm:p-8">
      <h2 className="font-display text-xl leading-snug sm:text-2xl">{heading}</h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-5 pb-16 pt-24 sm:px-8">
        <Link
          to="/"
          className="text-[11px] uppercase tracking-[0.35em] text-primary/90 hover:text-primary"
        >
          ← Kembali ke beranda
        </Link>
        <h1 className="mt-6 font-display text-[clamp(2rem,5vw,3rem)] leading-tight">
          Kebijakan Privasi (Privacy Policy) — KERJAKU
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
          Selamat datang di KERJAKU (https://kerjaku.space). KERJAKU menghargai privasi pengguna dan
          berkomitmen melindungi informasi yang diberikan melalui website dan layanan digital kami.
        </p>

        <div className="mt-10 space-y-5">
          <Card heading="Informasi yang Kami Kumpulkan">
            <ul className="list-disc space-y-1 pl-5">
              <li>Nama lengkap</li>
              <li>Email</li>
              <li>Nomor WhatsApp</li>
              <li>Informasi bisnis</li>
              <li>Informasi kebutuhan proyek</li>
            </ul>
          </Card>

          <Card heading="Penggunaan Informasi">
            <ul className="list-disc space-y-1 pl-5">
              <li>Komunikasi proyek</li>
              <li>Konsultasi layanan</li>
              <li>Pengembangan layanan</li>
              <li>Keamanan sistem</li>
            </ul>
          </Card>

          <Card heading="Perlindungan Data">
            <p>KERJAKU menerapkan langkah keamanan untuk menjaga data pengguna.</p>
            <p>
              KERJAKU tidak menjual atau membagikan data pribadi kepada pihak ketiga tanpa izin.
            </p>
          </Card>

          <Card heading="Data Demo Produk">
            <p>
              Produk demo KERJAKU seperti RO Memory, QResto, dan Dompet Gue menggunakan data
              simulasi. Data demo bukan data produksi pelanggan dan hanya digunakan untuk evaluasi
              fitur.
            </p>
          </Card>

          <Card heading="Kontak Resmi">
            <ul className="space-y-1">
              <li>Email: admin.kerjaku@gmail.com</li>
              <li>Founder: Adji Taufiq</li>
              <li>
                LinkedIn:{" "}
                <a
                  href="https://www.linkedin.com/in/adji-taufiq-0713aa42a"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  adji-taufiq
                </a>
              </li>
              <li>
                GitHub Studio:{" "}
                <a
                  href="https://github.com/kerjaku-space"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  github.com/kerjaku-space
                </a>
              </li>
            </ul>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
