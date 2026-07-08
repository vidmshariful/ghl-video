import type { Metadata } from "next";
import { StubPage } from "@/components/StubPage";

export const metadata: Metadata = { title: "Premade Videos" };

export default function Page() {
  return <StubPage title="Premade Videos" note="The premade catalog lands here: every video branded to your SaaS, with its own checkout. Until then, the homepage shows how the service works." />;
}
