"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Input } from "@/components/portal/ui";

/*
 * Share one finished cut with people outside the portal.
 *
 * A client shows the video to their own team without giving anyone a login:
 * one link, to a GHL Video branded page, that they can turn off again. The
 * link is minted on demand and the same one comes back every time until it
 * is stopped, so a link already pasted into an email keeps working.
 */

export function ShareVideo({
  videoId,
  title,
  authedFetch,
  onClose,
}: {
  videoId: string;
  title: string;
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    const j = (await authedFetch(`/api/portal/videos/${videoId}/share`).catch(() => null)) as {
      url?: string | null;
    } | null;
    setUrl(j?.url ?? null);
    setLoaded(true);
  }, [authedFetch, videoId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  async function create() {
    setBusy(true);
    setErr("");
    const j = (await authedFetch(`/api/portal/videos/${videoId}/share`, { method: "POST" }).catch(
      () => null,
    )) as { url?: string | null; error?: string } | null;
    setBusy(false);
    if (!j?.url) return setErr(j?.error ?? "Could not make a link.");
    setUrl(j.url);
  }

  async function stop() {
    setBusy(true);
    setErr("");
    await authedFetch(`/api/portal/videos/${videoId}/share`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    setUrl(null);
    setCopied(false);
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr("Could not copy. Select the link and copy it by hand.");
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-canvas/85 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Share ${title}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mt-[8vh] w-full max-w-lg rounded-[12px] border border-hair bg-surface p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-h4 text-ink">Share with your team</h2>
            <p className="mt-1 text-body-sm text-muted">
              One link to a GHL Video page, no login needed. Turn it off any time.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tap shrink-0 rounded-[8px] border border-hair px-3 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
          >
            Close
          </button>
        </div>

        <div className="mt-4">
          {!loaded ? (
            <p className="text-body-sm text-muted">Loading...</p>
          ) : url ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-[14rem] flex-1">
                  <Input value={url} readOnly aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
                </div>
                <Button variant="brand" onClick={copy}>
                  {copied ? "Copied" : "Copy link"}
                </Button>
              </div>
              <p className="text-body-sm text-dim">
                Anyone with this link can watch the video. They cannot see your
                account, your other videos, or anything else.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={stop}
                className="tap justify-self-start font-mono text-label uppercase tracking-[0.08em] text-dim transition-colors hover:text-error disabled:opacity-50"
              >
                Stop sharing this video
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              <p className="text-body-sm text-muted">
                Make a link you can send to your team. It opens the video on a
                GHL Video page, with no sign in.
              </p>
              <Button variant="brand" disabled={busy} onClick={create} full>
                {busy ? "Making the link..." : "Create a shareable link"}
              </Button>
            </div>
          )}
          {err && <p className="mt-2 text-body-sm text-error">{err}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
