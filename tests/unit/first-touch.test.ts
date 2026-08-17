import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildFirstTouch,
  describeFirstTouch,
  encodeFirstTouch,
  firstTouchFromCookieHeader,
  isRecordableLanding,
} from "@/lib/first-touch";

/*
 * Where a buyer came from.
 *
 * This is worth testing for an unusual reason: it is write-only for months at
 * a time. Nothing reads it back until there are enough orders to see a
 * pattern, so a break would sit there silently recording nothing and the only
 * symptom would be an empty report next year, long after the traffic that
 * would have filled it.
 *
 * The round trip in particular has already been wrong once: the cookie was
 * encoded here AND by the cookie setter, and the double-encoded value could
 * not be parsed back. That is the test below.
 */

const params = (q = "") => new URLSearchParams(q);

describe("what gets recorded on a first visit", () => {
  test("the landing page, without its query string", () => {
    const ft = buildFirstTouch("/premade/?utm_campaign=x", null, params());
    assert.equal(ft.path, "/premade/");
  });

  test("a referring host, tidied to its bare domain", () => {
    const ft = buildFirstTouch("/", "https://www.google.com/search?q=highlevel", params());
    assert.equal(ft.referrer, "google.com");
  });

  test("our own pages are not a referral source", () => {
    // otherwise every internal click would look like a fresh discovery
    const ft = buildFirstTouch("/premade/", "https://www.ghlvideo.com/blog/", params());
    assert.equal(ft.referrer, null);
  });

  test("no referrer means direct, not an error", () => {
    assert.equal(buildFirstTouch("/", null, params()).referrer, null);
    assert.equal(buildFirstTouch("/", "not-a-url", params()).referrer, null);
  });

  test("a campaign is taken from utm_campaign, then utm_source, then gclid", () => {
    assert.equal(buildFirstTouch("/", null, params("utm_campaign=summer")).campaign, "summer");
    assert.equal(buildFirstTouch("/", null, params("utm_source=newsletter")).campaign, "newsletter");
    assert.equal(buildFirstTouch("/", null, params("gclid=abc123")).campaign, "abc123");
    assert.equal(buildFirstTouch("/", null, params()).campaign, null);
  });

  test("a stranger cannot smuggle anything through these fields", () => {
    // every value here comes off a URL or a header somebody else controls
    const ft = buildFirstTouch(
      "/<script>alert(1)</script>",
      null,
      params("utm_campaign=%3Cimg+onerror%3D1%3E"),
    );
    assert.ok(!ft.path.includes("<"), `path kept a bracket: ${ft.path}`);
    assert.ok(!(ft.campaign ?? "").includes("<"), `campaign kept a bracket: ${ft.campaign}`);
  });

  test("an absurdly long path is capped rather than stored whole", () => {
    const ft = buildFirstTouch("/" + "a".repeat(500), null, params());
    assert.ok(ft.path.length <= 160, `path was ${ft.path.length} long`);
  });
});

describe("the cookie survives the round trip", () => {
  test("what goes in comes back out", () => {
    const ft = buildFirstTouch("/blog/why-video/", "https://google.com/", params("utm_source=x"));
    const back = firstTouchFromCookieHeader(`ghlv_ft=${encodeFirstTouch(ft)}`);
    assert.deepEqual(back, ft);
  });

  test("and survives being percent-encoded on the way, as a real cookie is", () => {
    // the bug that already happened: encoded here AND by the cookie setter,
    // producing a value that could not be read back
    const ft = buildFirstTouch("/premade/", "https://google.com/", params("utm_campaign=summer"));
    const asBrowserSendsIt = encodeURIComponent(encodeFirstTouch(ft));
    const back = firstTouchFromCookieHeader(`ghlv_ft=${asBrowserSendsIt}`);
    assert.deepEqual(back, ft);
  });

  test("it is found among other cookies, not only alone", () => {
    const ft = buildFirstTouch("/", null, params());
    const header = `_ga=GA1.1.99; ghlv_ft=${encodeFirstTouch(ft)}; ghlv_ref=jonah`;
    assert.equal(firstTouchFromCookieHeader(header)?.path, "/");
  });

  test("nonsense in the cookie is ignored rather than thrown", () => {
    assert.equal(firstTouchFromCookieHeader("ghlv_ft=not-json"), null);
    assert.equal(firstTouchFromCookieHeader("ghlv_ft="), null);
    assert.equal(firstTouchFromCookieHeader(null), null);
    assert.equal(firstTouchFromCookieHeader("_ga=1"), null);
  });
});

describe("which pages count as finding us", () => {
  test("real pages do", () => {
    for (const p of ["/", "/premade/", "/blog/why-video/", "/lp/white-label-videos/"]) {
      assert.equal(isRecordableLanding(p), true, p);
    }
  });

  test("checkout and the portals do not", () => {
    // somebody deep-linked into checkout did not discover us there, and
    // crediting it would make the checkout page look like our best marketing
    for (const p of ["/checkout/exp-004/", "/admin/orders/", "/portal/", "/partners/", "/api/x"]) {
      assert.equal(isRecordableLanding(p), false, p);
    }
  });

  test("a page merely starting with the same letters still counts", () => {
    // /partnership-terms is not /partners
    assert.equal(isRecordableLanding("/partnership-terms/"), true);
  });
});

describe("how it reads on the order screen", () => {
  const at = Math.floor(Date.parse("2026-08-01T00:00:00Z") / 1000);

  test("google is named plainly", () => {
    const line = describeFirstTouch({ path: "/premade/", referrer: "google.com", campaign: null, at });
    assert.match(line, /First landed on \/premade\//);
    assert.match(line, /from Google/);
  });

  test("no referrer is explained, not left blank", () => {
    const line = describeFirstTouch({ path: "/", referrer: null, campaign: null, at });
    assert.match(line, /typed the address/);
  });

  test("the gap to buying is counted in days, and reads properly at one", () => {
    const one = describeFirstTouch(
      { path: "/", referrer: null, campaign: null, at },
      "2026-08-02T00:00:00Z",
    );
    assert.match(one, /1 day before ordering/);
    const many = describeFirstTouch(
      { path: "/", referrer: null, campaign: null, at },
      "2026-08-15T00:00:00Z",
    );
    assert.match(many, /14 days before ordering/);
  });

  test("buying the same day says so rather than showing zero days", () => {
    const line = describeFirstTouch(
      { path: "/", referrer: null, campaign: null, at },
      "2026-08-01T06:00:00Z",
    );
    assert.match(line, /ordered the same day/);
  });
});
