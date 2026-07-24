import { Hero } from "@/components/home/Hero";
import { TrustStrip } from "@/components/home/TrustStrip";
import { ServicePanels } from "@/components/home/ServicePanels";
import { Manifesto } from "@/components/home/Manifesto";
import { ShowreelMoment } from "@/components/home/ShowreelMoment";
import { ClientWall } from "@/components/home/ClientWall";
import { Comparison } from "@/components/home/Comparison";
import { AudienceSplit } from "@/components/home/AudienceSplit";
import { VideoTestimonials } from "@/components/home/VideoTestimonials";
import { Testimonials } from "@/components/home/Testimonials";
import { Faq } from "@/components/home/Faq";
import { FounderNote } from "@/components/home/FounderNote";
import { ClosingCta } from "@/components/home/ClosingCta";

import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

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
      {/* the two ICPs route themselves before the proof runs */}
      <AudienceSplit />
      <VideoTestimonials />
      <div className="theme-light">
        {/* the team lives on About; it ran on both pages with the same
            "Full time, in house" heading, so About owns it now */}
        <Testimonials />
        <Faq />
      </div>
      <FounderNote />
      <ClosingCta />
    </>
  );
}
