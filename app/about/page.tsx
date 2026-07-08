import type { Metadata } from "next";
import { StubPage } from "@/components/StubPage";

export const metadata: Metadata = { title: "About GHL Video" };

export default function Page() {
  return <StubPage title="About GHL Video" note="The studio story, the team, and the founder land here. The homepage carries the short version today." />;
}
