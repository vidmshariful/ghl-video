import type { Metadata } from "next";
import { StubPage } from "@/components/StubPage";

export const metadata: Metadata = { title: "Contact" };

export default function Page() {
  return (
    <StubPage
      title="Contact and Book a Call"
      note="The booking calendar lands here. Email works today and gets a reply from a human."
      emailCta
    />
  );
}
