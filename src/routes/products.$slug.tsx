import { createFileRoute, notFound } from "@tanstack/react-router";

import { DocPage } from "@/components/kerjaku/marketing/DocPage";
import { buildDocHead } from "@/lib/seo/head";
import { getProduct } from "@/lib/seo/products";
import { SITE_URL } from "@/lib/seo/types";

export const Route = createFileRoute("/products/$slug")({
  loader: ({ params }) => {
    const product = getProduct(params.slug);
    if (!product) throw notFound();
    return { slug: product.slug };
  },
  head: ({ params }) => {
    const product = getProduct(params.slug);
    if (!product) {
      return { meta: [{ title: "Produk tidak ditemukan — KERJAKU" }, { name: "robots", content: "noindex" }] };
    }
    return buildDocHead(product, {
      extraSchemas: [
        {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: product.productName,
          applicationCategory: product.applicationCategory,
          description: product.description,
          url: `${SITE_URL}${product.path}`,
          operatingSystem: "Web",
          author: { "@id": `${SITE_URL}/#organization` },
        },
      ],
    });
  },
  notFoundComponent: ProductNotFound,
  component: ProductDetail,
});

function ProductNotFound() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-28 text-center">
      <h1 className="font-display text-3xl">Produk tidak ditemukan</h1>
      <p className="mt-4 text-sm text-muted-foreground">Silakan kembali ke daftar produk KERJAKU.</p>
    </main>
  );
}

function ProductDetail() {
  const { slug } = Route.useParams();
  const product = getProduct(slug);
  if (!product) return <ProductNotFound />;
  return <DocPage doc={product} />;
}
