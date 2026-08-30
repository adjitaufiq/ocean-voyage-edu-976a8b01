/** Shared helper for KERJAKU Insight articles. */
import type { ArticleContent } from "./types";

export const PUBLISHED_V1 = "2026-08-29";
export const PUBLISHED_V2 = "2026-08-30";
export const PUBLISHED_V3 = "2026-08-30";

export const defaultCta = {
  title: "Punya kondisi serupa di bisnis Anda?",
  body: "Ceritakan alur kerja yang sedang berjalan ke AI Consultant KERJAKU. Kebutuhannya akan digali langkah demi langkah dan dirangkum menjadi order brief yang bisa ditinjau bersama.",
  button: "Mulai konsultasi",
};

export const base = (
  a: Omit<ArticleContent, "datePublished" | "dateModified" | "cta" | "breadcrumb"> & {
    cta?: ArticleContent["cta"];
    datePublished?: string;
  },
) =>
  ({
    ...a,
    datePublished: a.datePublished ?? PUBLISHED_V1,
    dateModified: a.datePublished ?? PUBLISHED_V1,
    cta: a.cta ?? defaultCta,
    breadcrumb: [
      { name: "Beranda", path: "/" },
      { name: "Insight", path: "/insight" },
      { name: a.h1, path: a.path },
    ],
  }) satisfies ArticleContent;
