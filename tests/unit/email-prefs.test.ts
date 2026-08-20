import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORY_FOR,
  EMAIL_CATEGORIES,
  mayEmail,
  sanitizePrefs,
} from "@/lib/email/prefs";

/*
 * Who gets emailed what. Both failure directions are bad and one is illegal
 * in some of the places we sell: send what somebody switched off and they
 * stop trusting the switch, hold back an invoice and they do not know they
 * owe us money.
 */

describe("what may be sent", () => {
  test("an email with no category always sends", () => {
    /* invoices, price changes, logins: not a choice on purpose */
    assert.equal(mayEmail("subscription_price_changed", { progress: false, offers: false }), true);
    assert.equal(mayEmail("order_confirmation", { progress: false }), true);
    assert.equal(mayEmail("team_invite", {}), true);
  });

  test("switching a category off holds back its emails", () => {
    assert.equal(mayEmail("video_ready", { progress: false }), false);
    assert.equal(mayEmail("order_delivered", { progress: false }), false);
  });

  test("switching one off leaves the other alone", () => {
    assert.equal(mayEmail("video_ready", { offers: false }), true);
  });

  test("no preferences at all means everything sends", () => {
    /* a category added next year must not arrive switched off for everybody
       who signed up before it existed */
    assert.equal(mayEmail("video_ready", null), true);
    assert.equal(mayEmail("video_ready", {}), true);
    assert.equal(mayEmail("video_ready", undefined), true);
  });
});

describe("what we will store", () => {
  test("unknown keys and non-booleans are dropped", () => {
    assert.deepEqual(
      sanitizePrefs({ progress: false, nonsense: true, offers: "no" }),
      { progress: false },
    );
  });

  test("rubbish in gives an empty object, never a throw", () => {
    assert.deepEqual(sanitizePrefs(null), {});
    assert.deepEqual(sanitizePrefs("progress"), {});
    assert.deepEqual(sanitizePrefs(42), {});
  });
});

describe("the two lists agree", () => {
  test("every category an email points at is one we offer", () => {
    const offered = new Set(EMAIL_CATEGORIES.map((c) => c.key));
    for (const [key, category] of Object.entries(CATEGORY_FOR)) {
      assert.ok(
        offered.has(category),
        `"${key}" is filed under "${category}", which no switch controls, so it could never be turned off`,
      );
    }
  });

  test("every switch controls at least one email", () => {
    /* a switch that changes nothing is a lie told in a settings screen */
    for (const c of EMAIL_CATEGORIES) {
      assert.ok(
        Object.values(CATEGORY_FOR).includes(c.key),
        `"${c.key}" is offered but no email uses it`,
      );
    }
  });
});
