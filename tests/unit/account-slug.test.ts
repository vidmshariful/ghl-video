import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { freeSlug, slugStem, slugWithSuffix } from "@/lib/account-slug";

describe("account slugs", () => {
  test("company first, then name, then the email's local part", () => {
    assert.equal(slugStem("Extendly", "Beant Singh", "bsingh@getextendly.com"), "extendly");
    assert.equal(slugStem("", "Beant Singh | Extendly", "x@y.com"), "beant-singh-extendly");
    assert.equal(slugStem(null, null, "jordan@evokemarketinggroup.com"), "jordan");
  });

  test("punctuation collapses to single hyphens and the ends are trimmed", () => {
    assert.equal(slugStem("HighLevel, Inc.", null, "chase@gohighlevel.com"), "highlevel-inc");
    assert.equal(slugStem("  --  ", null, "a@b.com"), "a");
  });

  test("the second client on the same stem gets a number", () => {
    assert.equal(slugWithSuffix("extendly", 1), "extendly");
    assert.equal(slugWithSuffix("extendly", 2), "extendly-2");
    assert.equal(freeSlug("extendly", ["extendly", "extendly-2"]), "extendly-3");
    assert.equal(freeSlug("extendly", []), "extendly");
  });
});
