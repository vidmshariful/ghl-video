import type { Metadata } from "next";
import { StubPage } from "@/components/StubPage";

export const metadata: Metadata = { title: "Our Work" };

export default function Page() {
  return <StubPage title="Our Work" note="The full portfolio lands here. Until then, the homepage plays recent pieces in the work section." />;
}
