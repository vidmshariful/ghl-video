import type { Metadata } from "next";
import { StubPage } from "@/components/StubPage";

const docs = {
  privacy: "Privacy Policy",
  terms: "Terms of Service",
  refund: "Refund Policy",
} as const;

export function generateStaticParams() {
  return Object.keys(docs).map((doc) => ({ doc }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ doc: string }>;
}): Promise<Metadata> {
  const { doc } = await params;
  return { title: docs[doc as keyof typeof docs] ?? "Legal" };
}

export default async function Page({
  params,
}: {
  params: Promise<{ doc: string }>;
}) {
  const { doc } = await params;
  const title = docs[doc as keyof typeof docs] ?? "Legal";
  return (
    <StubPage
      title={title}
      note="The full policy text lands here before launch."
    />
  );
}
