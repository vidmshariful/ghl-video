import { HeroReviewer } from "@/components/home/HeroReviewer";
import { featuredTestimonial as t } from "@/lib/site";

/*
 * Chase Buckner (HighLevel) as the small hero avatar-review row. One
 * source of truth for the reviewer used in every hero (home + the three
 * service pages), so his clip and words never drift between them.
 */
export function ChaseHeroReviewer() {
  return (
    <HeroReviewer
      name={t.name}
      quote={t.heroQuote}
      source={t.heroSource}
      video={t.src}
      poster={t.poster}
    />
  );
}
