/*
 * The three things the brief never asked for and the studio asked for by
 * email on every pack (Premade review, 16 September 2026): the website the
 * videos are for, the voiceover accent the site promised a choice of, and the
 * niche when niche customisation was bought. Shared by the brief form, its
 * route, the Brand Kit and the studio's view, so all four agree on the words.
 */

export const VOICE_ACCENTS = ["American", "British", "Australian", "No preference"] as const;
export type VoiceAccent = (typeof VOICE_ACCENTS)[number];

/** An accent from the fixed list, or empty for anything else. */
export function cleanAccent(v: unknown): VoiceAccent | "" {
  const s = String(v ?? "").trim();
  return (VOICE_ACCENTS as readonly string[]).includes(s) ? (s as VoiceAccent) : "";
}

export const WEBSITE_MAX = 200;
export const NICHE_MAX = 400;

/**
 * A website the way a person types it, made into an address: "speedmobi.com"
 * becomes "https://speedmobi.com". Empty when it is not an address at all,
 * so the caller can refuse it with a plain sentence.
 */
export function normalizeWebsite(v: unknown): string {
  let s = String(v ?? "").trim().slice(0, WEBSITE_MAX);
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (!/^https?:$/.test(u.protocol)) return "";
    if (!u.hostname.includes(".") || /\s/.test(u.hostname)) return "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}
