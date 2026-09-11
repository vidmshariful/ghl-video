import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { batchStatusFor } from "@/lib/editing-credits";

/*
 * A batch's status is never set by hand, so this rule is the only thing that
 * ever moves one. The cases are the ones the board actually produces: shorts
 * finishing one at a time, one sent back while another waits, a cancelled
 * short that must stop counting.
 */
describe("batchStatusFor", () => {
  test("no live shorts means no opinion", () => {
    assert.equal(batchStatusFor([]), null);
    assert.equal(batchStatusFor([{ status: "queued", cancelledAt: "2026-09-01" }]), null);
  });

  test("every short approved approves the batch", () => {
    assert.equal(
      batchStatusFor([{ status: "approved" }, { status: "approved" }, { status: "approved" }]),
      "approved",
    );
  });

  test("a cancelled short does not hold the batch back", () => {
    assert.equal(
      batchStatusFor([
        { status: "approved" },
        { status: "queued", cancelledAt: "2026-09-05T18:34:00Z" },
        { status: "approved" },
      ]),
      "approved",
    );
  });

  test("one short waiting on the client puts the batch in Review", () => {
    assert.equal(
      batchStatusFor([{ status: "approved" }, { status: "ready" }, { status: "in_production" }]),
      "ready",
    );
  });

  test("a short sent back with nothing to review is Revisions", () => {
    assert.equal(
      batchStatusFor([{ status: "approved" }, { status: "revisions" }, { status: "queued" }]),
      "revisions",
    );
  });

  test("shorts being cut keep the batch in production", () => {
    assert.equal(batchStatusFor([{ status: "approved" }, { status: "in_production" }]), "in_production");
  });

  test("shorts nobody has started leave the batch queued", () => {
    assert.equal(batchStatusFor([{ status: "queued" }, { status: "queued" }]), "queued");
  });
});
