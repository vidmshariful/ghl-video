"use client";

import { useState } from "react";
import { pages } from "@/lib/site";

/*
 * The "Request a video" column's form on /studio-insights: one topic
 * field, posted to /api/studio/request. Requests land in a moderated
 * queue in the admin Studio screen; nothing a visitor types is ever
 * shown publicly until the team promotes it onto the board.
 */
const copy = pages.studio.board.columns.request;

export function StudioRequestForm() {
  const [topic, setTopic] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (topic.trim().length < 4 || state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/studio/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="border border-dashed border-gold/40 bg-gold/[0.06] p-4 text-body-sm text-ink">
        {copy.done}
      </p>
    );
  }

  return (
    <form onSubmit={submit}>
      <label>
        <span className="sr-only">Your video topic</span>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={160}
          placeholder={copy.placeholder}
          className="w-full rounded-[3px] border border-hair bg-canvas px-3.5 py-3 text-body-sm text-ink placeholder:text-dim focus:border-gold focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={state === "sending" || topic.trim().length < 4}
        className="tap group mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[3px] border border-gold/40 bg-gold/[0.08] px-4 py-3 font-mono text-label uppercase tracking-[0.1em] text-gold transition-colors hover:bg-gold/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "sending" ? "Sending" : copy.submit}
        <span
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        >
          &rarr;
        </span>
      </button>
      {state === "error" && (
        <p className="mt-3 text-body-sm text-error">{copy.error}</p>
      )}
    </form>
  );
}
