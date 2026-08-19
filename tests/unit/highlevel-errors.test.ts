import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { HighLevelError, existingOpportunityId } from "@/lib/checkout/highlevel-errors";

/*
 * The duplicate-opportunity rule, which sits on the money path.
 *
 * Getting this wrong in either direction is expensive. Too strict, and every
 * repeat customer's order fails fulfillment forever on a retry loop, which is
 * exactly what happened. Too loose, and a real HighLevel outage gets swallowed
 * and an order silently never reaches the studio.
 */

/** the actual 400 body HighLevel returned on the live account */
const REAL_DUPLICATE_BODY = {
  statusCode: 400,
  message: "Can not create duplicate opportunity for the contact.",
  code: "OPPORTUNITY_NO_DUPLICATE",
  meta: { existingId: "kqNvTBdfNA0SrZQ7KbAD" },
  error: "Bad Request",
};

describe("a repeat customer who already has an opportunity", () => {
  test("the existing id is adopted rather than thrown", () => {
    const err = new HighLevelError("HL POST /opportunities/ -> 400", 400, REAL_DUPLICATE_BODY);
    assert.equal(existingOpportunityId(err), "kqNvTBdfNA0SrZQ7KbAD");
  });

  test("a duplicate reply with no id is not usable, so it still fails", () => {
    const err = new HighLevelError("dup", 400, { code: "OPPORTUNITY_NO_DUPLICATE", meta: {} });
    assert.equal(existingOpportunityId(err), null);
  });
});

describe("everything else must still be treated as a failure", () => {
  test("other 400s are not swallowed", () => {
    const err = new HighLevelError("bad pipeline", 400, {
      code: "PIPELINE_NOT_FOUND",
      meta: { existingId: "should-be-ignored" },
    });
    assert.equal(existingOpportunityId(err), null);
  });

  test("auth and server failures are not swallowed", () => {
    for (const status of [401, 403, 429, 500, 502]) {
      const err = new HighLevelError("boom", status, REAL_DUPLICATE_BODY);
      assert.equal(existingOpportunityId(err), null, `status ${status}`);
    }
  });

  test("a plain error, a timeout or a non-JSON body is not a duplicate", () => {
    assert.equal(existingOpportunityId(new Error("aborted")), null);
    assert.equal(existingOpportunityId(new HighLevelError("html", 400, null)), null);
    assert.equal(existingOpportunityId(new HighLevelError("text", 400, "<html>502</html>")), null);
    assert.equal(existingOpportunityId(null), null);
    assert.equal(existingOpportunityId(undefined), null);
  });
});
