import type { Metadata } from "next";
import { StubPage } from "@/components/StubPage";

export const metadata: Metadata = { title: "Custom Production" };

export default function Page() {
  return <StubPage title="Custom Production" note="Formats, samples, and the quote flow land here. Until then, the homepage covers what custom production includes." />;
}
