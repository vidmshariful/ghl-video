"use client";

import { useState } from "react";
import { SpVideo } from "./SpVideo";

/*
 * The white-label proof: the same video, HighLevel's default cut vs the
 * version branded to the client. The prospect toggles to see how their own
 * video would look. Either side renders a placeholder until its real clip
 * is delivered.
 */
export function SpWhiteLabel({
  defaultSrc,
  brandedSrc,
  poster,
}: {
  defaultSrc: string | null;
  brandedSrc: string | null;
  poster: string | null;
}) {
  const [view, setView] = useState<"default" | "branded">("branded");
  const src = view === "branded" ? brandedSrc : defaultSrc;

  return (
    <div>
      <div className="sp-seg" role="tablist" aria-label="Video version">
        <button
          type="button"
          role="tab"
          aria-selected={view === "default"}
          className={`sp-seg-btn${view === "default" ? " is-active" : ""}`}
          onClick={() => setView("default")}
        >
          HighLevel default
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "branded"}
          className={`sp-seg-btn${view === "branded" ? " is-active" : ""}`}
          onClick={() => setView("branded")}
        >
          Your SaaS
        </button>
      </div>
      <div style={{ marginTop: "1rem" }}>
        <SpVideo
          key={view}
          src={src}
          poster={poster}
          label={view === "branded" ? "branded cut" : "default cut"}
          placeholder={view === "branded" ? "Branded cut coming" : "Default cut coming"}
        />
      </div>
    </div>
  );
}
