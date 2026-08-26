import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/kerjaku/SiteFooter";

const title = "Ketentuan Layanan (Terms of Service) — KERJAKU";
const description =
  "Ketentuan layanan KERJAKU: hak kekayaan intelektual, ketentuan penggunaan live demo, dan batasan tanggung jawab.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kerjaku.space/terms" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://kerjaku.space/terms" }],
  }),
  component: TermsPage,
});

function Card({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] glass-panel p-6 sm:p-8">
      <h2 className="font-display text-xl leading-snug sm:text-2xl">{heading}</h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function TermsPage() {
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
          Ketentuan Layanan (Terms of Service) — KERJAKU
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
          Dengan mengakses website, layanan, dan produk demo KERJAKU, pengguna menyetujui ketentuan
          layanan ini.
        </p>

        <div className="mt-10 space-y-5">
          <Card heading="Hak Kekayaan Intelektual">
            <p>
              Seluruh desain UI/UX, sistem aplikasi, arsitektur software, kode, dan konten digital
              pada KERJAKU (termasuk RO Memory, QResto, Dompet Gue, Material Estimator) merupakan
              aset milik KERJAKU.
            </p>
          </Card>

          <Card heading="Ketentuan Live Demo">
            <p>
              KERJAKU menyediakan akun demo hanya untuk presentasi, evaluasi fitur, dan pengenalan
              sistem.
            </p>
            <p>Seluruh data pada demo merupakan data simulasi.</p>
            <p>KERJAKU berhak melakukan reset atau maintenance akses demo.</p>
          </Card>

          <Card heading="Batasan Tanggung Jawab">
            <p>
              KERJAKU tidak bertanggung jawab atas penyalahgunaan sistem demo oleh pihak eksternal
              di luar kendali KERJAKU.
            </p>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
