import { analytics } from "@/lib/analytics";
import { finalCta } from "@/lib/site-content";
import { ctaLabels } from "@/lib/consultation-content";
import { useJourney } from "../JourneyProvider";
import { OceanButton } from "../OceanButton";
import { Reveal } from "../Reveal";
import { SiteFooter } from "../SiteFooter";

export function FinalStage() {
  const { scrollTo } = useJourney();

  return (
    <>
      <section
        id="final"
        className="relative flex min-h-[90svh] flex-col items-center justify-center px-5 py-28 text-center sm:px-8"
      >
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.42em] text-primary/90">
              {finalCta.eyebrow}
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="mt-6 text-balance font-display text-[clamp(2.4rem,7vw,5rem)] leading-[1.02]">
              {finalCta.title}
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
              {finalCta.body}
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <OceanButton
                className="w-full sm:w-auto"
                onClick={() => {
                  analytics.consultationButtonClick("final", ctaLabels.primary);
                  scrollTo("konsultasi");
                }}
              >
                {ctaLabels.primary}
              </OceanButton>
              <OceanButton
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => scrollTo("layanan")}
              >
                {ctaLabels.secondary}
              </OceanButton>
            </div>
          </Reveal>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
