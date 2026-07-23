import { Suspense } from "react";
import type { Metadata } from "next";
import { ThankYouClient } from "./ThankYouClient";

export const metadata: Metadata = {
  title: "Thank you",
  robots: { index: false, follow: false },
};

export default function ThankYouPage() {
  return (
    <Suspense fallback={null}>
      <ThankYouClient />
    </Suspense>
  );
}
