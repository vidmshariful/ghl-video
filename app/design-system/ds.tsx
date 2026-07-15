import type { ReactNode } from "react";

/*
 * Local furniture for the design system page only. Deliberately plain:
 * this page documents the system, so nothing here should compete with
 * the specimens it is framing.
 */

export function DsSection({
  id,
  n,
  title,
  intro,
  children,
}: {
  id: string;
  n: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-hair pt-12">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-label uppercase text-gold [font-variant-numeric:tabular-nums]">
          {n}
        </span>
        <h2 className="font-display text-h2 text-ink">{title}</h2>
      </div>
      {intro && (
        <p className="mt-4 max-w-[var(--measure-body)] text-body leading-relaxed text-muted">
          {intro}
        </p>
      )}
      <div className="mt-10">{children}</div>
    </section>
  );
}

/* One specimen: a label, an optional note on where it is used, and the
 * live thing itself on the page's own ground. */
export function Specimen({
  name,
  usage,
  note,
  status,
  children,
}: {
  name: string;
  usage?: string;
  note?: string;
  status?: "current" | "proposed";
  children: ReactNode;
}) {
  return (
    <figure className="border-t border-hair py-10 first:border-t-0 first:pt-0">
      <figcaption className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-display text-h4 font-semibold text-ink">
            {name}
          </h3>
          {status && (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-label uppercase ${
                status === "proposed"
                  ? "border-gold/50 text-gold"
                  : "border-hair text-dim"
              }`}
            >
              {status}
            </span>
          )}
          {usage && (
            <span className="font-mono text-label uppercase text-dim">
              {usage}
            </span>
          )}
        </div>
        {note && (
          <p className="mt-2 max-w-[var(--measure-body)] text-body-sm leading-relaxed text-dim">
            {note}
          </p>
        )}
      </figcaption>
      {children}
    </figure>
  );
}

/* a bounded stage so a specimen reads as a specimen, not as page content */
export function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-hair bg-canvas p-8 md:p-10">
      {children}
    </div>
  );
}

export function SpecRow({
  k,
  v,
  extra,
}: {
  k: string;
  v: string;
  extra?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-hair py-3 first:border-t-0">
      <span className="font-mono text-body-sm text-muted">{k}</span>
      <span className="flex items-baseline gap-4">
        {extra && (
          <span className="font-mono text-label uppercase text-dim">
            {extra}
          </span>
        )}
        <span className="font-mono text-body-sm text-ink [font-variant-numeric:tabular-nums]">
          {v}
        </span>
      </span>
    </div>
  );
}
