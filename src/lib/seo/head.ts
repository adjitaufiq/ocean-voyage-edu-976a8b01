/** Head/meta + JSON-LD builders shared by KERJAKU marketing pages. */
import { SITE_URL, type DocPageContent } from "./types";

const OG_IMAGE = `${SITE_URL}/og-image.png`;

export function breadcrumbSchema(doc: DocPageContent) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: doc.breadcrumb.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function faqSchema(doc: DocPageContent) {
  if (!doc.faq?.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: doc.faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function serviceSchema(doc: DocPageContent, serviceType: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: doc.h1,
    serviceType,
    description: doc.description,
    url: `${SITE_URL}${doc.path}`,
    areaServed: "ID",
    provider: { "@id": `${SITE_URL}/#organization` },
  };
}

type HeadOptions = {
  ogType?: "website" | "article";
  extraSchemas?: (object | null)[];
};

export function buildDocHead(doc: DocPageContent, options: HeadOptions = {}) {
  const url = `${SITE_URL}${doc.path}`;
  const schemas = [breadcrumbSchema(doc), faqSchema(doc), ...(options.extraSchemas ?? [])].filter(
    Boolean,
  ) as object[];

  return {
    meta: [
      { title: doc.title },
      { name: "description", content: doc.description },
      { name: "author", content: "KERJAKU" },
      { name: "language", content: "id-ID" },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: doc.title },
      { property: "og:description", content: doc.description },
      { property: "og:type", content: options.ogType ?? "website" },
      { property: "og:site_name", content: "KERJAKU" },
      { property: "og:locale", content: "id_ID" },
      { property: "og:url", content: url },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: doc.title },
      { name: "twitter:description", content: doc.description },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: schemas.map((schema) => ({
      type: "application/ld+json",
      children: JSON.stringify(schema),
    })),
  };
}
