import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";

/*
 * The region and VPN gate with a key set (audit, 15 September 2026).
 *
 * The bypass cookie must never hold the key: a cookie is copied by every
 * browser extension and support screenshot, and the same key used to sign
 * the VPN verdicts, so one leaked cookie handed over both. And a crawler's
 * user agent, which anyone can type, opens the marketing pages only.
 */

const OWNER = "owner-key-for-tests";
const TEAM = "team-key-for-tests";
const SITE = "https://www.ghlvideo.com";
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`${SITE}${path}`, { headers });
}

async function unlockWith(key: string) {
  const res = await proxy(request(`/unlock?key=${encodeURIComponent(key)}`));
  return { res, token: res.cookies.get("ghlv_pass")?.value ?? "" };
}

/* what the old scheme would have signed with: the key itself */
const signedWithKey = (msg: string) => createHmac("sha256", OWNER).update(msg).digest("hex");

/* Nothing in here may leave the process. The redirect lookup and the VPN
   check both go through fetch, so it is replaced for the whole file: the
   proxycheck answer is whatever the test set, everything else is a miss. */
let proxycheck: (ip: string) => Record<string, unknown> = () => ({ status: "ok" });
let proxycheckCalls = 0;
const realFetch = globalThis.fetch;

describe("the region and VPN gate", () => {
  before(() => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input);
      const m = url.match(/^https:\/\/proxycheck\.io\/v2\/([^?]+)/);
      if (m) {
        proxycheckCalls += 1;
        return new Response(JSON.stringify(proxycheck(m[1])), { status: 200 });
      }
      return new Response("", { status: 503 });
    }) as typeof fetch;
    process.env.ACCESS_BYPASS_KEY = OWNER;
    process.env.ACCESS_BYPASS_KEYS = ` ${TEAM} `;
    delete process.env.MAINTENANCE;
    delete process.env.PROXYCHECK_API_KEY;
  });
  after(() => {
    globalThis.fetch = realFetch;
    delete process.env.ACCESS_BYPASS_KEY;
    delete process.env.ACCESS_BYPASS_KEYS;
    delete process.env.PROXYCHECK_API_KEY;
  });

  test("the unlock link still sends the visitor home with a year-long cookie, and the cookie is not the key", async () => {
    const { res, token } = await unlockWith(OWNER);
    assert.equal(res.status, 307);
    assert.equal(res.headers.get("location"), `${SITE}/`);
    const cookie = res.cookies.get("ghlv_pass");
    assert.equal(cookie?.httpOnly, true);
    assert.equal(cookie?.maxAge, 60 * 60 * 24 * 365);
    assert.match(token, /^[0-9a-f]{64}$/);
    assert.notEqual(token, OWNER);
    assert.ok(!token.includes(OWNER));
  });

  test("a cookie holding the raw key no longer opens the door", async () => {
    const res = await proxy(request("/", { cookie: `ghlv_pass=${OWNER}`, "x-vercel-ip-country": "BD" }));
    assert.equal(res.status, 403);
    assert.match(await res.text(), /available in your region/);
  });

  test("the issued cookie opens the door from a blocked country, for the owner and for a teammate", async () => {
    const owner = (await unlockWith(OWNER)).token;
    const team = (await unlockWith(TEAM)).token;
    assert.notEqual(owner, team);
    for (const token of [owner, team]) {
      const res = await proxy(request("/portal/", { cookie: `ghlv_pass=${token}`, "x-vercel-ip-country": "BD" }));
      assert.equal(res.status, 200);
    }
  });

  test("a wrong key sets no cookie and meets the gate", async () => {
    const res = await proxy(request("/unlock?key=not-a-key", { "x-vercel-ip-country": "BD" }));
    assert.equal(res.status, 403);
    assert.equal(res.cookies.get("ghlv_pass"), undefined);
  });

  test("a crawler passes the marketing pages only", async () => {
    const bot = { "user-agent": GOOGLEBOT, "x-vercel-ip-country": "BD" };
    for (const path of ["/", "/premade/", "/blog/some-post/", "/highlevel-demo-video/"]) {
      assert.equal((await proxy(request(path, bot))).status, 200, path);
    }
    for (const path of ["/admin", "/admin/", "/portal/", "/partners/apply/", "/checkout/exp-004/", "/api/orders/abc"]) {
      const res = await proxy(request(path, bot));
      assert.equal(res.status, 403, path);
      assert.match(await res.text(), /available in your region/, path);
    }
  });

  test("the VPN verdict cookie is not signed with the key", async () => {
    process.env.PROXYCHECK_API_KEY = "pc-test";
    proxycheck = (ip) => ({ status: "ok", [ip]: { proxy: "yes" } });
    try {
      /* a verdict forged the old way, with the key as the secret, says "ok":
         if it were honoured the API would not be asked and the page would
         open. It is not, the API is asked, and the answer is the VPN page. */
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const forged = `ok.${exp}.${signedWithKey(`ok.${exp}.1.1.1.1`)}`;
      const before = proxycheckCalls;
      const res = await proxy(request("/", { cookie: `ghlv_chk=${forged}`, "x-forwarded-for": "1.1.1.1" }));
      assert.equal(res.status, 403);
      assert.match(await res.text(), /VPN or proxy/);
      assert.equal(proxycheckCalls, before + 1);

      /* and what the gate issues itself carries a different signature from
         the one the key would have produced */
      const fresh = await proxy(request("/", { "x-forwarded-for": "2.2.2.2" }));
      assert.equal(fresh.status, 403);
      const issued = fresh.cookies.get("ghlv_chk")?.value ?? "";
      const [verdict, expStr, sig] = issued.split(".");
      assert.equal(verdict, "vpn");
      assert.match(sig, /^[0-9a-f]{64}$/);
      assert.notEqual(sig, signedWithKey(`vpn.${expStr}.2.2.2.2`));
    } finally {
      delete process.env.PROXYCHECK_API_KEY;
    }
  });
});
