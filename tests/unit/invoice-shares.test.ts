import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { invoiceProjectShares } from "@/lib/invoice-shares";

/*
 * A $9,000 invoice for six videos sat on one project while the other five
 * showed unpaid, with the money already in. These pin the split that fixed it.
 */
describe("invoiceProjectShares", () => {
  test("splits a six-video invoice evenly across its six jobs", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const shares = invoiceProjectShares({ project_id: "a", project_ids: ids, total_cents: 900000 });
    assert.deepEqual(shares.map((s) => s.projectId), ids);
    assert.ok(shares.every((s) => s.shareCents === 150000));
  });

  test("always sums to the invoice, remainder cents on the first job", () => {
    const shares = invoiceProjectShares({ project_ids: ["a", "b", "c"], total_cents: 100001 });
    assert.equal(shares.reduce((n, s) => n + s.shareCents, 0), 100001);
    assert.equal(shares[0].shareCents, 33335);
    assert.equal(shares[1].shareCents, 33333);
  });

  test("falls back to the legacy single project when the list is empty", () => {
    assert.deepEqual(invoiceProjectShares({ project_id: "solo", project_ids: null, total_cents: 5000 }), [
      { projectId: "solo", shareCents: 5000 },
    ]);
  });

  test("covers nothing when the invoice names no job", () => {
    assert.deepEqual(invoiceProjectShares({ project_id: null, project_ids: [], total_cents: 5000 }), []);
  });
});
