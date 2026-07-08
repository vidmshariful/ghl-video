import type { Metadata } from "next";
import { StubPage } from "@/components/StubPage";

export const metadata: Metadata = { title: "Video Editing" };

export default function Page() {
  return <StubPage title="Video Editing" note="The editing plans land here. Until then, the homepage covers how the subscription works." />;
}
