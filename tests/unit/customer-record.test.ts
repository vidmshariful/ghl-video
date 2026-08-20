import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  billedMonths,
  lifetimeValue,
  serviceTags,
  type MoneySource,
} from "@/lib/customer-record";

/*
 * What a client is worth. The screen this replaces got it wrong in a way
 * nobody spotted for months: it summed paid orders, so a live subscriber on
 * $995 a month read as $0. These tests exist so that specific lie cannot
 * come back.
 */

const NOW = new Date("2026-08-20T12:00:00Z");
const empty: MoneySource = { orders: [], subscriptions: [], openInvoices: [] };

describe("the bug that started this", () => {
  test("a subscriber with no orders is not worth zero", () => {
    const v = lifetimeValue(
      {
        ...empty,
        subscriptions: [
          {
            amountCents: 99500,
            status: "active",
            createdAt: "2026-08-18T18:33:22Z",
            currentPeriodEnd: "2026-09-18T18:33:20Z",
          },
        ],
      },
      NOW,
    );
    assert.equal(v.subscriptionsCents, 99500, "one month billed so far");
    assert.equal(v.totalCents, 99500);
    assert.equal(v.monthlyCents, 99500, "still billing every month");
  });
});

describe("counting subscription months", () => {
  test("a subscription that never took a payment counts nothing", () => {
    for (const status of ["incomplete", "incomplete_expired"]) {
      assert.equal(billedMonths("2026-01-01T00:00:00Z", status, null, NOW), 0, status);
    }
  });

  test("a live subscription counts from when it started until now", () => {
    assert.equal(billedMonths("2026-05-20T00:00:00Z", "active", null, NOW), 4);
  });

  test("a cancelled one stops counting at the end of its last period", () => {
    const months = billedMonths(
      "2026-01-20T00:00:00Z",
      "canceled",
      "2026-04-20T00:00:00Z",
      NOW,
    );
    assert.equal(months, 4, "billed Jan through Apr, then stopped");
  });

  test("a subscription started today has still billed once", () => {
    assert.equal(billedMonths(NOW.toISOString(), "active", null, NOW), 1);
  });
});

describe("the three streams stay separate", () => {
  const src: MoneySource = {
    orders: [
      { amountCents: 49500, status: "paid", kind: "premade" as const },
      { amountCents: 199500, status: "paid", kind: "custom" as const },
      { amountCents: 45000, status: "paid", kind: "addon" as const },
      { amountCents: 99500, status: "refunded", kind: "premade" as const },
      { amountCents: 19900, status: "pending", kind: "premade" as const },
    ],
    subscriptions: [
      { amountCents: 99500, status: "active", createdAt: "2026-06-20T00:00:00Z", currentPeriodEnd: null },
    ],
    openInvoices: [{ totalCents: 45000 }],
  };

  test("shelf, add-on and bespoke are each counted separately", () => {
    const v = lifetimeValue(src, NOW);
    assert.equal(v.premadeCents, 49500);
    assert.equal(v.addOnCents, 45000);
    assert.equal(v.customCents, 199500);
  });

  test("only paid orders count", () => {
    const v = lifetimeValue(src, NOW);
    assert.equal(
      v.premadeCents + v.addOnCents + v.customCents,
      294000,
      "pending is not revenue",
    );
  });

  test("a refund is reported, not netted away silently", () => {
    assert.equal(lifetimeValue(src, NOW).refundedCents, 99500);
  });

  test("a paid invoice is never counted twice", () => {
    /* An invoice is paid through checkout, which creates an order. Its money
     * is already inside customCents, so adding the invoice again would
     * double it. Only unpaid invoices are carried, and never in the total. */
    const v = lifetimeValue(src, NOW);
    assert.equal(v.openInvoicesCents, 45000);
    assert.equal(
      v.totalCents,
      v.premadeCents + v.addOnCents + v.customCents + v.subscriptionsCents,
    );
    assert.ok(!String(v.totalCents).startsWith("64"), "199500 must not appear twice");
  });

  test("an unpaid invoice is a hope, not revenue", () => {
    const only = lifetimeValue({ ...empty, openInvoices: [{ totalCents: 500000 }] }, NOW);
    assert.equal(only.totalCents, 0);
    assert.equal(only.openInvoicesCents, 500000);
  });

  test("a client with nothing is worth nothing, without throwing", () => {
    const v = lifetimeValue(empty, NOW);
    assert.equal(v.totalCents, 0);
    assert.equal(v.monthlyCents, 0);
  });
});

describe("an add-on is not a project", () => {
  /*
   * The real case that corrected this. SpeedMobi bought the AI First SaaS
   * Pack for $1,397, then paid $450 to have those same videos customised for
   * their niche. No new video exists because of that $450: it is extra work
   * on an order already delivered, invoiced against it. Reading it as bespoke
   * work made them look like a custom-video client, which they are not.
   */
  const speedmobi: MoneySource = {
    orders: [
      { amountCents: 139700, status: "paid", kind: "premade" },
      { amountCents: 45000, status: "paid", kind: "addon" },
    ],
    subscriptions: [],
    openInvoices: [],
  };

  test("the top-up counts as an add-on, not as bespoke work", () => {
    const v = lifetimeValue(speedmobi, NOW);
    assert.equal(v.premadeCents, 139700);
    assert.equal(v.addOnCents, 45000);
    assert.equal(v.customCents, 0, "no project was ever created for this");
    assert.equal(v.totalCents, 184700);
  });

  test("and it does not make them a custom client", () => {
    assert.deepEqual(
      serviceTags({ paidOrders: 2, projects: 0, liveSubscriptions: 0 }),
      ["premade"],
    );
  });
});

describe("what kind of client this is", () => {
  test("tags follow what they actually have", () => {
    assert.deepEqual(serviceTags({ paidOrders: 2, projects: 0, liveSubscriptions: 0 }), ["premade"]);
    assert.deepEqual(serviceTags({ paidOrders: 0, projects: 1, liveSubscriptions: 0 }), ["custom"]);
    assert.deepEqual(serviceTags({ paidOrders: 0, projects: 0, liveSubscriptions: 1 }), ["editing"]);
  });

  test("a client using everything wears all three", () => {
    assert.deepEqual(serviceTags({ paidOrders: 3, projects: 2, liveSubscriptions: 1 }), [
      "premade",
      "custom",
      "editing",
    ]);
  });

  test("a brand new account has no service tag rather than a wrong one", () => {
    assert.deepEqual(serviceTags({ paidOrders: 0, projects: 0, liveSubscriptions: 0 }), []);
  });
});
