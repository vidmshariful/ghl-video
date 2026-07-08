import { Hero } from "@/components/home/Hero";
import { TrustStrip } from "@/components/home/TrustStrip";
import { ServicePanels } from "@/components/home/ServicePanels";
import { Manifesto } from "@/components/home/Manifesto";
import { ShowreelMoment } from "@/components/home/ShowreelMoment";
import { Comparison } from "@/components/home/Comparison";
import { TeamSection } from "@/components/home/TeamSection";
import { Testimonials } from "@/components/home/Testimonials";
import { Faq } from "@/components/home/Faq";
import { FounderNote } from "@/components/home/FounderNote";
import { ClosingCta } from "@/components/home/ClosingCta";

export default function Home() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <ServicePanels />
      <Manifesto />
      <ShowreelMoment />
      <Comparison />
      <TeamSection />
      <Testimonials />
      <Faq />
      <FounderNote />
      <ClosingCta />
    </>
  );
}
