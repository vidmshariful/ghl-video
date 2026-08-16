"use client";

import { useEffect, useRef, useState } from "react";

/*
 * Live readers. Everything on the token and type pages resolves its value
 * from the DOM at runtime instead of being typed into the page by hand.
 * That is the difference between a style guide and a screenshot of one: if
 * somebody edits --gold in globals.css, the kit changes with it, and it
 * cannot quietly go stale the way a hand-written table does.
 *
 * Each reader measures itself IN PLACE, so a swatch inside a
 * data-surface="portal" wrapper reports the portal's value of the variable,
 * not :root's.
 */

function useComputedVar(name: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState<string>("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setValue(getComputedStyle(el).getPropertyValue(name).trim());
  }, [name]);

  return { ref, value };
}

export function Swatch({ name, label }: { name: string; label?: string }) {
  const { ref, value } = useComputedVar(name);
  const isGradient = value.includes("gradient");

  return (
    <div ref={ref} className="flex min-w-0 flex-col gap-2">
      <div
        className="h-16 w-full rounded-[4px] border border-[var(--kit-line)]"
        style={isGradient ? { backgroundImage: value } : { background: value }}
      />
      <div className="min-w-0">
        <div className="truncate text-[0.75rem] font-semibold text-[var(--kit-text)]">
          {label ?? name}
        </div>
        <div className="truncate text-[0.6875rem] text-[var(--kit-dim)]" title={value}>
          {value || "—"}
        </div>
      </div>
    </div>
  );
}

/* Reads back the resolved font-size/line-height/tracking of a type step so
 * the scale page shows what the browser actually rendered, at this viewport.
 * Several steps are clamp() based, so the number moves as you resize. */
export function TypeRow({
  className,
  name,
  sample,
}: {
  className: string;
  name: string;
  sample: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [spec, setSpec] = useState<string>("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const s = getComputedStyle(el);
      const px = (v: string) => `${Math.round(parseFloat(v) * 100) / 100}px`;
      setSpec(
        [
          px(s.fontSize),
          `lh ${px(s.lineHeight)}`,
          `ls ${s.letterSpacing === "normal" ? "0" : s.letterSpacing}`,
          `w ${s.fontWeight}`,
        ].join("  ")
      );
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="border-b border-[var(--kit-line)] py-5 last:border-0">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <code className="text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--kit-accent)]">
          {name}
        </code>
        <span className="text-[0.6875rem] text-[var(--kit-dim)] tabular-nums">
          {spec}
        </span>
      </div>
      <p ref={ref} className={`${className} text-ink`}>
        {sample}
      </p>
    </div>
  );
}

/*
 * Contrast reporter. Reads two resolved variables and prints their ratio
 * against the WCAG bar, because the dim/muted greys on this system were
 * tuned twice for exactly this and a restyle can undo it silently.
 */
function srgb(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(rgb: [number, number, number]) {
  return 0.2126 * srgb(rgb[0]) + 0.7152 * srgb(rgb[1]) + 0.0722 * srgb(rgb[2]);
}

function parseRgb(value: string): [number, number, number] | null {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length >= 3 && parts.slice(0, 3).every((n) => !Number.isNaN(n))) {
      return [parts[0], parts[1], parts[2]];
    }
    return null;
  }
  /* Browsers normalise custom-property hex values, and the short form comes
   * back short: --green is authored #00cc00 and reads back as #0c0. Expand
   * 3- and 4-digit hex before parsing, or every colour that happens to be
   * expressible in shorthand silently reports no ratio. */
  let hex = value.trim().replace("#", "");
  if (hex.length === 3 || hex.length === 4) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (hex.length === 6 || hex.length === 8) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  return null;
}

export function ContrastRow({
  fg,
  bg,
  /* 4.5 for body and small text, 3 for large text and UI edges */
  bar = 4.5,
}: {
  fg: string;
  bg: string;
  bar?: number;
}) {
  const ref = useRef<HTMLTableRowElement>(null);
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const s = getComputedStyle(el);
    const a = parseRgb(s.getPropertyValue(fg).trim());
    const b = parseRgb(s.getPropertyValue(bg).trim());
    if (!a || !b) return;
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    setRatio(Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100);
  }, [fg, bg]);

  const passes = ratio !== null && ratio >= bar;

  return (
    <tr ref={ref} className="border-b border-[var(--kit-line)] last:border-0">
      <td className="px-4 py-2.5 font-semibold whitespace-nowrap text-[var(--kit-text)]">
        {fg}
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap text-[var(--kit-dim)]">{bg}</td>
      <td className="px-4 py-2.5 tabular-nums text-[var(--kit-dim)]">
        {ratio === null ? "—" : ratio.toFixed(2)}
      </td>
      <td className="px-4 py-2.5 tabular-nums text-[var(--kit-dim)]">{bar}</td>
      <td className="px-4 py-2.5">
        {ratio === null ? (
          <span className="text-[var(--kit-dim)]">&mdash;</span>
        ) : (
          <span
            className="rounded-[3px] px-2 py-0.5 text-[0.6875rem] font-semibold tracking-[0.1em] text-[#08090d]"
            style={{ background: passes ? "var(--green)" : "var(--kit-warn)" }}
          >
            {passes ? "PASS" : "FAIL"}
          </span>
        )}
      </td>
    </tr>
  );
}
