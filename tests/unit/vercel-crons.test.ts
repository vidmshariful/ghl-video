import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
 * The site answers every path without a trailing slash with a 308 to the
 * slashed one (next.config: trailingSlash). Vercel's scheduler does not
 * follow redirects, so a cron path written without the slash never reaches
 * its handler. Found on 15 September 2026: the minute sync, the morning
 * sweep and the nightly checks had all been answered with a redirect.
 */
test("every cron path in vercel.json carries the trailing slash the site insists on", () => {
  const cfg = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as { crons: { path: string; schedule: string }[] };
  assert.ok(cfg.crons.length >= 5);
  for (const c of cfg.crons) {
    assert.match(c.path, /^\/api\/cron\/[a-z-]+\/$/, `${c.path} must start with /api/cron/ and end with /`);
    assert.match(c.schedule, /^[\d*\/,-]+( [\d*\/,-]+){4}$/, `${c.path} has an odd schedule`);
  }
});
