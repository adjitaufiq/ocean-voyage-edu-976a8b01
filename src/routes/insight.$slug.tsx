import { createFileRoute, notFound } from "@tanstack/react-router";

import { DocPage } from "@/components/kerjaku/marketing/DocPage";
import { buildDocHead } from "@/lib/seo/head";
import { getArticle } from "@/lib/seo/insights";
import { SITE_URL } from "@/lib/seo/types";

export const Route = createFileRoute("/insight/$slug")({
  loader: ({ params }) => {
    const article = getArticle(params.slug);
    if (!article) throw notFound();
    return { slug: article.slug };
  },
  head: ({ params }) => {
    const article = getArticle(params.slug);
    if (!article) {
      return {
        meta: [{ title: "Artikel tidak ditemukan — KERJAKU" }, { name: "robots", content: "noindex" }],
      };
    }
    return buildDocHead(article, {
      ogType: "article",
      extraSchemas: [
        {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: article.h1,
          description: article.summary,
          datePublished: article.datePublished,
          dateModified: article.dateModified,
          inLanguage: "id-ID",
          mainEntityOfPage: `${SITE_URL}${article.path}`,
          author: { "@id": `${SITE_URL}/#organization` },
          publisher: { "@id": `${SITE_URL}/#organization` },
        },
      ],
    });
  },
  notFoundComponent: ArticleNotFound,
  component: ArticleDetail,
});

function ArticleNotFound() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-28 text-center">
      <h1 className="font-display text-3xl">Artikel tidak ditemukan</h1>
      <p className="mt-4 text-sm text-muted-foreground">Silakan kembali ke halaman Insight KERJAKU.</p>
    </main>
  );
}

function ArticleDetail() {
  const { slug } = Route.useParams();
  const article = getArticle(slug);
  if (!article) return <ArticleNotFound />;
  return <DocPage doc={article} />;
}
