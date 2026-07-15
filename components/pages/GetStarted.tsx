"use client";

import { useState } from "react";
import { EmbedSlot } from "@/components/EmbedSlot";

/*
 * Two ways in, one section: send the brief, or talk it through first.
 * The segmented control is the same control the bundle tabs use, so a
 * reader who has seen one has seen both.
 *
 * PLACEHOLDER: both panels are EmbedSlots until the HighLevel form and
 * calendar snippets arrive. The layout is final; the embed drops in
 * with no layout change.
 */
export type GetStartedTab = {
  key: string;
  label: string;
  embedLabel: string;
  note: string;
};

export function GetStarted({ tabs }: { tabs: readonly GetStartedTab[] }) {
  const [active, setActive] = useState(tabs[0].key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div>
      <div
        role="tablist"
        aria-label="How to start"
        className="mx-auto flex w-fit flex-wrap justify-center gap-1 rounded-[4px] border border-hair bg-surface/60 p-1"
      >
        {tabs.map((t) => {
          const isActive = t.key === current.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`start-tab-${t.key}`}
              aria-selected={isActive}
              aria-controls={`start-panel-${t.key}`}
              onClick={() => setActive(t.key)}
              className={`tap rounded-[3px] px-4 py-2 font-mono text-label uppercase transition-colors ${
                isActive
                  ? "bg-gold/15 font-semibold text-gold"
                  : "text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`start-panel-${current.key}`}
        aria-labelledby={`start-tab-${current.key}`}
        className="mx-auto mt-8 max-w-3xl"
      >
        <EmbedSlot label={current.embedLabel} note={current.note} />
      </div>
    </div>
  );
}
