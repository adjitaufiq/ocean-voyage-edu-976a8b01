/**
 * Shared content model for KERJAKU's SEO/GEO marketing pages.
 * Content is data-driven so every page renders with the same semantic
 * structure (h1 → h2 sections → FAQ → CTA) and consistent schema.
 */
import type { LinkProps } from "@tanstack/react-router";

export type InternalPath = LinkProps["to"];

export type Block =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "cards"; items: { title: string; body: string }[] }
  | { kind: "steps"; items: { title: string; body: string }[] };

export type Section = {
  id: string;
  heading: string;
  blocks: Block[];
};

export type RelatedLink = {
  to: InternalPath;
  label: string;
  note?: string;
};

export type DocPageContent = {
  /** Absolute path of the page, used for canonical, og:url and breadcrumbs. */
  path: string;
  breadcrumb: { name: string; path: string }[];
  eyebrow: string;
  h1: string;
  title: string;
  description: string;
  intro: string;
  /** Short factual answer placed directly under the intro (AI search friendly). */
  answer?: string;
  sections: Section[];
  faq?: { q: string; a: string }[];
  related?: RelatedLink[];
  cta: { title: string; body: string; button: string };
};

export type ArticleContent = DocPageContent & {
  slug: string;
  datePublished: string;
  dateModified: string;
  summary: string;
};

export type ProductContent = DocPageContent & {
  slug: string;
  productName: string;
  applicationCategory: string;
  status: "LIVE" | "IN DEVELOPMENT";
  externalUrl?: string;
};

export const SITE_URL = "https://kerjaku.space";
