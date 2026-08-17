"use client";

import type { ReactNode } from "react";

/*
 * The portal's shared vocabulary.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The Shell already gave the portals their chrome: sidebar, top bar, avatar,
 * bell. What it never gave them was anything to put INSIDE. There was no
 * shared card, page header, table, field or button, so all twenty five admin
 * screens plus the customer and partner portals invented their own. Measured
 * before this file: fourteen screens opening with their own `btn`, `field`
 * and `lab` strings, sixty local style constants in total, each a slightly
 * different guess at the same thing.
 *
 * That is the actual reason the portals read as "everything inline full
 * width". Nobody was composing with a common vocabulary, because there was
 * not one to compose with.
 *
 * HOW TO USE IT
 * -------------
 * Screens compose these. A screen should not declare its own button or field
 * styles again; `npm run check:portal-ui` fails the build if one does.
 *
 * Everything here paints with CONTENT tokens, never chrome ones. A dark block
 * in the middle of a light page is the exact leak the skin split prevents,
 * and `tone="dark"` on Card is the one deliberate exception, for the panels
 * meant to carry weight.
 */

/* Portal radius is forked to 8px controls and 12px containers, which is the
 * one place the portals deliberately differ from the main site's tight 4px.
 * Kept as constants so a future change is one edit, not a find and replace. */
const R_CONTAINER = "rounded-[12px]";
const R_CONTROL = "rounded-[8px]";

/* Takes unknown rather than a union of falsy types: `cond && "cls"` widens to
 * whatever cond is, and a narrower signature rejects perfectly good calls. */
const cx = (...parts: unknown[]) =>
  parts.filter((p): p is string => typeof p === "string" && p.length > 0).join(" ");

/* ================================================================
   Page header
   ================================================================ */

/**
 * The top of every screen: what this is, what it is for, what you can do.
 *
 * The description is not decoration. A screen whose purpose has to be
 * inferred from its table headers is a screen people avoid, and one sentence
 * is cheaper than the support message that follows without it.
 */
