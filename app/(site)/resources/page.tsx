import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { StubPage } from "@/components/StubPage";

/* unique meta (was falling back to the homepage description) and
 * noindex until the page carries real resources */
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/resources/", {
    title: "Free Resources",
    description:
      "Free video resources for HighLevel SaaS founders: guides, templates, and swipe files, added as they release.",
    robots: { index: false, follow: true },
    alternates: { canonical: "/resources/" },
  });
}

export default function Page() {
  return <StubPage title="Free Resources" note="Free resources for HighLevel SaaS founders land here as they are released." />;
}
