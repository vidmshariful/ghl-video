import type { Metadata } from "next";
import { StubPage } from "@/components/StubPage";

export const metadata: Metadata = { title: "Free Resources" };

export default function Page() {
  return <StubPage title="Free Resources" note="Free resources for HighLevel teams land here as they are released." />;
}
