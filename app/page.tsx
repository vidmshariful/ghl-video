import { Hero } from "@/components/home/Hero";
import { TrustStrip } from "@/components/home/TrustStrip";
import { ServicePanels } from "@/components/home/ServicePanels";
import { Manifesto } from "@/components/home/Manifesto";
import { ShowreelMoment } from "@/components/home/ShowreelMoment";
import { ClientWall } from "@/components/home/ClientWall";
import { Comparison } from "@/components/home/Comparison";
import { TeamSection } from "@/components/home/TeamSection";
import { VideoTestimonials } from "@/components/home/VideoTestimonials";
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
      <ClientWall />
      {/* hybrid theme: proof-and-people band reads on paper; heroes
          and the footer stay dark (client hard rule) */}
      <div className="theme-light">
        <Comparison />
      </div>
      <VideoTestimonials />
      <div className="theme-light">
        <Testimonials />
        <TeamSection />
        <Faq />
      </div>
      <FounderNote />
      <ClosingCta />
    </>
  );
}
