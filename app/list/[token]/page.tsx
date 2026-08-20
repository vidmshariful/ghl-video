import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { resolveList } from "@/lib/shared-lists";
import { SharedListClient } from "./SharedListClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * A shortlist somebody sent to the person who has to agree.
 *
 * Outside the marketing site and outside the portal, beside the invoice
 * page, which is the same shape: a public page unlocked by a token that
 * reads money data. The site route group must not import money-path
 * internals, and the eslint boundary rules say so; this is where that kind
 * of page has always lived.
 *
 * No account, on purpose. The reader is a cofounder or a marketing lead who
 * has never been here, and asking them to sign up to look at six thumbnails
 * is the wall this exists to remove. The link is the whole permission.
 *
 * Noindex, because a link meant for one person should not turn up in search.
 */
export const metadata: Metadata = {
  title: "A shortlist of videos",
  robots: { index: false, follow: false },
};

export default async function SharedListPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const list = await resolveList(supabaseAdmin(), token);
  if (!list) notFound();

  return <SharedListClient list={list} />;
}
