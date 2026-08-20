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
  logoDarkPath: "abc/logo-dark.png",
  logoLightPath: "abc/logo-light.png",
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
    assert.equal(c.couldAdd.length, 4);
    assert.ok(c.couldAdd.some((s) => /said out loud/i.test(s)));
    // one uploaded logo is enough to start, and the other face is offered
    assert.ok(c.couldAdd.some((s) => /other face/i.test(s)));
  });

  test("either face of the logo satisfies the requirement", () => {
    for (const slot of ["logoPath", "logoDarkPath", "logoLightPath"] as const) {
      const c = completeness(kit({ brandName: "N", primaryColor: "#fff", [slot]: "a/l.png" }));
      assert.equal(c.ready, true, `${slot} should count as a logo`);
    }
  });

  test("both faces together stop being offered as missing", () => {
    const c = completeness(kit({ logoDarkPath: "a/d.png", logoLightPath: "a/w.png" }));
    assert.ok(!c.couldAdd.some((s) => /other face/i.test(s)));
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
    // the one that would lie: everything but notes must not become 100
    const c = completeness(kit({ ...FULL, notes: null }));
    assert.ok(c.percent < 100, `showed ${c.percent}`);
    assert.equal(c.percent, 87);
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

  test("guideline files are paperwork, not progress", () => {
    // same standing as screenshots: never nagged, never scored
    const bare = completeness(kit(FULL));
    const withDocs = completeness(
      kit({ ...FULL, guidelineFiles: [{ path: "a/b.pdf", name: "brand.pdf", size: 100 }] }),
    );
    assert.equal(bare.percent, withDocs.percent);
    assert.ok(!bare.couldAdd.some((s) => /guideline/i.test(s)));
  });
});
