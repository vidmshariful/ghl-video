import { ShowreelHero } from "@/components/home/ShowreelHero";
import { TrustStrip } from "@/components/home/TrustStrip";
import { ServiceBento } from "@/components/home/ServiceBento";
import { ShowreelMoment } from "@/components/home/ShowreelMoment";
import { Comparison } from "@/components/home/Comparison";
import { AudienceSplit } from "@/components/home/AudienceSplit";
import { Testimonials } from "@/components/home/Testimonials";
import { FounderNote } from "@/components/home/FounderNote";
import { ClosingCta } from "@/components/home/ClosingCta";

export default function Home() {
  return (
    <>
      <ShowreelHero />
      <TrustStrip />
      <ServiceBento />
      <ShowreelMoment />
      <Comparison />
      <AudienceSplit />
      <Testimonials />
      <FounderNote />
      <ClosingCta />
    </>
  );
}
