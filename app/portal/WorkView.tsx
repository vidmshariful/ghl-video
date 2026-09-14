"use client";

import { Tabs } from "@/components/portal/ui";
import type { WorkLine } from "./sections";

/*
 * My work: the three lines on one screen (phase 6). The switcher is the
 * only thing this adds; each line's screen is its own, with its own header,
 * so a link that opens a project or a plan lands on exactly what it did
 * before. Only the lines the account has appear.
 */
export function WorkSwitcher({
  lines,
  active,
  onChange,
}: {
  lines: { key: WorkLine; label: string; count?: number }[];
  active: WorkLine;
  onChange: (line: WorkLine) => void;
}) {
  if (lines.length <= 1) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <span className="font-mono text-label uppercase tracking-[0.1em] text-dim">My work</span>
      <Tabs tabs={lines} active={active} onChange={onChange} />
    </div>
  );
}
