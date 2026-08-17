import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_BRAND_KIT, completeness, type BrandKit } from "@/lib/brand-kit";

/*
 * The brand kit's completeness rules.
 *
 * Worth testing carefully because this drives a nag badge in the portal, and
 * a nag that is wrong in either direction is expensive: one that fires on a
 * finished kit trains the client to ignore it, and one that stays quiet on an
 * empty kit means an order stalls with nobody knowing why.
 */

const kit = (over: Partial<BrandKit> = {}): BrandKit => ({ ...EMPTY_BRAND_KIT, ...over });

const FULL: Partial<BrandKit> = {
  brandName: "Nimbus CRM",
  logoPath: "abc/logo-1.png",
  primaryColor: "#0090FC",
  accentColor: "#00CC00",
  pronunciation: "NIM-bus",
  notes: "Keep it calm, no hard sell.",
};

describe("when a brand kit is ready to work from", () => {
  test("the three essentials are enough to start", () => {
    const c = completeness(kit({ brandName: "Nimbus CRM", logoPath: "a/l.png", primaryColor: "#0090FC" }));
    assert.equal(c.ready, true);
    assert.deepEqual(c.missing, []);
  });

  test("but it still offers what would make the video better", () => {
    const c = completeness(kit({ brandName: "Nimbus CRM", logoPath: "a/l.png", primaryColor: "#0090FC" }));
    assert.equal(c.couldAdd.length, 3);
    assert.ok(c.couldAdd.some((s) => /said out loud/i.test(s)));
  });

  test("a missing logo is named in words a client would use", () => {
    const c = completeness(kit({ brandName: "Nimbus CRM", primaryColor: "#0090FC" }));
    assert.equal(c.ready, false);
    assert.deepEqual(c.missing, ["Your logo"]);
  });

  test("nothing filled in reads as empty, not as broken", () => {
    const c = completeness(kit());
    assert.equal(c.empty, true);
    assert.equal(c.ready, false);
    assert.equal(c.percent, 0);
    assert.equal(c.missing.length, 3);
  });

  test("no kit at all behaves the same as an empty one", () => {
    // a client who has never ordered has no row, and that must not throw
    assert.deepEqual(completeness(null), completeness(kit()));
  });
});

describe("the progress number", () => {
  test("everything filled is a hundred", () => {
    assert.equal(completeness(kit(FULL)).percent, 100);
  });

  test("an unfinished kit can never round up to a hundred", () => {
    // the one that would lie: five of six is 83, and must not become 100
    const c = completeness(kit({ ...FULL, notes: null }));
    assert.ok(c.percent < 100, `showed ${c.percent}`);
    assert.equal(c.percent, 83);
  });

  test("the essentials alone are half the bar, which is honest", () => {
    // three of six. Not "nearly done", not "barely started"
    assert.equal(completeness(kit({ brandName: "N", logoPath: "a", primaryColor: "#fff" })).percent, 50);
  });
});

describe("what counts as filled in", () => {
  test("whitespace is not an answer", () => {
    const c = completeness(kit({ brandName: "   ", logoPath: "a/l.png", primaryColor: "#0090FC" }));
    assert.equal(c.ready, false);
    assert.deepEqual(c.missing, ["Your brand or product name"]);
  });

  test("an empty screenshot list is not held against anybody", () => {
    // screenshots are useful but never required, so they are in neither list
    const c = completeness(kit({ ...FULL, screenshotPaths: [] }));
    assert.equal(c.ready, true);
    assert.equal(c.percent, 100);
  });
});
