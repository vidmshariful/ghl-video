import type { Metadata } from "next";
import { StubPage } from "@/components/StubPage";

export const metadata: Metadata = { title: "Request a Quote" };

export default function Page() {
  return <StubPage title="Request a Quote" note="The quote form lands here. For now, the fastest path is a call, or the homepage for how custom production works." />;
}
