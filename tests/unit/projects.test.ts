import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CLIENT_LABEL,
  PROJECT_LIST,
  PROJECT_STATUSES,
  STUDIO_LABEL,
  isOpen,
  normalizeProjectStatus,
  projectBalance,
  projectValueCents,
} from "@/lib/projects";

/*
 * Custom job money and vocabulary. The balance maths is what tells you
 * whether a job has been paid for, so getting it wrong means chasing a client
 * who already paid, or not chasing one who has not.
 */

describe("what a job is worth", () => {
  test("the agreed price wins once it exists", () => {
    assert.equal(projectValueCents({ quotedCents: 250000, agreedCents: 199500 }), 199500);
  });

  test("before agreement the quote stands in, so a pipeline still adds up", () => {
    assert.equal(projectValueCents({ quotedCents: 250000, agreedCents: null }), 250000);
  });

  test("a job with neither is worth nothing rather than throwing", () => {
    assert.equal(projectValueCents({ quotedCents: null, agreedCents: null }), 0);
  });

  test("an agreed price of zero is honoured, not treated as missing", () => {
    assert.equal(projectValueCents({ quotedCents: 250000, agreedCents: 0 }), 0);
  });
});

describe("deposit and balance", () => {
  const job = { quotedCents: 250000, agreedCents: 200000 };

  test("a paid deposit leaves the rest outstanding", () => {
    const b = projectBalance(job, [
      { totalCents: 100000, paid: true },
      { totalCents: 100000, paid: false },
    ]);
    assert.equal(b.valueCents, 200000);
    assert.equal(b.paidCents, 100000);
    assert.equal(b.invoicedCents, 200000);
    assert.equal(b.outstandingCents, 100000);
  });

  test("outstanding is measured against the agreed price, not against what we invoiced", () => {
    /* only the deposit has been raised so far; the job still owes the rest */
    const b = projectBalance(job, [{ totalCents: 100000, paid: true }]);
    assert.equal(b.invoicedCents, 100000);
    assert.equal(b.outstandingCents, 100000, "the uninvoiced half is still owed");
  });

  test("overpayment never shows as a negative balance", () => {
    const b = projectBalance(job, [{ totalCents: 250000, paid: true }]);
    assert.equal(b.outstandingCents, 0);
  });

  test("a job with no invoices owes its whole agreed price", () => {
    assert.equal(projectBalance(job, []).outstandingCents, 200000);
  });
});

describe("the two vocabularies", () => {
  test("every status has a word for the studio and a word for the client", () => {
    for (const s of PROJECT_STATUSES) {
      assert.ok(STUDIO_LABEL[s], `studio label missing for ${s}`);
      assert.ok(CLIENT_LABEL[s], `client label missing for ${s}`);
    }
  });

  test("the client is never shown our internal word for a stage", () => {
    /* "scoped" and "with client" are studio language; a client reads
     * "booked in" and "ready for you" instead */
    assert.notEqual(CLIENT_LABEL.scoped, STUDIO_LABEL.scoped);
    assert.notEqual(CLIENT_LABEL.review, STUDIO_LABEL.review);
  });

  test("the list shows live work only", () => {
    assert.ok(!PROJECT_LIST.includes("closed"));
    assert.ok(!PROJECT_LIST.includes("cancelled"));
    for (const s of PROJECT_LIST) assert.equal(isOpen(s), true);
  });

  test("finished and abandoned jobs both count as not open", () => {
    assert.equal(isOpen("closed"), false);
    assert.equal(isOpen("cancelled"), false);
  });
});

describe("the vocabulary, after the simple-list decision", () => {
  test("the list carries the studio's own seven categories, in work order", () => {
    assert.deepEqual(PROJECT_LIST, [
      "backlog",
      "planning",
      "in_progress",
      "review",
      "revision",
      "approved",
      "cutdowns",
    ]);
    for (const k of PROJECT_LIST) {
      assert.ok(STUDIO_LABEL[k], `${k} needs a studio word`);
      assert.ok(CLIENT_LABEL[k], `${k} needs a client word`);
      assert.ok(PROJECT_STATUSES.includes(k));
    }
  });

  test("closed and cancelled are terminal, everything else is open", () => {
    assert.equal(isOpen("closed"), false);
    assert.equal(isOpen("cancelled"), false);
    assert.equal(isOpen("cutdowns"), true);
    assert.equal(isOpen("backlog"), true);
  });

  test("the pre-rename words still read until the data migrates", () => {
    assert.equal(normalizeProjectStatus("scoped"), "backlog");
    assert.equal(normalizeProjectStatus("in_production"), "in_progress");
    assert.equal(normalizeProjectStatus("delivered"), "approved");
    assert.equal(normalizeProjectStatus("review"), "review");
    assert.equal(STUDIO_LABEL["scoped"], "Backlog");
  });

  test("nonsense in storage lands in backlog rather than crashing a screen", () => {
    assert.equal(normalizeProjectStatus("garbage"), "backlog");
  });

  test("the client never reads a studio word", () => {
    assert.equal(CLIENT_LABEL["review"], "Ready for you");
    assert.equal(CLIENT_LABEL["cutdowns"], "Extra formats in the works");
    assert.equal(CLIENT_LABEL["revision"], "Changes in hand");
  });
});
