import { Hero } from "@/components/home/Hero";
import { TrustStrip } from "@/components/home/TrustStrip";
import { ServicePanels } from "@/components/home/ServicePanels";
import { Manifesto } from "@/components/home/Manifesto";
import { ShowreelMoment } from "@/components/home/ShowreelMoment";
import { ClientWall } from "@/components/home/ClientWall";
import { Comparison } from "@/components/home/Comparison";
import { AudienceSplit } from "@/components/home/AudienceSplit";
import { FeaturedTestimonial } from "@/components/home/FeaturedTestimonial";
import { VideoTestimonials } from "@/components/home/VideoTestimonials";
import { Testimonials } from "@/components/home/Testimonials";
import { Faq } from "@/components/home/Faq";
import { FounderNote } from "@/components/home/FounderNote";
import { CtaBand } from "@/components/CtaBand";

import { cta, home } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      {/* preload the hero's LCP poster; scoped to the homepage so other
          routes never fetch it. Keep in sync with the Hero's featured poster. */}
      <link rel="preload" as="image" href="/posters/ai-master.jpg" fetchPriority="high" />
      <Hero />
      <TrustStrip />
      <ServicePanels />
      <Manifesto />
      <ShowreelMoment />
      <ClientWall />
      <Comparison />
      {/* the two ICPs route themselves before the proof runs */}
      <AudienceSplit />
      {/* Chase Buckner (HighLevel): authority proof, leads the customer
          founder stories below */}
      <FeaturedTestimonial />
      <VideoTestimonials />
      {/* the team lives on About; it ran on both pages with the same
          "Full time, in house" heading, so About owns it now */}
      <Testimonials />
      <Faq />
      <FounderNote />
      <CtaBand
        bpIdx={10}
        headline={home.closing.headline}
        accent={home.closing.accent}
        sub={home.closing.lede}
        cta={cta.bookACall}
      />
    </>
  );
}
