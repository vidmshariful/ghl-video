import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ALWAYS_SENT,
  CATEGORY_FOR,
  EMAIL_CATEGORIES,
  mayEmail,
  sanitizePrefs,
} from "@/lib/email/prefs";
import { DEFAULT_TEMPLATES } from "@/lib/email/templates";
import { emailAudience } from "@/lib/comms";

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

describe("every client email is a decision", () => {
  /* the team's own alerts are not the client's to switch off, so they sit
     outside this check */
  const OURS = new Set(["team", "owner", "producer"]);
  const templateKeys = DEFAULT_TEMPLATES.map((t) => t.key);
  const clientFacing = templateKeys.filter((key) => {
    const audience = emailAudience(key);
    return audience !== null && !OURS.has(audience);
  });

  test("each one has a category or is named as always sent", () => {
    assert.ok(clientFacing.length > 10, "the registry should know most templates as client emails");
    for (const key of clientFacing) {
      assert.ok(
        key in CATEGORY_FOR || key in ALWAYS_SENT,
        `"${key}" is sent to clients but nobody decided whether it is a choice: file it under a category in CATEGORY_FOR, or name it in ALWAYS_SENT with the reason`,
      );
    }
  });

  test("none is both a choice and always sent", () => {
    for (const key of Object.keys(ALWAYS_SENT)) {
      assert.ok(!(key in CATEGORY_FOR), `"${key}" is in both lists`);
    }
  });

  test("the always-sent list names real client templates only", () => {
    const known = new Set(templateKeys);
    for (const key of Object.keys(ALWAYS_SENT)) {
      assert.ok(known.has(key), `"${key}" is not a template`);
      assert.ok(!OURS.has(emailAudience(key) ?? ""), `"${key}" goes to the team; it does not belong in a client list`);
    }
  });

  test("every template is registered with an audience", () => {
    /* an unregistered template has no audience, so it would leave through
       Brevo instead of the client's HighLevel thread, and no screen could
       say when it fires */
    for (const key of templateKeys) {
      assert.notEqual(emailAudience(key), null, `"${key}" is not listed in lib/comms.ts`);
    }
  });

  test("the morning sweep's reminders and the order update honour the progress switch", () => {
    /* until 15 September 2026 these carried no category, so a client who had
       switched progress emails off was still nudged by them */
    for (const key of [
      "approval_reminder",
      "approval_reminder_batch",
      "intake_reminder",
      "retainer_check_in",
      "order_update",
      "brief_received",
    ]) {
      assert.equal(mayEmail(key, { progress: false }), false, `${key} should be held`);
      assert.equal(mayEmail(key, { offers: false }), true, `${key} is not an offer`);
    }
    /* the review ask stays a favour, under offers */
    assert.equal(mayEmail("review_request", { progress: false }), true);
    assert.equal(mayEmail("review_request", { offers: false }), false);
  });
});
