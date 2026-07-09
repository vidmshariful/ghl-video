import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionChip } from "@/components/SectionChip";
import { legalDocs } from "@/lib/legal";

export function generateStaticParams() {
  return Object.keys(legalDocs).map((doc) => ({ doc }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ doc: string }>;
}): Promise<Metadata> {
  const { doc } = await params;
  return {
    title: legalDocs[doc]?.title ?? "Legal",
    description: `GHL Video ${legalDocs[doc]?.title ?? "legal document"}.`,
  };
}

/*
 * Legal document layout: quiet reading page in the blueprint frame.
 * Content is ported verbatim from the live site (see lib/legal.ts for
 * the entity-name flag).
 */
export default async function LegalPage({
  params,
}: {
  params: Promise<{ doc: string }>;
}) {
  const { doc } = await params;
  const data = legalDocs[doc];
  if (!data) notFound();

  return (
    <>
      {/* the title block stays on the dark ground (hero rule) */}
      <section data-bp-idx="1" className="relative pt-32 md:pt-36">
        <div className="shell pb-12 text-center">
          <SectionChip index={1} label="Legal" />
          <h1 className="mx-auto mt-7 font-display text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.02] tracking-[-0.025em] text-ink">
            {data.title}
          </h1>
          {data.effective && (
            <p className="mt-4 font-mono text-label uppercase text-dim">
              {data.effective}
            </p>
          )}
        </div>
        <div aria-hidden="true" className="h-px w-full bg-hair" />
      </section>

      {/* the document reads on paper */}
      <div className="theme-light">
        <section className="relative py-16 md:py-20">
          <div className="shell">
            <div className="mx-auto max-w-3xl">
              <div className="grid gap-10">
            {data.sections.map((section, i) => (
              <section key={`${section.h}-${i}`}>
                {section.h && (
                  <h2 className="font-display text-[1.25rem] font-semibold tracking-[-0.01em] text-ink">
                    {section.h}
                  </h2>
                )}
                <div className="mt-4 grid gap-3.5">
                  {section.items.map((item, j) =>
                    item.t === "li" ? (
                      <p
                        key={j}
                        className="flex gap-3 text-[0.9375rem] leading-relaxed text-muted"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-[0.55em] h-px w-3 shrink-0 bg-dim"
                        />
                        {item.text}
                      </p>
                    ) : (
                      <p
                        key={j}
                        className="max-w-[70ch] text-[0.9375rem] leading-relaxed text-muted"
                      >
                        {item.text}
                      </p>
                    ),
                  )}
                </div>
              </section>
            ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
