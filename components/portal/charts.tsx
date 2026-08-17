"use client";

import { useId, useState } from "react";

/*
 * Four chart primitives, built by hand.
 *
 * No charting library, deliberately. Every one of them ships more than this
 * whole file for the four shapes actually needed, arrives with its own
 * opinions about colour and type that then have to be fought, and puts a
 * dependency under a screen a partner judges us on. These read from the same
 * tokens as everything else, so a skin change moves them too.
 *
 * They are drawn in a viewBox and scaled by CSS, so one implementation is
 * sharp at any width and there is no resize observer anywhere.
 *
 * Accessibility: a chart is a picture of numbers, so each carries a
 * `summary` that screen readers get instead. A chart with no text
 * alternative is a chart some people simply cannot read.
 */

const cx = (...p: unknown[]) =>
  p.filter((x): x is string => typeof x === "string" && x.length > 0).join(" ");

export type Point = { label: string; value: number };

const niceMax = (max: number) => {
  if (max <= 0) return 1;
  /* Round the top of the scale up to something a person would pick, so the
   * axis reads 40 rather than 37.4 and bars keep a little headroom. */
  const mag = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / mag) * mag;
};

/* ================================================================
   Bars
   ================================================================ */

/**
 * Comparison across a handful of things. Hovering names the exact value,
 * because the whole point of a bar chart is the shape, and the shape is
 * ruined by printing a number over every bar.
 */
export function BarChart({
  data,
  summary,
  height = 160,
  format = (n: number) => String(n),
}: {
  data: Point[];
  /** what this chart says, in a sentence, for anybody not seeing it */
  summary: string;
  height?: number;
  format?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return null;

  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const gap = 6;
  const w = 100;
  const bw = (w - gap * (data.length - 1)) / data.length;

  return (
    <figure className="m-0">
      <div className="relative" style={{ height }}>
        {/* the quiet grid, so a value can be read off without a ruler */}
        <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-t border-hair/70" />
          ))}
        </div>

        <svg
          viewBox={`0 0 ${w} 100`}
          preserveAspectRatio="none"
          className="relative h-full w-full"
          role="img"
          aria-label={summary}
        >
          {data.map((d, i) => {
            const h = Math.max((d.value / max) * 100, d.value > 0 ? 1.5 : 0);
            return (
              <rect
                key={d.label}
                x={i * (bw + gap)}
                y={100 - h}
                width={bw}
                height={h}
                rx="1"
                className={cx(
                  "transition-opacity",
                  hover === null || hover === i ? "opacity-100" : "opacity-40",
                )}
                fill="var(--gold)"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
        </svg>
      </div>

      <div className="mt-2 flex" aria-hidden="true">
        {data.map((d, i) => (
          <div
            key={d.label}
            className="min-w-0 flex-1 text-center"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span
              className={cx(
                "block truncate font-mono text-label transition-colors",
                hover === i ? "text-ink" : "text-dim",
              )}
            >
              {d.label}
            </span>
          </div>
        ))}
      </div>

      <figcaption
        className={cx(
          "mt-1.5 text-center text-body-sm tabular-nums transition-opacity",
          hover === null ? "opacity-0" : "opacity-100",
        )}
      >
        <span className="text-muted">{hover !== null ? data[hover].label : ""} </span>
        <span className="font-semibold text-ink">
          {hover !== null ? format(data[hover].value) : ""}
        </span>
      </figcaption>
    </figure>
  );
}

/* ================================================================
   Area
   ================================================================ */

/**
 * A trend over time. Filled rather than a bare line, because the fill is
 * what makes the direction readable at a glance, and the last point is
 * marked because "where are we now" is the question being asked.
 */
export function AreaChart({
  data,
  summary,
  height = 160,
}: {
  data: Point[];
  summary: string;
  height?: number;
}) {
  const gid = useId();
  if (data.length < 2) return null;

  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const x = (i: number) => (i / (data.length - 1)) * 100;
  const y = (v: number) => 100 - (v / max) * 100;

  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
  const last = data[data.length - 1];

  return (
    <figure className="m-0">
      <div className="relative" style={{ height }}>
        <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-t border-hair/70" />
          ))}
        </div>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="relative h-full w-full overflow-visible"
          role="img"
          aria-label={summary}
        >
          <defs>
            <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L100,100 L0,100 Z`} fill={`url(#fill-${gid})`} />
          <path
            d={line}
            fill="none"
            stroke="var(--gold)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
          {/* the endpoint, because the newest number is the one being looked for */}
          <circle
            cx={x(data.length - 1)}
            cy={y(last.value)}
            r="3"
            fill="var(--gold)"
            stroke="var(--surface)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="mt-2 flex justify-between font-mono text-label text-dim" aria-hidden="true">
        <span>{data[0].label}</span>
        <span>{last.label}</span>
      </div>
    </figure>
  );
}

