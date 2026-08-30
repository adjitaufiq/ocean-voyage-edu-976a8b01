/**
 * GA4 tracking for kerjaku.space.
 *
 * Measurement ID resolution order (all environment-driven, no OAuth involved):
 *   1. VITE_GA4_MEASUREMENT_ID           (explicit override)
 *   2. VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY (synced connector value)
 *   3. GA4_MEASUREMENT_ID fallback constant below
 *
 * The measurement ID is a public identifier; no private Google credential is
 * ever shipped to the browser. Analytics Data API access (if any) stays fully
 * server-side and is unrelated to this file.
 */

import {
  scoreAction,
  trackCtaClick,
  trackJourneyPage,
  trackJourneyStep,
  trackPackageSelect,
  trackProductView,
} from "./lead-journey";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA4_MEASUREMENT_ID = "G-CVZRFL7G6L";

const measurementId =
  (import.meta.env["VITE_GA4_MEASUREMENT_ID"] as string | undefined) ||
  (import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY"] as string | undefined) ||
  GA4_MEASUREMENT_ID;

const PRODUCTION_HOSTS = new Set(["kerjaku.space", "www.kerjaku.space"]);

function isProductionHost() {
  return typeof window !== "undefined" && PRODUCTION_HOSTS.has(window.location.hostname);
}

/** Non-production traffic is tagged so it can be filtered out inside GA4. */
function environmentParams() {
  return isProductionHost()
    ? { traffic_type: "production" }
    : { traffic_type: "internal", debug_mode: true };
}

let initialized = false;
let lastPath: string | null = null;
const firedOnce = new Set<string>();

function once(key: string) {
  if (firedOnce.has(key)) return false;
  firedOnce.add(key);
  return true;
}

export function initAnalytics() {
  if (typeof window === "undefined" || initialized || !measurementId) return;
  initialized = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  // gtag.js only processes commands pushed as the native `arguments` object;
  // pushing a plain array is silently ignored and nothing is ever sent.
  function gtag(..._args: unknown[]) {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  }
  window.gtag = gtag;
  window.gtag("js", new Date());
  // Manual page views only: the SPA router owns every page_view so nothing is
  // counted twice on the first render or on client-side navigation.
  window.gtag("config", measurementId, {
    send_page_view: false,
    ...environmentParams(),
  });

  trackPageView(window.location.pathname);
  installOutboundClickTracking();
}

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.gtag?.("event", name, { ...environmentParams(), ...params });
}

export function trackPageView(path: string) {
  if (path === lastPath) return;
  lastPath = path;
  trackEvent("page_view", {
    page_path: path,
    page_location: typeof window !== "undefined" ? window.location.href : path,
    page_title: typeof document !== "undefined" ? document.title : undefined,
  });
  trackJourneyPage(path);
}

let outboundInstalled = false;

/** Tracks clicks on links leaving the site (demos, social, maps, docs). */
function installOutboundClickTracking() {
  if (outboundInstalled || typeof document === "undefined") return;
  outboundInstalled = true;

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      if (href.startsWith("mailto:") || href.startsWith("tel:")) {
        trackEvent("outbound_click", { link_url: href, link_domain: href.split(":")[0] });
        return;
      }
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.hostname === window.location.hostname) return;
      trackEvent("outbound_click", {
        link_url: url.href,
        link_domain: url.hostname,
        link_text: (anchor.textContent ?? "").trim().slice(0, 100),
        outbound: true,
      });
    },
    { capture: true },
  );
}

/** Conversion-prep events */
export const analytics = {
  consultationButtonClick: (location: string, label: string) => {
    trackEvent("consultation_button_click", { cta_location: location, cta_label: label });
    trackEvent("consultation_click", { cta_location: location, cta_label: label });
    trackCtaClick(location, label);
  },
  serviceCtaClick: (service: string, label: string) => {
    trackEvent("service_cta_click", { service_name: service, cta_label: label });
  },
  insightToServiceClick: (article: string, destination: string) => {
    trackEvent("insight_to_service_click", { article_slug: article, destination });
  },
  buildLogView: (slug: string) => {
    if (!once(`build_log_view:${slug}`)) return;
    trackEvent("build_log_view", { build_slug: slug });
  },
  liveDemoClick: (product: string, url?: string) => {
    trackEvent("live_demo_click", { product_name: product, demo_url: url ?? "" });
  },
  leadCreated: (params: { source: string; lead_score?: number; lead_temperature?: string }) => {
    if (!once(`lead_created:${params.source}:${params.lead_score ?? ""}`)) return;
    trackEvent("lead_created", params);
  },
  portfolioProjectClick: (project: string, url?: string) => {
    trackEvent("portfolio_project_click", { project_name: project, project_url: url ?? "" });
    trackProductView(project);
  },
  servicePackageClick: (pkg: string) => {
    trackEvent("service_package_click", { package_name: pkg });
    trackEvent("service_cta_click", { service_name: pkg, cta_label: "package" });
    trackPackageSelect(pkg);
  },
  consultationFormOpen: () => {
    trackEvent("consultation_form_open", {});
    scoreAction("open_consultation_form");
    trackJourneyStep("form:open");
  },
  sectionView: (section: string) => trackJourneyStep(`section:${section}`),
  aiConsultationStart: (source: string) => {
    if (!once(`ai_start:${source}`)) return;
    trackEvent("ai_conversation_start", { source });
    trackEvent("ai_consultant_start", { source });
    trackJourneyStep(`ai:start:${source}`);
  },
  aiConsultationStep: (step: string, answer: string) => {
    trackEvent("ai_conversation_step", { step, answer });
    trackJourneyStep(`ai:step:${step}`);
  },
  aiConsultationComplete: (params: {
    recommended_package: string;
    business_category: string;
    complexity: string;
    ai_score: number;
    qualification: string;
  }) => {
    if (!once(`ai_complete:${params.recommended_package}:${params.ai_score}`)) return;
    trackEvent("ai_conversation_complete", params);
    trackEvent("ai_consultant_complete", params);
    trackJourneyStep(`ai:complete:${params.recommended_package}`);
  },
  aiPreviewView: (params: { recommended_package: string; ai_score: number }) => {
    trackEvent("ai_preview_view", params);
    trackJourneyStep(`ai:preview:${params.recommended_package}`);
  },
  aiContactSubmit: (params: { recommended_package: string; ai_score: number }) => {
    trackEvent("ai_contact_submit", params);
    trackJourneyStep("ai:contact_submit");
  },
  aiConsultationConversion: (params: {
    recommended_package: string;
    ai_score: number;
    qualification: string;
  }) => {
    trackEvent("ai_consultation_conversion", params);
    trackEvent("lead_created", { source: "ai_consultant", lead_score: params.ai_score });
    scoreAction("submit_consultation_form");
    trackJourneyStep("ai:conversion");
  },
  aiToConsultation: (recommendedPackage: string) => {
    trackEvent("ai_to_consultation_click", { recommended_package: recommendedPackage });
    trackJourneyStep(`ai:to_consultation:${recommendedPackage}`);
  },
  consultationFormSubmit: (params: {
    project_type: string;
    budget: string;
    timeline: string;
    lead_score?: number;
    lead_temperature?: string;
  }) => {
    trackEvent("consultation_form_submit", params);
    trackEvent("lead_created", {
      source: "consultation_form",
      lead_score: params.lead_score,
      lead_temperature: params.lead_temperature,
    });
    scoreAction("submit_consultation_form");
    trackJourneyStep("form:submit");
  },
};
