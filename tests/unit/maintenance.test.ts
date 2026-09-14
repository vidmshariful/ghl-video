import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";

/*
 * The maintenance switch answers everything with one page and a 503, the
 * payment webhook and the crons included, and answers nothing that way when
 * the switch is off.
 */

const paths = ["/", "/portal/", "/admin/", "/checkout/exp-004/", "/api/webhooks/stripe", "/api/cron/hl-sync/"];

test("MAINTENANCE=on closes every door with a 503 and the moving page", async () => {
  process.env.MAINTENANCE = "on";
  try {
    for (const path of paths) {
      const res = await proxy(new NextRequest(`https://www.ghlvideo.com${path}`));
      assert.equal(res.status, 503, path);
      assert.equal(res.headers.get("retry-after"), "900", path);
      assert.equal(res.headers.get("cache-control"), "no-store", path);
      const html = await res.text();
      assert.match(html, /moving to a faster home/, path);
      assert.match(html, /hi@ghlvideo\.com/, path);
    }
  } finally {
    delete process.env.MAINTENANCE;
  }
});

test("with the switch off, the payment webhook passes straight through", async () => {
  delete process.env.MAINTENANCE;
  const res = await proxy(new NextRequest("https://www.ghlvideo.com/api/webhooks/stripe"));
  assert.notEqual(res.status, 503);
});
