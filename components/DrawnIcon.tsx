"use client";

import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Building2,
  CalendarCheck2,
  Clapperboard,
  Clock3,
  Crosshair,
  Globe,
  LayoutDashboard,
  LockKeyhole,
  MessageSquareText,
  Mic,
  MonitorPlay,
  MousePointerClick,
  PackageCheck,
  Palette,
  PenLine,
  Scissors,
  Send,
  Tags,
  Upload,
  Zap,
} from "lucide-react";

/* Icons are referenced by NAME from server components (component
 * functions cannot cross the server/client boundary) and resolved
 * here. Add to this map when a page needs a new glyph. */
const icons = {
  "badge-check": BadgeCheck,
  building: Building2,
  "calendar-check": CalendarCheck2,
  clapperboard: Clapperboard,
  clock: Clock3,
  crosshair: Crosshair,
  globe: Globe,
  layout: LayoutDashboard,
  lock: LockKeyhole,
  message: MessageSquareText,
  mic: Mic,
  "monitor-play": MonitorPlay,
  "mouse-click": MousePointerClick,
  "package-check": PackageCheck,
  palette: Palette,
  "pen-line": PenLine,
  scissors: Scissors,
  send: Send,
  tags: Tags,
  upload: Upload,
  zap: Zap,
} as const;

export type IconName = keyof typeof icons;

/* one accent: every drawn icon is gold */
const accentStroke = {
  gold: "text-gold",
  green: "text-gold",
  blue: "text-gold",
} as const;

/*
 * Stroke-draw icon: the lucide glyph draws itself in when it scrolls
 * into view, like the plotter placing a mark, and redraws when the
 * enclosing [data-cell] is hovered. Every shape gets pathLength=1 so
 * one dasharray rule covers paths, lines, circles, and rects; the
 * draw itself is a CSS transition on stroke-dashoffset driven by a
 * CSS variable. Reduced motion renders the icon fully drawn.
 */
export function DrawnIcon({
  name,
  accent = "gold",
  size = 26,
}: {
  name: IconName;
  accent?: keyof typeof accentStroke;
  size?: number;
}) {
  const Icon = icons[name];
  const ref = useRef<HTMLSpanElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.querySelectorAll("path, line, polyline, polygon, circle, rect").forEach(
      (shape) => shape.setAttribute("pathLength", "1"),
    );

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDrawn(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDrawn(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);

    /* redraw on cell hover */
    const cell = el.closest("[data-cell]");
    const replay = () => {
      setDrawn(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    };
    cell?.addEventListener("mouseenter", replay);
    return () => {
      io.disconnect();
      cell?.removeEventListener("mouseenter", replay);
    };
  }, []);

  return (
    <span
      ref={ref}
      className={`drawn-icon inline-flex ${accentStroke[accent]}`}
      style={{ "--dash": drawn ? 0 : 1 } as React.CSSProperties}
    >
      <Icon size={size} strokeWidth={1.5} aria-hidden="true" />
    </span>
  );
}
