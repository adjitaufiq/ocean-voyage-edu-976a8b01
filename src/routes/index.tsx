import { createFileRoute } from "@tanstack/react-router";
import { faqSection } from "@/lib/consultation-content";
import { JourneyProvider } from "@/components/kerjaku/JourneyProvider";
import { JourneyPanels } from "@/components/kerjaku/JourneyPanels";
import { OceanScene } from "@/components/kerjaku/OceanScene";
import { SiteNav } from "@/components/kerjaku/SiteNav";
import { SectionJourneyTracker } from "@/components/kerjaku/SectionJourneyTracker";
import { SmoothScrollProvider } from "@/components/kerjaku/SmoothScrollProvider";
import { ScrollTopOnLoad } from "@/components/kerjaku/ScrollTopOnLoad";
import { HeroStage } from "@/components/kerjaku/stages/HeroStage";
import { PastelStage } from "@/components/kerjaku/stages/PastelStage";
import { ShowcaseStage } from "@/components/kerjaku/stages/ShowcaseStage";
import { ProductsStage } from "@/components/kerjaku/stages/ProductsStage";
import { PortfolioCaseStudyStage } from "@/components/kerjaku/stages/PortfolioCaseStudyStage";
import { PortfolioCtaStage } from "@/components/kerjaku/stages/PortfolioCtaStage";
import { ProfileStage } from "@/components/kerjaku/stages/ProfileStage";
import { ServiceEntryStage } from "@/components/kerjaku/stages/ServiceEntryStage";

import { AboutStage } from "@/components/kerjaku/stages/AboutStage";
import { ProcessStage } from "@/components/kerjaku/stages/ProcessStage";
import { TrustCtaStage } from "@/components/kerjaku/stages/TrustCtaStage";
import { TrustReasonsStage } from "@/components/kerjaku/stages/TrustReasonsStage";
import { ServicesStage } from "@/components/kerjaku/stages/ServicesStage";
import { ServicePackageStage } from "@/components/kerjaku/stages/ServicePackageStage";
import { FaqStage } from "@/components/kerjaku/stages/FaqStage";
import { WhyStage } from "@/components/kerjaku/stages/WhyStage";
import { ConsultationStage } from "@/components/kerjaku/stages/ConsultationStage";
import { AiConsultantStage } from "@/components/kerjaku/stages/AiConsultantStage";
import { AiConsultantFab } from "@/components/kerjaku/AiConsultantFab";
import { FinalStage } from "@/components/kerjaku/stages/FinalStage";


const title = "KERJAKU | Digital Product Studio - Website, Aplikasi & AI Solution";
const description =
  "KERJAKU membangun website, aplikasi custom, dashboard bisnis, automation, dan solusi AI untuk membantu bisnis bekerja lebih efektif.";
const keywords =
  "digital solution studio, jasa pembuatan website, custom business system, business automation, AI solutions, web application, dashboard bisnis, workflow automation";
const ogImage = "https://kerjaku.space/logo.webp";
const socialTitle = title;
const socialDescription = description;


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "keywords", content: keywords },
      { name: "author", content: "KERJAKU" },
      { name: "language", content: "id-ID" },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: socialTitle },
      { property: "og:description", content: socialDescription },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "KERJAKU" },
      { property: "og:locale", content: "id_ID" },
      { property: "og:url", content: "https://kerjaku.space/" },
      { property: "og:image", content: ogImage },
      { property: "og:image:secure_url", content: ogImage },
      { property: "og:image:type", content: "image/webp" },
      {
        property: "og:image:alt",
        content: "KERJAKU — Custom digital solutions, AI automation & business system development",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: socialTitle },
      { name: "twitter:description", content: socialDescription },
      { name: "twitter:image", content: ogImage },
      {
        name: "twitter:image:alt",
        content: "KERJAKU — Custom digital solutions, AI automation & business system development",
      },
    ],
    links: [{ rel: "canonical", href: "https://kerjaku.space/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          "@id": "https://kerjaku.space/#website",
          name: "KERJAKU",
          url: "https://kerjaku.space/",
          description,
          inLanguage: "id-ID",
          publisher: { "@id": "https://kerjaku.space/#organization" },
        }),
      },
    ],

  }),
  component: Index,
});

function Index() {
  return (
    <JourneyProvider>
      <ScrollTopOnLoad />
      <SmoothScrollProvider />
      <OceanScene />
      <SiteNav />
      <SectionJourneyTracker />
      <main className="relative z-10">
        <HeroStage />
        <PastelStage />
        <ShowcaseStage />
        <ProductsStage />
        <PortfolioCaseStudyStage />
        <PortfolioCtaStage />
        <ProfileStage />
        <ServiceEntryStage />
        
        <AboutStage />
        <ServicesStage />
        <ServicePackageStage />
        <ProcessStage />
        <WhyStage />
        <FaqStage />

        <TrustCtaStage />
        <TrustReasonsStage />
        <AiConsultantStage />
        <ConsultationStage />
        <FinalStage />
      </main>
      <AiConsultantFab />
      <JourneyPanels />
    </JourneyProvider>
  );
}