export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  /** buttons, right aligned on wide screens and wrapping under on narrow */
  actions?: ReactNode;
  /** filters, tabs, anything that belongs to the header rather than the body */
  children?: ReactNode;
}) {
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-h2 text-ink">{title}</h1>
          {description && (
            <p className="mt-1.5 max-w-[var(--measure-body)] text-body text-muted">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </header>
  );
}

/* ================================================================
   Card
   ================================================================ */

/**
 * The container everything lives in.
 *
 * `tone="dark"` is the deliberate exception to the light working area: a
 * panel that should carry weight, for a headline number or a primary offer.
 * Used sparingly. Two dark cards on one screen is one too many, and at that
 * point neither is emphasis any more.
 */
export function Card({
  title,
  description,
  actions,
  footer,
  tone = "light",
  padded = true,
  className,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  tone?: "light" | "dark";
  /** off when the body is a table or a media grid that should reach the edges */
  padded?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const dark = tone === "dark";
  return (
    <section
      className={cx(
        R_CONTAINER,
        "border",
        dark ? "border-chrome-line bg-chrome text-chrome-text" : "border-hair bg-surface",
        className,
      )}
    >
      {(title || actions) && (
        <div
          className={cx(
            "flex flex-wrap items-start justify-between gap-x-5 gap-y-2 px-5 pt-5",
            !padded && "pb-5",
          )}
        >
          <div className="min-w-0">
            {title && (
              <h2 className={cx("text-h4 font-semibold", dark ? "text-chrome-text" : "text-ink")}>
                {title}
              </h2>
            )}
            {description && (
              <p className={cx("mt-1 text-body-sm", dark ? "text-chrome-muted" : "text-muted")}>
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      <div className={cx(padded && "p-5", padded && (title || actions) && "pt-4")}>{children}</div>
      {footer && (
        <div
          className={cx(
            "border-t px-5 py-3.5",
            dark ? "border-chrome-line" : "border-hair",
          )}
        >
          {footer}
        </div>
      )}
    </section>
  );
}

/** A run of cards. The default grid, so screens stop inventing their own. */
export function CardGrid({
  min = "17rem",
  children,
}: {
  /** narrowest a card may get before the grid drops a column */
  min?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}, 100%), 1fr))` }}
    >
      {children}
    </div>
  );
}

/* ================================================================
   Stat
   ================================================================ */

/**
 * One number that matters, with what it means underneath.
 *
 * `delta` takes its colour from direction, not from sign: a fall in refunds
 * is good news and should not be painted red because it starts with a minus.
 * The caller says which it is.
 */
export function Stat({
  label,
  value,
  hint,
  delta,
  tone = "light",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  delta?: { text: string; good: boolean };
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <div
      className={cx(
        R_CONTAINER,
        "border p-5",
        dark ? "border-chrome-line bg-chrome" : "border-hair bg-surface",
      )}
    >
      <p
        className={cx(
          "font-mono text-label uppercase tracking-[0.1em]",
          dark ? "text-chrome-dim" : "text-dim",
        )}
      >
        {label}
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-2.5">
        <span
          className={cx(
            "text-stat-lg font-semibold tabular-nums",
            dark ? "text-chrome-text" : "text-ink",
          )}
        >
          {value}
        </span>
        {delta && (
          <span
            className={cx(
              "rounded-full px-2 py-0.5 font-mono text-label",
              delta.good ? "bg-green/15 text-green" : "bg-error/15 text-error",
            )}
          >
            {delta.text}
          </span>
        )}
      </div>
      {hint && (
        <p className={cx("mt-1.5 text-body-sm", dark ? "text-chrome-muted" : "text-muted")}>
          {hint}
        </p>
      )}
    </div>
  );
}

/* ================================================================
   Button
   ================================================================ */

/*
 * Primary is DARK on the light working area, per client direction, and the
 * brand gradient is held back for the one action on a screen that is really
 * asking for money or a commitment. A gradient on every save button spends
 * the signal that makes the gradient mean anything.
 */
const BUTTON_TONES = {
  primary: "bg-chrome text-chrome-text hover:bg-chrome-2 border border-chrome",
  brand: "bg-brand-gradient text-canvas font-semibold hover:brightness-110 border border-transparent",
  secondary: "border border-hair bg-surface text-ink hover:border-gold/60 hover:text-gold",
  ghost: "border border-transparent text-muted hover:bg-hair/50 hover:text-ink",
  danger: "border border-hair text-error hover:border-error/60 hover:bg-error/5",
} as const;

const BUTTON_SIZES = {
  sm: "px-3 py-1.5 text-body-sm",
  md: "px-4 py-2.5 text-body-sm",
  lg: "px-5 py-3 text-body",
} as const;

type ButtonBase = {
  variant?: keyof typeof BUTTON_TONES;
  size?: keyof typeof BUTTON_SIZES;
  icon?: ReactNode;
  /** stretches to its container, for a card footer or a mobile action */
  full?: boolean;
  className?: string;
  children: ReactNode;
};

/*
 * `href` turns it into a link, and it is here because plenty of the things
 * that look like buttons genuinely navigate: an asset to download, a mailto,
 * an external landing page. Without it those anchors have to style
 * themselves, which is how a portal ends up with a link that looks almost
 * like a button and behaves nothing like one.
 *
 * A real anchor rather than a button that calls router.push, so middle click,
 * open in new tab and copy link address all keep working.
 */
type ButtonProps =
  | (ButtonBase & { href?: undefined } & React.ButtonHTMLAttributes<HTMLButtonElement>)
  | (ButtonBase & { href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>);

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  full,
  className,
  children,
  ...rest
}: ButtonProps) {
  const cls = cx(
    "tap inline-flex items-center justify-center gap-2 transition-colors",
    R_CONTROL,
    BUTTON_TONES[variant],
    BUTTON_SIZES[size],
    full && "w-full",
    "disabled:cursor-not-allowed disabled:opacity-50",
    className,
  );
  const inner = (
    <>
      {icon && <span className="grid shrink-0 place-items-center [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      {children}
    </>
  );

  if ("href" in rest && rest.href) {
    const anchor = rest as React.AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a {...anchor} className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)} className={cls}>
      {inner}
    </button>
  );
}

/* ================================================================
   Form fields
   ================================================================ */

const CONTROL =
  "tap w-full border border-hair bg-canvas px-3 py-2.5 text-body-sm text-ink placeholder:text-dim focus:border-gold focus:outline-none disabled:opacity-50";

/**
 * Label, control, and whatever the person needs to know about it.
 *
 * Hint and error occupy the same slot and the error wins, because showing
 * both means the advice that was ignored sits next to the complaint about
 * ignoring it.
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-label uppercase tracking-[0.08em] text-muted">
        {label}
        {required && <span className="ml-1 text-gold">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-body-sm text-error">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-body-sm text-dim">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(CONTROL, R_CONTROL, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(CONTROL, R_CONTROL, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(CONTROL, R_CONTROL, props.className)} />;
}

/* ================================================================
   Chip
   ================================================================ */

const CHIP_TONES = {
  neutral: "border-hair text-muted",
  good: "border-green/40 text-green",
  warn: "border-gold/50 text-gold",
  bad: "border-error/40 text-error",
  info: "border-blue/40 text-blue",
} as const;

/** A status, small and readable at a glance. Never the only signal: colour
 *  alone fails anybody who cannot see the difference, so it carries text. */
export function Chip({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof CHIP_TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-label uppercase tracking-[0.06em]",
        CHIP_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

/* ================================================================
   Table
   ================================================================ */

/**
 * Composed rather than configured. A table driven by a column config always
 * meets the row that needs one custom cell, and then the config grows an
 * escape hatch and stops being simpler than the markup it replaced.
 *
 * The wrapper scrolls sideways on its own so a wide table never makes the
 * whole page scroll, which is the thing that breaks a layout on a phone.
 */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full border-collapse text-body-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
}: {
  children?: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cx(
        "whitespace-nowrap border-b border-hair pb-2.5 font-mono text-label font-medium uppercase tracking-[0.1em] text-dim",
        align === "right" ? "pl-4 text-right" : "pr-4 text-left",
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  strong,
}: {
  children?: ReactNode;
  align?: "left" | "right";
  /** the cell that identifies the row */
  strong?: boolean;
}) {
  return (
    <td
      className={cx(
        "border-b border-hair/60 py-3 align-top",
        align === "right" ? "pl-4 text-right tabular-nums" : "pr-4",
        strong ? "font-medium text-ink" : "text-muted",
      )}
    >
      {children}
    </td>
  );
}

/* ================================================================
   Empty state
   ================================================================ */

/**
 * What to show when there is nothing, which is the first thing most people
 * ever see on a screen. It says what would be here and how to make it
 * happen, because "No results" tells somebody they have failed without
 * telling them at what.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className={cx(R_CONTAINER, "border border-dashed border-hair bg-surface px-6 py-12 text-center")}>
      {icon && (
        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full border border-hair text-dim [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </div>
      )}
      <p className="text-body font-semibold text-ink">{title}</p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-[38ch] text-body-sm text-muted">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
    </div>
  );
}

/* ================================================================
   Tabs and toolbar
   ================================================================ */

/** Filters with counts, which is how the references let you see the shape of
 *  a list before opening it. The count is the useful half. */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string; count?: number }[];
  active: T;
  onChange: (k: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            className={cx(
              "tap inline-flex items-center gap-2 border px-3 py-1.5 text-body-sm transition-colors",
              R_CONTROL,
              on
                ? "border-chrome bg-chrome text-chrome-text"
                : "border-hair bg-surface text-muted hover:border-gold/50 hover:text-ink",
            )}
          >
            {t.label}
            {t.count != null && (
              <span
                className={cx(
                  "rounded-full px-1.5 font-mono text-label tabular-nums",
                  on ? "bg-chrome-2 text-chrome-muted" : "bg-hair/60 text-dim",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The row above a list: search on the left, controls on the right. */
export function Toolbar({ children, right }: { children?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      {right && <div className="flex shrink-0 flex-wrap gap-2">{right}</div>}
    </div>
  );
}

/* ================================================================
   Progress
   ================================================================ */

/** How far along something is. Carries its own number, because a bar without
 *  one makes people guess at a value we already know exactly. */
export function Progress({ percent, label }: { percent: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-body-sm text-muted">{label}</span>
          <span className="font-mono text-label tabular-nums text-dim">{pct}%</span>
        </div>
      )}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-hair"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-brand-gradient transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** A short run of label and value pairs, for the metadata block that sits at
 *  the top of a detail panel in every reference dashboard. */
export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-2.5">
      {items.map((f) => (
        <div key={f.label} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <dt className="min-w-[8.5rem] font-mono text-label uppercase tracking-[0.08em] text-dim">
            {f.label}
          </dt>
          <dd className="min-w-0 flex-1 text-body-sm text-ink">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
