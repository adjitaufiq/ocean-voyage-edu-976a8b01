import { createFileRoute, Link } from "@tanstack/react-router";

import { DocPage } from "@/components/kerjaku/marketing/DocPage";
import { buildDocHead } from "@/lib/seo/head";
import { productDocs } from "@/lib/seo/products";
import type { DocPageContent } from "@/lib/seo/types";

const doc: DocPageContent = {
  path: "/products",
  breadcrumb: [
    { name: "Beranda", path: "/" },
    { name: "Produk", path: "/products" },
  ],
  eyebrow: "PRODUK KERJAKU",
  h1: "Produk Digital yang Dibangun KERJAKU",
  title: "Produk Digital KERJAKU — Aplikasi & Sistem Buatan Sendiri",
  description:
    "Daftar produk digital yang dibangun KERJAKU: RO MEMORY, QResto, DOMPET GUE, dan MATERIAL ESTIMATOR — beserta masalah nyata yang diselesaikan.",
  intro:
    "Setiap produk di bawah ini dibangun untuk menyelesaikan masalah operasional nyata. Halaman produk menjelaskan konteks masalah, cara kerja sistem, dan catatan engineering di baliknya.",
  answer:
    "KERJAKU membangun produk digital sendiri — RO MEMORY, QResto, DOMPET GUE, dan MATERIAL ESTIMATOR — sebagai bukti praktik membangun aplikasi custom, dashboard, dan otomasi berbasis AI.",
  sections: [],
  cta: {
    title: "Butuh sistem serupa untuk bisnis Anda?",
    body: "Ceritakan alur kerja dan hambatan operasional Anda. AI Consultant KERJAKU akan membantu memetakan kebutuhan sebelum masuk ke tahap proposal.",
    button: "Mulai konsultasi",
  },
};

export const Route = createFileRoute("/products/")({
  head: () => buildDocHead(doc),
  component: ProductsIndex,
});

function ProductsIndex() {
  return (
    <DocPage doc={doc}>
      <section className="mt-14" aria-labelledby="daftar-produk">
        <h2 id="daftar-produk" className="font-display text-[clamp(1.5rem,4vw,2.2rem)] leading-tight">
          Daftar produk
        </h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {productDocs.map((product) => (
            <Link
              key={product.slug}
              to="/products/$slug"
              params={{ slug: product.slug }}
              className="rounded-[1.75rem] glass-panel p-6 transition-colors hover:border-primary/50"
            >
              <span className="text-[10px] uppercase tracking-[0.28em] text-primary">
                {product.status}
              </span>
              <h3 className="mt-3 font-display text-lg leading-tight">{product.productName}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </DocPage>
  );
}
