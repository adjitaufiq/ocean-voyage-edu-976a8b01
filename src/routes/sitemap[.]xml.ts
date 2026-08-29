import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { buildLogs } from "@/lib/seo/build-log";
import { articles } from "@/lib/seo/insights";
import { productDocs } from "@/lib/seo/products";

const BASE_URL = "https://kerjaku.space";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          {
            path: "/jasa-pembuatan-website-aplikasi-landing-page",
            changefreq: "monthly",
            priority: "0.9",
          },
          { path: "/jasa-pembuatan-aplikasi-custom", changefreq: "monthly", priority: "0.9" },
          { path: "/jasa-ai-automation-bisnis", changefreq: "monthly", priority: "0.9" },
          { path: "/jasa-dashboard-bisnis", changefreq: "monthly", priority: "0.9" },
          { path: "/cara-kerjaku-menggunakan-ai", changefreq: "monthly", priority: "0.8" },
          { path: "/products", changefreq: "monthly", priority: "0.7" },
          ...productDocs.map((product) => ({
            path: product.path,
            changefreq: "monthly" as const,
            priority: "0.7",
          })),
          { path: "/build", changefreq: "weekly", priority: "0.8" },
          ...buildLogs.map((log) => ({
            path: log.path,
            lastmod: log.dateModified,
            changefreq: "monthly" as const,
            priority: "0.7",
          })),
          { path: "/insight", changefreq: "weekly", priority: "0.7" },
          ...articles.map((article) => ({
            path: article.path,
            lastmod: article.dateModified,
            changefreq: "monthly" as const,
            priority: "0.6",
          })),
          { path: "/privacy-policy", changefreq: "yearly", priority: "0.3" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
        ];



        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
