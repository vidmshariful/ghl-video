import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  campaignHref,
  isLive,
  matchesAudience,
  pickCampaign,
  type Campaign,
  type Viewer,
} from "@/lib/campaigns";

/*
 * Offer selection. Every case here is one somebody could hit on a Tuesday and
 * nobody would notice for a month: an expired offer still showing, a "we miss
 * you" message going to a client who bought yesterday, or worse, to somebody
 * who has never bought anything at all.
 */

const NOW = new Date("2026-08-17T12:00:00Z");

const base: Campaign = {
  id: "aaaaaaaa-0000-0000-0000-000000000001",
  title: "Three more explainers, 20 percent off",
  body: null,
  ctaLabel: "See the offer",
  targetSku: "fexp-031",
  targetPath: null,
  couponCode: "COMEBACK20",
  audience: "all",
  dormantDays: 90,
  startsAt: null,
  endsAt: null,
  priority: 0,
  active: true,
  clickCount: 0,
};

const make = (over: Partial<Campaign>): Campaign => ({ ...base, ...over });

const never: Viewer = { paidOrders: 0, lastOrderAt: null };
const fresh: Viewer = { paidOrders: 2, lastOrderAt: "2026-08-10T00:00:00Z" }; // a week ago
const gone: Viewer = { paidOrders: 3, lastOrderAt: "2026-01-05T00:00:00Z" }; // 7 months

describe("whether an offer is live at all", () => {
  test("switched off is never live", () => {
    assert.equal(isLive(make({ active: false }), NOW), false);
  });

  test("not started yet is not live", () => {
    assert.equal(isLive(make({ startsAt: "2026-09-01T00:00:00Z" }), NOW), false);
  });

  test("finished is not live, and the end moment counts as over", () => {
    assert.equal(isLive(make({ endsAt: "2026-08-01T00:00:00Z" }), NOW), false);
    assert.equal(isLive(make({ endsAt: NOW.toISOString() }), NOW), false);
  });

  test("inside its window is live", () => {
    assert.equal(
      isLive(make({ startsAt: "2026-08-01T00:00:00Z", endsAt: "2026-09-01T00:00:00Z" }), NOW),
      true,
    );
  });

  test("no dates means always live while switched on", () => {
    assert.equal(isLive(base, NOW), true);
  });
});

describe("who an offer is aimed at", () => {
  test("all reaches everybody", () => {
    for (const v of [never, fresh, gone]) {
      assert.equal(matchesAudience(make({ audience: "all" }), v, NOW), true);
    }
  });

  test("customers means somebody who has actually paid", () => {
    const c = make({ audience: "customers" });
    assert.equal(matchesAudience(c, never, NOW), false);
    assert.equal(matchesAudience(c, fresh, NOW), true);
  });

  test("prospects means somebody who never has", () => {
    const c = make({ audience: "prospects" });
    assert.equal(matchesAudience(c, never, NOW), true);
    assert.equal(matchesAudience(c, fresh, NOW), false);
  });

  test("dormant needs a past order AND enough silence", () => {
    const c = make({ audience: "dormant", dormantDays: 90 });
    assert.equal(matchesAudience(c, gone, NOW), true);
    assert.equal(matchesAudience(c, fresh, NOW), false, "bought a week ago is not dormant");
  });

  test("somebody who never bought is never dormant, only a prospect", () => {
    /* the embarrassing one: a we-miss-you offer to a stranger */
    const c = make({ audience: "dormant", dormantDays: 7 });
    assert.equal(matchesAudience(c, never, NOW), false);
  });

  test("the dormant threshold is respected exactly", () => {
    const v: Viewer = { paidOrders: 1, lastOrderAt: "2026-07-18T12:00:00Z" }; // 30 days
    assert.equal(matchesAudience(make({ audience: "dormant", dormantDays: 30 }), v, NOW), true);
    assert.equal(matchesAudience(make({ audience: "dormant", dormantDays: 31 }), v, NOW), false);
  });
});

describe("picking exactly one", () => {
  test("nothing fitting means nothing shown", () => {
    assert.equal(pickCampaign([make({ active: false })], fresh, NOW), null);
    assert.equal(pickCampaign([], fresh, NOW), null);
  });

  test("higher priority wins", () => {
    const low = make({ id: "a", priority: 0 });
    const high = make({ id: "b", priority: 5 });
    assert.equal(pickCampaign([low, high], fresh, NOW)?.id, "b");
  });

  test("on a tie the aimed offer beats the general one", () => {
    const general = make({ id: "a", audience: "all" });
    const aimed = make({ id: "b", audience: "dormant", dormantDays: 90 });
    assert.equal(pickCampaign([general, aimed], gone, NOW)?.id, "b");
  });

  test("an offer this person is not the audience for is skipped entirely", () => {
    const aimed = make({ id: "b", audience: "dormant", priority: 99 });
    const general = make({ id: "a", audience: "all", priority: 0 });
    /* the dormant one outranks it, but this person bought last week */
    assert.equal(pickCampaign([aimed, general], fresh, NOW)?.id, "a");
  });

  test("the choice is stable when everything else ties", () => {
    const one = make({ id: "aaa" });
    const two = make({ id: "bbb" });
    assert.equal(pickCampaign([two, one], fresh, NOW)?.id, "aaa");
    assert.equal(pickCampaign([one, two], fresh, NOW)?.id, "aaa");
  });
});

describe("where the button goes", () => {
  test("a sku becomes a checkout link carrying the coupon", () => {
    assert.equal(campaignHref(base), "/checkout/fexp-031/?code=COMEBACK20");
  });

  test("no coupon means a plain checkout link", () => {
    assert.equal(campaignHref(make({ couponCode: null })), "/checkout/fexp-031/");
  });

  test("a sku is lowercased, because that is what the route expects", () => {
    assert.equal(
      campaignHref(make({ targetSku: "PACK-001", couponCode: null })),
      "/checkout/pack-001/",
    );
  });

  test("a path is used as given when there is no sku", () => {
    assert.equal(
      campaignHref(make({ targetSku: null, targetPath: "/portal/library/" })),
      "/portal/library/",
    );
  });
});
