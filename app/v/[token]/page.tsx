import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { Logo } from "@/components/Logo";
import { disclaimer, entityLine } from "@/lib/content/core";

export const runtime = "nodejs";
/* a share link is private by nature, so it is never indexed */
export const metadata: Metadata = {
  title: "Shared video | GHL Video",
  robots: { index: false, follow: false },
};

/*
 * A shared cut, on a lightly branded public page.
 *
 * This is what a client's teammate sees when the client shares a video from
 * their portal. No login, no account, nothing but the one video and the
 * studio's name on it. The token is the whole key; an unknown or revoked one
 * lands on the same friendly dead end rather than leaking whether it ever
 * existed.
 */

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

async function findVideo(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  const db = supabaseAdmin();
  const { data } = await db
    .from("order_deliverables")
    .select("title, video_url, share_token")
    .eq("share_token", token)
    .maybeSingle();
  if (!data?.video_url) return null;
  return { title: String(data.title ?? "Your video"), videoUrl: String(data.video_url) };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-full flex-col bg-canvas text-text">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Link href="https://www.ghlvideo.com" aria-label="GHL Video">
          <Logo className="h-7" />
        </Link>
        <Link
          href="https://www.ghlvideo.com"
          className="rounded-[3px] font-mono text-label uppercase tracking-[0.08em] text-muted transition-colors hover:text-gold"
        >
          ghlvideo.com
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 py-6 sm:px-8">{children}</div>
      <footer className="px-5 py-6 text-center sm:px-8">
        <p className="font-mono text-label uppercase tracking-[0.08em] text-dim">
          {entityLine}
        </p>
        <p className="mx-auto mt-1 max-w-[46ch] text-body-sm text-dim">{disclaimer}</p>
      </footer>
    </main>
  );
}

export default async function SharedVideoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const video = await findVideo(token);

  if (!video) {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="font-display text-h3 text-ink">This link is not available</h1>
          <p className="mx-auto mt-2 max-w-[42ch] text-body text-muted">
            The video may have been unshared, or the link was copied wrong. Ask
            whoever sent it for a fresh link.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="w-full max-w-[1100px]">
        <h1 className="font-display text-h3 text-ink">{video.title}</h1>
        <p className="mt-1 font-mono text-label uppercase tracking-[0.08em] text-dim">
          Shared with you by our client, made by GHL Video
        </p>
        <video
          controls
          playsInline
          preload="metadata"
          src={video.videoUrl}
          className="mt-4 max-h-[74vh] w-full rounded-[8px] border border-hair bg-black"
        />
        <p className="mt-4 text-body-sm text-muted">
          Want videos like this for your HighLevel SaaS?{" "}
          <Link href="https://www.ghlvideo.com" className="text-gold underline underline-offset-2">
            See what we make
          </Link>
          .
        </p>
      </div>
    </Shell>
  );
}
