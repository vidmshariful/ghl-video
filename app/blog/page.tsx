import type { Metadata } from "next";
import { StubPage } from "@/components/StubPage";

export const metadata: Metadata = { title: "Knowledge Hub" };

export default function Page() {
  return <StubPage title="Knowledge Hub" note="Articles are on the way, each one with the video embedded. They arrive here straight from the blog." />;
}
