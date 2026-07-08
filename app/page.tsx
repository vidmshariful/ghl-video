import { ShowreelHero } from "@/components/home/ShowreelHero";
import { TrustStrip } from "@/components/home/TrustStrip";
import { ServiceBento } from "@/components/home/ServiceBento";
import { ShowreelMoment } from "@/components/home/ShowreelMoment";
import { WhyPoints } from "@/components/home/WhyPoints";
import { AudienceSplit } from "@/components/home/AudienceSplit";
import { Testimonials } from "@/components/home/Testimonials";
import { ClosingCta } from "@/components/home/ClosingCta";

export default function Home() {
  return (
    <>
      <ShowreelHero />
      <TrustStrip />
      <ServiceBento />
      <ShowreelMoment />
      <WhyPoints />
      <AudienceSplit />
      <Testimonials />
      <ClosingCta />
    </>
  );
}
