import type { Metadata } from "next";
import { IntakeClient } from "./IntakeClient";

/* The branding brief, reached from the thank-you page via the order's UUID.
 * Never indexed; always server-rendered (the client reads the order per id). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your branding brief",
  robots: { index: false, follow: false },
};

export default async function IntakePage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return (
    <section className="relative py-14 md:py-20">
      <div className="mx-auto w-full max-w-[720px] px-5">
        <IntakeClient orderId={orderId} />
      </div>
    </section>
  );
}
