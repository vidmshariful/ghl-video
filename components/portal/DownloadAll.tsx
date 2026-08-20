"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/portal/ui";

/*
 * Every finished video in one press.
 *
 * A nine video pack was nine presses, and the moment somebody wants all of
 * them is the moment they have just approved the last one.
 *
 * No zip. Zipping several gigabytes of video in a serverless function to
 * hand back one file is a slow, expensive way to hit a timeout. This asks
 * the browser to fetch each one in turn instead, which is what the browser
 * is already good at. Chrome asks once whether to allow several downloads
 * from a site and then gets on with it.
 */
export function DownloadAll({
  videoIds,
  label = "Download them all",
}: {
  videoIds: string[];
  label?: string;
}) {
  const [done, setDone] = useState(0);
  const [busy, setBusy] = useState(false);

  if (videoIds.length < 2) return null;

  async function run() {
    setBusy(true);
    setDone(0);
    for (let i = 0; i < videoIds.length; i++) {
      const a = document.createElement("a");
      a.href = `/api/portal/videos/${videoIds[i]}/download`;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setDone(i + 1);
      /* spaced out on purpose: fired in one tick, a browser treats the run
       * as a popup storm and silently drops most of it */
      if (i < videoIds.length - 1) await new Promise((r) => setTimeout(r, 900));
    }
    setBusy(false);
  }

  return (
    <Button variant="secondary" size="sm" icon={<Download />} disabled={busy} onClick={run}>
      {busy ? `Starting ${done} of ${videoIds.length}...` : `${label} (${videoIds.length})`}
    </Button>
  );
}
