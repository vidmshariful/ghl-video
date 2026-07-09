import type { Metadata } from "next";
import localFont from "next/font/local";
import { Bricolage_Grotesque, Schibsted_Grotesk } from "next/font/google";
import { Hero } from "@/components/home/Hero";
import { SectionChip } from "@/components/SectionChip";

/*
 * FONT LAB (internal, noindex): every heading candidate rendered on
 * the real hero plus a real section header, each optically tuned per
 * face, so the choice is made on the actual design.
 */

export const metadata: Metadata = {
  title: "Font Lab",
  robots: { index: false, follow: false },
};

const clash = localFont({
  src: [
    { path: "./fonts/ClashDisplay-600.woff2", weight: "600" },
    { path: "./fonts/ClashDisplay-700.woff2", weight: "700" },
  ],
  variable: "--font-clash",
});

const cabinet = localFont({
  src: [
    { path: "./fonts/CabinetGrotesk-700.woff2", weight: "700" },
    { path: "./fonts/CabinetGrotesk-800.woff2", weight: "800" },
  ],
  variable: "--font-cabinet",
});

const satoshi = localFont({
  src: [
    { path: "./fonts/Satoshi-700.woff2", weight: "700" },
    { path: "./fonts/Satoshi-900.woff2", weight: "900" },
  ],
  variable: "--font-satoshi",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
});

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
});

/* per-face optical tuning: weight and tracking chosen per design, not
 * just swapped in */
const candidates = [
  {
    key: "baseline",
    name: "Space Grotesk (current)",
    varName: "var(--font-grotesk)",
    className: "",
    tune: {},
  },
  {
    key: "clash",
    name: "Clash Display",
    varName: "var(--font-clash)",
    className: clash.variable,
    tune: { letterSpacing: "-0.015em", fontWeight: 600 },
  },
  {
    key: "cabinet",
    name: "Cabinet Grotesk",
    varName: "var(--font-cabinet)",
    className: cabinet.variable,
    tune: { letterSpacing: "-0.02em", fontWeight: 800 },
  },
  {
    key: "bricolage",
    name: "Bricolage Grotesque",
    varName: "var(--font-bricolage)",
    className: bricolage.variable,
    tune: { letterSpacing: "-0.03em", fontWeight: 700 },
  },
  {
    key: "satoshi",
    name: "Satoshi",
    varName: "var(--font-satoshi)",
    className: satoshi.variable,
    tune: { letterSpacing: "-0.03em", fontWeight: 900 },
  },
  {
    key: "schibsted",
    name: "Schibsted Grotesk (wildcard)",
    varName: "var(--font-schibsted)",
    className: schibsted.variable,
    tune: { letterSpacing: "-0.03em", fontWeight: 700 },
  },
];

function SectionHeadingSample() {
  return (
    <div className="shell py-16 text-center">
      <SectionChip index={2} label="Services" accent="green" />
      <h2 className="mx-auto mt-6 max-w-[18ch] font-display text-h2 text-ink">
        Three ways to <span className="text-green">ship video.</span>
      </h2>
      <p className="mx-auto mt-4 max-w-[52ch] text-lede text-muted">
        Move fast with premade, go bespoke with custom, stay consistent with
        editing.
      </p>
    </div>
  );
}

export default function FontLab() {
  return (
    <div className="pb-32">
      {candidates.map((c) => (
        <div
          key={c.key}
          id={c.key}
          className={c.className}
          style={
            {
              "--font-grotesk": c.varName,
            } as React.CSSProperties
          }
        >
          <div className="shell pt-28 pb-4">
            <p className="inline-block rounded-[3px] border border-gold/40 bg-surface px-4 py-2 font-mono text-sm uppercase tracking-[0.14em] text-gold">
              {c.name}
            </p>
          </div>
          <div
            style={
              c.tune.letterSpacing || c.tune.fontWeight
                ? ({
                    ["--lab-ls" as string]: c.tune.letterSpacing ?? "inherit",
                    ["--lab-fw" as string]: String(c.tune.fontWeight ?? "inherit"),
                  } as React.CSSProperties)
                : undefined
            }
            className={c.key !== "baseline" ? "font-lab-tuned" : ""}
          >
            <Hero />
            <SectionHeadingSample />
          </div>
        </div>
      ))}
    </div>
  );
}
