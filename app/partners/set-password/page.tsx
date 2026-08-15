import type { Metadata } from "next";
import { SetPasswordClient } from "./SetPasswordClient";

export const metadata: Metadata = {
  title: "Set your password",
  robots: { index: false, follow: false },
};

export default function PartnerSetPasswordPage() {
  return <SetPasswordClient />;
}
