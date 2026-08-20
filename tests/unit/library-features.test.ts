import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LIBRARY_FEATURES,
  featureCounts,
  matchFeature,
  rowsToFeatures,
  slugifyFeatureKey,
} from "@/lib/library-features";

/*
 * The Filter by feature rail. The rules protect two things: an owner-typed
 * alias must never be able to break the public page, and a feature with
 * nothing behind it must never render as a dead filter.
 */

describe("matching", () => {
  test("an alias is a case-insensitive substring", () => {
    assert.equal(matchFeature("Reputation Management + Reviews AI", ["reputation"]), true);
    assert.equal(matchFeature("AI RECEPTIONIST", ["ai receptionist"]), true);
    assert.equal(matchFeature("Voice AI", ["reputation"]), false);
  });

  test("empty and whitespace aliases match nothing, not everything", () => {
    /* the dangerous direction: an accidental empty alias must not put every
       video under one feature */
    assert.equal(matchFeature("anything at all", []), false);
    assert.equal(matchFeature("anything at all", [""]), false);
    assert.equal(matchFeature("anything at all", ["   "]), false);
  });

  test("any one alias is enough", () => {
    assert.equal(matchFeature("Automated Review System", ["reputation", "review"]), true);
  });
});

describe("the rail", () => {
  const vids = [
    { t: "Reputation Manager" },
    { t: "Reputation Management + Reviews AI" },
    { t: "Voice AI" },
  ];
  const features = [
    { key: "rep", label: "Reputation & Reviews", aliases: ["reputation", "review"], active: true, sort: 0 },
    { key: "voice", label: "Voice AI", aliases: ["voice ai"], active: true, sort: 1 },
    { key: "ghost", label: "QR Builder", aliases: ["qr builder"], active: true, sort: 2 },
    { key: "off", label: "Hidden", aliases: ["voice"], active: false, sort: 3 },
  ];

  test("features with no matches never render", () => {
    const out = featureCounts(vids, (v) => v.t, features);
    assert.deepEqual(out.map((f) => f.key), ["rep", "voice"]);
  });

  test("switched off means gone, whatever it matches", () => {
    const out = featureCounts(vids, (v) => v.t, features);
    assert.ok(!out.some((f) => f.key === "off"));
  });

  test("biggest first", () => {
    const out = featureCounts(vids, (v) => v.t, features);
    assert.equal(out[0].key, "rep");
    assert.equal(out[0].count, 2);
  });
});

describe("rows from the database", () => {
  test("malformed rows are dropped, never thrown", () => {
    const out = rowsToFeatures([
      { key: "ok", label: "Fine", aliases: ["fine"], active: true, sort: 1 },
      { key: "", label: "no key" },
      { label: "no key at all" },
      "not even an object",
      null,
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].key, "ok");
  });

  test("rubbish in gives an empty list, which triggers the code fallback", () => {
    assert.deepEqual(rowsToFeatures(null), []);
    assert.deepEqual(rowsToFeatures("nope"), []);
  });
});

describe("housekeeping", () => {
  test("the fallback list has unique keys", () => {
    const keys = DEFAULT_LIBRARY_FEATURES.map((f) => f.key);
    assert.equal(new Set(keys).size, keys.length);
  });

  test("every fallback feature has at least one usable alias", () => {
    for (const f of DEFAULT_LIBRARY_FEATURES) {
      assert.ok(f.aliases.some((a) => a.trim().length > 0), `${f.key} has no alias`);
    }
  });

  test("hand-typed names become stable keys", () => {
    assert.equal(slugifyFeatureKey("QR Builder!"), "qr-builder");
    assert.equal(slugifyFeatureKey("  Voice  AI  "), "voice-ai");
    assert.equal(slugifyFeatureKey("!!!"), "");
  });
});
