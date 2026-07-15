import { Reveal, RevealItem } from "@/components/Reveal";
import { SectionChip } from "@/components/SectionChip";

/*
 * The recurring section header: numbered chip, display headline with
 * one accented phrase, optional intro line. One component so every
 * page speaks the same blueprint language.
 */
export function SectionHead({
  index,
  chip,
  headline,
  accent,
  intro,
  center = false,
}: {
  index: number;
  chip: string;
  headline: string;
  accent: string;
  intro?: string;
  center?: boolean;
}) {
  return (
    <Reveal className={center ? "text-center" : ""}>
      <RevealItem>
        <SectionChip index={index} label={chip} />
        <h2
          className={`mt-6 max-w-[24ch] font-display text-h2 text-ink ${
            center ? "mx-auto" : ""
          }`}
        >
          {headline}{" "}
          <span className="text-gradient">{accent}</span>
        </h2>
        {intro && (
          <p
            className={`mt-5 max-w-[var(--measure-lede)] text-lede text-muted ${
              center ? "mx-auto" : ""
            }`}
          >
            {intro}
          </p>
        )}
      </RevealItem>
    </Reveal>
  );
}
