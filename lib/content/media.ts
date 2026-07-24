/* ------------------------------------------------------------------ */
/* Media assets                                                         */
/* ------------------------------------------------------------------ */

/* Placeholder clips on the LeadConnector CDN. Finals swap in here with
 * no layout change. NOTE: clips 3 and 4 are heavy masters (220MB and
 * 611MB); fine as hover-streamed placeholders, but compress the finals
 * before launch. */
export const clips = {
  /* reel is unwired for now: the hero is an abstract atmosphere until
   * a real showreel exists (client call, this pass) */
  reel: "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a09af05dbe569a25d999f9f.mp4",
  featured:
    "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/69abf862b003fa1d8009b203.mp4",
  sampleA:
    "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/69ac030ab003fa4f250a8483.mp4",
  sampleB:
    "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/69a5aa2c753f15417fa8fbe1.mp4",
  sampleC:
    "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6984930e1dfc023b2d7fb5b4.mp4",
  /* a real premade (the AI-first master explainer) for the premade
   * service panel, so the homepage previews actual product */
  premadeNew:
    "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a54fdf79c9b37b5fd24a140.mp4",
} as const;

export const posters = {
  reel: "/posters/clip-1.jpg",
  featured: "/posters/clip-2.jpg",
  sampleA: "/posters/clip-3.jpg",
  sampleB: "/posters/clip-4.jpg",
  sampleC: "/posters/clip-5.jpg",
  premadeNew: "/posters/ai-master.jpg",
} as const;

/* Curated ambient-loop windows per clip: every frame that plays a clip
 * loops inside its window, so title cards and blank intros never show.
 * The lightbox always plays the full clip from the start. */
export const clipWindows: Partial<
  Record<keyof typeof clips, { startAt: number; endAt?: number }>
> = {
  featured: { startAt: 45, endAt: 53.5 },
  sampleA: { startAt: 73, endAt: 76 },
};
