"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/*
 * Our own confirm box.
 *
 * The browser's confirm() draws a grey system panel pinned to the top of the
 * window with the URL in it. It is the one moment in the whole portal that
 * looks like a warning from the browser rather than a question from us, and it
 * lands right where a client is deciding whether to approve their video.
 *
 * Rendered into <body> for the same reason the video popup is: an animated
 * ancestor becomes the containing block for position:fixed and would trap this
 * inside the content column.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "gold",
  onConfirm,
  onCancel,
}: {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** gold for a normal choice, green for the happy one (approving) */
  tone?: "gold" | "green";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const yes = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    yes.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    // capture, so this closes before the video popup behind it does
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-canvas/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-[440px] rounded-[12px] border border-hair bg-surface p-6 shadow-2xl">
        <h2 className="font-display text-h4 leading-tight text-ink">{title}</h2>
        {body && <p className="mt-2 text-body-sm leading-relaxed text-muted">{body}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
          >
            {cancelLabel}
          </button>
          <button
            ref={yes}
            type="button"
            onClick={onConfirm}
            className={`tap rounded-[8px] px-4 py-2 font-mono text-label font-bold uppercase text-canvas transition-opacity hover:opacity-90 ${
              tone === "green" ? "bg-brand-gradient" : "bg-gold"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
