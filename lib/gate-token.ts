import { createHmac } from "node:crypto";

/*
 * The team bypass cookie holds a token, never the key (proxy.ts, since the
 * audit of 15 September 2026). Node callers that need to present it, like
 * the SEO audit fetching the sitemap through the gate, mint the same token
 * the edge mints: HMAC-SHA256 keyed with the bypass key over this label.
 * The label must stay identical to PASS_LABEL in proxy.ts.
 */
export const PASS_LABEL = "ghlv-pass.v2";

export function passToken(key: string): string {
  return createHmac("sha256", key).update(PASS_LABEL).digest("hex");
}
