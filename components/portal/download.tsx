"use client";

import { useState } from "react";
import { actForHeader } from "@/components/portal/act-for";
import { supabaseBrowser } from "@/lib/supabase-browser";

/*
 * Start a video download.
 *
 * Every download button in the portal used to be a plain <a> pointed at the
 * download route. A navigation carries no Authorization header, and the
 * portal session lives in localStorage rather than a cookie, so the route saw
 * no session and the client got {"error":"Unauthorized."} rendered as JSON in
 * a tab. It had never worked, on any screen.
 *
 * So ask, with the session, for a short-lived ticket, then navigate to the
 * ticketed URL. The browser does the transfer itself, which is what we want:
 * the biggest video a client owns is 696MB, and fetching that into a blob to
 * attach a header would hold it all in the tab's memory and show no progress
 * the whole way down.
 *
 * Returns an error string, or null when the download started.
 */
export async function startVideoDownload(videoId: string): Promise<string | null> {
  let token: string | undefined;
  try {
    const { data } = await supabaseBrowser.auth.getSession();
    token = data.session?.access_token;
  } catch {
    /* falls through to the signed-out message below */
  }
  if (!token) return "Please sign in again to download this.";

  try {
    /* trailing slash on purpose: the app sets trailingSlash, so the bare path
       308s and every download pays a wasted round trip */
    const r = await fetch(`/api/portal/videos/${videoId}/download/`, {
      method: "POST",
      /* a teammate downloads from inside the owner's account, same as every
         other portal call */
      headers: { Authorization: `Bearer ${token}`, ...actForHeader() },
    });
    const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!r.ok || !j.url) return j.error ?? "That download could not start.";

    /* a same-origin link, so content-disposition is honoured and the file
       lands in Downloads instead of playing in a tab */
    const a = document.createElement("a");
    a.href = j.url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return null;
  } catch {
    return "That download could not start.";
  }
}

/*
 * The download control itself, so every screen gets the same behaviour and
 * the same colour. There were five of these written by hand, each an <a> at
 * the route, and all five were broken the same way.
 *
 * Blue everywhere, because that is what download means across the portal, and
 * bordered rather than muted: getting your finished video is a real action,
 * not an afterthought sitting in grey beside the buttons that matter.
 */
const STYLES = {
  /* small, in a row of header controls */
  chip: "rounded-[8px] border border-blue/50 px-3 py-1.5 font-mono text-label uppercase text-blue hover:border-blue hover:bg-blue/10",
  /* full size, beside Approved */
  button: "rounded-[8px] border border-blue/50 px-3.5 py-2 text-body-sm font-semibold text-blue hover:border-blue hover:bg-blue/10",
  /* bare, on a card that already has its own primary action */
  link: "font-mono text-label uppercase tracking-[0.1em] text-blue hover:underline",
} as const;

export function DownloadButton({
  videoId,
  label = "Download",
  variant = "chip",
}: {
  videoId: string;
  label?: string;
  variant?: keyof typeof STYLES;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr((await startVideoDownload(videoId)) ?? "");
          setBusy(false);
        }}
        className={`tap transition-colors disabled:opacity-60 ${STYLES[variant]}`}
      >
        {busy ? "Starting..." : label}
      </button>
      {/* said where it happened, not swallowed into a console nobody reads */}
      {err && <span className="text-body-sm text-error">{err}</span>}
    </>
  );
}
