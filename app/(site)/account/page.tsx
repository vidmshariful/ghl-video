import type { Metadata } from "next";
import { AccountClient } from "./AccountClient";

export const metadata: Metadata = {
  title: "Your account",
  description: "Track your GHL Video orders, delivery, and invoices.",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <AccountClient />;
}