/* ================================================================
   Donut
   ================================================================ */

/**
 * A breakdown of one whole. Capped at a handful of slices by the caller:
 * past about six, a donut stops being readable and a list is better, and
 * this component will not pretend otherwise.
 */
export function Donut({
  data,
  summary,
  size = 140,
  center,
}: {
  data: (Point & { tone?: "gold" | "green" | "blue" | "muted" })[];
  summary: string;
  size?: number;
  /** what sits in the hole: usually the total */
  center?: { value: ReactNodeLike; label: string };
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return null;

  const TONE = {
    gold: "var(--gold)",
    green: "var(--green)",
    blue: "var(--blue)",
    muted: "var(--hair)",
  } as const;

  const r = 40;
  const c = 2 * Math.PI * r;

  /* Cumulative offsets worked out up front rather than by mutating a counter
   * inside the map. Mutating during render is what React's compiler rules
   * refuse, and rightly: it makes the output depend on render order. */
  const slices = data.reduce<{ d: (typeof data)[number]; frac: number; start: number }[]>(
    (acc, d) => {
      const prev = acc[acc.length - 1];
      const start = prev ? prev.start + prev.frac : 0;
      return [...acc, { d, frac: d.value / total, start }];
    },
    [],
  );

  return (
    <figure className="m-0 flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={summary}>
          {slices.map(({ d, frac, start }) => {
            const dash = `${frac * c} ${c - frac * c}`;
            const offset = -start * c;
            return (
              <circle
                key={d.label}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={TONE[d.tone ?? "gold"]}
                strokeWidth="12"
                strokeDasharray={dash}
                strokeDashoffset={offset}
              />
            );
          })}
        </svg>
        {center && (
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-h4 font-semibold tabular-nums text-ink">{center.value}</div>
              <div className="font-mono text-label uppercase text-dim">{center.label}</div>
            </div>
          </div>
        )}
      </div>
      <ul className="grid min-w-0 flex-1 gap-1.5">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2.5 text-body-sm">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: TONE[d.tone ?? "gold"] }}
            />
            <span className="min-w-0 flex-1 truncate text-muted">{d.label}</span>
            <span className="shrink-0 font-medium tabular-nums text-ink">{d.value}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/* ================================================================
   Sparkline
   ================================================================ */

/** A trend small enough to sit inside a stat card. No axes, no labels: it
 *  carries direction, and the number beside it carries the value. */
export function Sparkline({
  values,
  summary,
  className,
}: {
  values: number[];
  summary: string;
  className?: string;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const d = values
    .map((v, i) => `${i ? "L" : "M"}${(i / (values.length - 1)) * 100},${100 - ((v - min) / span) * 100}`)
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cx("h-8 w-full overflow-visible", className)}
      role="img"
      aria-label={summary}
    >
      <path
        d={d}
        fill="none"
        stroke="var(--gold)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Kept local so this file imports nothing but React. */
type ReactNodeLike = string | number | React.ReactElement;
