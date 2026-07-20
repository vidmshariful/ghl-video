import type { Metadata } from "next";
import { StubPage } from "@/components/StubPage";

/* unique meta (was falling back to the homepage description, a
 * duplicate-meta fault) and noindex until real articles ship */
export const metadata: Metadata = {
  title: "Knowledge Hub",
  description:
    "The GHL Video Knowledge Hub: practical guides on HighLevel video, demos, onboarding, and SaaS growth.",
  robots: { index: false, follow: true },
};

export default function Page() {
  return <StubPage title="Knowledge Hub" note="Articles are on the way, each one with the video embedded. They arrive here straight from the blog." />;
}
