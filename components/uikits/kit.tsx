import type { ReactNode } from "react";

/*
 * Chrome for the dev UI kit. Every colour here comes from a --kit-* variable
 * declared in the [data-surface="uikit"] block in globals.css, and from
 * nowhere else. The kit renders a site button beside a portal card beside a
 * checkout panel, so its own furniture has to sit outside all four skins:
 * if the kit used --card or --hair, restyling the portal would restyle the
 * ruler you were measuring the portal with.
 */

export function KitPage({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[76rem] px-6 py-10">
      <h1 className="font-display text-[2rem] font-semibold tracking-tight text-[var(--kit-text)]">
        {title}
      </h1>
      {lede ? (
        <p className="mt-3 max-w-[68ch] text-[0.9375rem] leading-relaxed text-[var(--kit-dim)]">
          {lede}
        </p>
      ) : null}
      <div className="mt-10 flex flex-col gap-14">{children}</div>
    </div>
  );
}

export function KitSection({
  id,
  title,
  count,
  note,
  children,
}: {
  id?: string;
  title: string;
  /* shown beside the heading: how many things this section covers */
  count?: number | string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-baseline gap-3 border-b border-[var(--kit-line)] pb-2">
        <h2 className="font-display text-[1.0625rem] font-semibold tracking-tight text-[var(--kit-text)]">
          {title}
        </h2>
        {count !== undefined ? (
          <span className="text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--kit-dim)] tabular-nums">
            {count}
          </span>
        ) : null}
      </div>
      {note ? (
        <p className="mt-3 max-w-[72ch] text-[0.8125rem] leading-relaxed text-[var(--kit-dim)]">
          {note}
        </p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/*
 * One specimen. `surface` stamps the real data-surface wrapper so the thing
 * inside picks up its production skin; leave it off for anything that lives
 * on the main site, which is what :root already carries.
 */
export function Spec({
  label,
  code,
  surface,
  ground = "panel",
  children,
}: {
  label: string;
  /* the call site, so the kit doubles as copy-paste documentation */
  code?: string;
  surface?: "portal" | "checkout" | "sales";
  /* `canvas` renders the specimen on the surface's own page background */
  ground?: "panel" | "canvas";
  children: ReactNode;
}) {
  const body = (
    <div
      className={`flex flex-wrap items-center gap-4 p-5 ${
        ground === "canvas" ? "bg-canvas" : ""
      }`}
    >
      {children}
    </div>
  );

  return (
    <figure className="overflow-hidden rounded-[4px] border border-[var(--kit-line)] bg-[var(--kit-panel)]">
      <figcaption className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--kit-line)] px-4 py-2">
        <span className="text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--kit-text)]">
          {label}
        </span>
        {surface ? (
          <span className="rounded-[3px] border border-[var(--kit-line)] px-2 py-0.5 text-[0.625rem] tracking-[0.1em] text-[var(--kit-accent)]">
            data-surface=&quot;{surface}&quot;
          </span>
        ) : null}
      </figcaption>
      {surface === "sales" ? (
        <div data-surface="sales" className="sp">
          {body}
        </div>
      ) : surface ? (
        <div data-surface={surface}>{body}</div>
      ) : (
        body
      )}
      {code ? (
        <pre className="overflow-x-auto border-t border-[var(--kit-line)] px-4 py-2.5 text-[0.75rem] leading-relaxed text-[var(--kit-dim)]">
          <code>{code}</code>
        </pre>
      ) : null}
    </figure>
  );
}

export function SpecGrid({
  cols = 2,
  children,
}: {
  cols?: 1 | 2 | 3;
  children: ReactNode;
}) {
  const at = { 1: "", 2: "md:grid-cols-2", 3: "md:grid-cols-2 lg:grid-cols-3" };
  return <div className={`grid grid-cols-1 gap-4 ${at[cols]}`}>{children}</div>;
}

/* A flagged observation. `tone` warn = something that will break a restyle. */
export function Note({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn";
  children: ReactNode;
}) {
  const accent = tone === "warn" ? "var(--kit-warn)" : "var(--kit-accent)";
  return (
    <div
      className="rounded-[4px] border border-[var(--kit-line)] bg-[var(--kit-panel)] p-4 text-[0.8125rem] leading-relaxed text-[var(--kit-dim)]"
      style={{ borderLeft: `2px solid ${accent}` }}
    >
      {children}
    </div>
  );
}

/* Dense reference table: the inventory pages are mostly these. */
export function KitTable({
  head,
  rows,
}: {
  head: readonly string[];
  rows: readonly (readonly ReactNode[])[];
}) {
  return (
    <div className="overflow-x-auto rounded-[4px] border border-[var(--kit-line)]">
      <table className="w-full border-collapse text-left text-[0.8125rem]">
        <thead>
          <tr className="bg-[var(--kit-panel)]">
            {head.map((h, i) => (
              <th
                key={i}
                className="whitespace-nowrap border-b border-[var(--kit-line)] px-4 py-2.5 text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--kit-dim)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[var(--kit-line)] last:border-0">
              {r.map((cell, j) => (
                <td
                  key={j}
                  className={`px-4 py-2.5 align-top ${
                    j === 0
                      ? "whitespace-nowrap font-semibold text-[var(--kit-text)]"
                      : "text-[var(--kit-dim)]"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
