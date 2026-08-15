import type { Metadata } from "next";
import { ApplyClient } from "./ApplyClient";

export const metadata: Metadata = {
  title: "Apply to the Partner Program",
  description:
    "Recommend GHL Video to your audience, give them a standing discount, and earn on every referral.",
  robots: { index: false, follow: false },
};

export default function PartnerApplyPage() {
  return <ApplyClient />;
}
