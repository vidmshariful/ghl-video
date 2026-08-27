import { aiPackClips } from "@/lib/content/premade";
/* Real recent client deliveries (white-labeled), shown on BOTH the sales LP
 * "Recently delivered" strip and the premade page's recent-deliveries section.
 * One source so the two never drift. Add a new delivery here and it appears on
 * both. (The ColeLab AI Receptionist cut is featured in the sales-LP
 * before/after, so it is intentionally not in this list.) */
export type Delivery = { src: string; poster: string | null; label: string; sub: string };

/*
 * The before and after pair: one cut of the AI Receptionist video shown twice,
 * brand-agnostic on the left and ColeLab's delivered version on the right.
 *
 * It lives here rather than on a page because it is the single strongest
 * proof a white-label offer has, and more than one landing page wants to make
 * that argument. Two copies of these urls would eventually disagree, and the
 * page that got it wrong would be showing two different videos side by side
 * and calling them the same one.
 */
export const whiteLabelProof = {
  poster: "/posters/ai-receptionist.jpg",
  generic: aiPackClips.receptionist,
  branded:
    "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a7a4dff03343f290f26b7de.mp4",
} as const;

export const recentDeliveries: Delivery[] = [
  {
    src: "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a7a3025a7433164043136cf.mp4",
    poster: null,
    label: "All-in-one + AI-First Positioning",
    sub: "ColeLab, white-labeled",
  },
  {
    src: "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a7a4c091635e466c1e310a5.mp4",
    poster: null,
    label: "AI Receptionist + Conversational AI",
    sub: "SPEEDMOBI, white-labeled",
  },
  {
    src: "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a7a4c098880872019f23ce4.mp4",
    poster: null,
    label: "AI Receptionist + Conversational AI",
    sub: "My Lead Hub, white-labeled",
  },
  {
    src: "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a7a4dff03343f290f26b7e8.mp4",
    poster: null,
    label: "Unified Inbox + Conversational AI",
    sub: "My Lead Hub, white-labeled",
  },
  {
    src: "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a7a4dff9994d35aa0a808ed.mp4",
    poster: null,
    label: "Reputation Management + Reviews AI",
    sub: "ColeLab, white-labeled",
  },
  {
    src: "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a7a63f0157190b359282bab.mp4",
    poster: null,
    label: "All-in-one + AI-First Positioning",
    sub: "SPEEDMOBI, white-labeled",
  },
];
