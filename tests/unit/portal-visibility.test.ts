import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { linesFrom, portalVisibility, type AccountShape } from "@/lib/portal-visibility";

/*
 * The four real shapes of account the platform has today, and the three
 * clients whose portals were hand-tuned before the rules existed. The rules
 * have to land where the hand did, or better.
 */
const base: AccountShape = {
  lines: { premade: false, custom: false, editing: false },
  retainer: false,
  hasBilling: false,
  hasPlanBilling: false,
  hidden: [],
  disabled: [],
};
const has = (v: ReturnType<typeof portalVisibility>, k: string) => v.visible.includes(k);

describe("portalVisibility", () => {
  test("a brand new account sees the store and the ways in, and nothing it does not have", () => {
    const v = portalVisibility(base);
    for (const k of ["dashboard", "messages", "settings", "help", "library", "coming-soon", "book"])
      assert.ok(has(v, k), k);
    for (const k of ["videos", "projects", "subscriptions", "orders", "billing", "brand"])
      assert.ok(!has(v, k), `${k} should be hidden`);
    assert.equal(v.offers, true);
  });

  test("a premade buyer: their videos, the store to buy more, their orders, the custom door", () => {
    const v = portalVisibility({ ...base, lines: { ...base.lines, premade: true }, hasBilling: true });
    for (const k of ["videos", "library", "coming-soon", "orders", "brand", "book"]) assert.ok(has(v, k), k);
    for (const k of ["projects", "subscriptions", "billing"]) assert.ok(!has(v, k), k);
  });

  test("a custom client is not shown the premade store or the custom door", () => {
    const v = portalVisibility({ ...base, lines: { ...base.lines, custom: true }, hasBilling: true });
    for (const k of ["projects", "orders", "brand"]) assert.ok(has(v, k), k);
    for (const k of ["videos", "library", "coming-soon", "book", "subscriptions"]) assert.ok(!has(v, k), k);
  });

  test("an editing client (Beant): the plan screen and its billing, no store, the custom door stays", () => {
    const v = portalVisibility({
      ...base,
      lines: { ...base.lines, editing: true },
      hasPlanBilling: true,
      /* what was set by hand before the rules: book greyed, the rest hidden by rule now */
      disabled: ["library", "coming-soon", "book", "orders", "socialx", "whitelabel", "affiliate"],
    });
    for (const k of ["subscriptions", "billing", "brand", "book"]) assert.ok(has(v, k), k);
    for (const k of ["videos", "library", "coming-soon", "orders", "projects"]) assert.ok(!has(v, k), k);
    /* a disabled override only greys what the rules show */
    assert.deepEqual([...v.disabled].sort(), ["affiliate", "book", "socialx", "whitelabel"]);
  });

  test("a retainer partner (HighLevel): their projects and invoices, no store, no offers", () => {
    const v = portalVisibility({
      ...base,
      lines: { ...base.lines, custom: true },
      retainer: true,
      hasBilling: true,
      disabled: ["subscriptions", "library", "whitelabel", "affiliate", "billing", "book", "videos", "socialx"],
    });
    for (const k of ["projects", "orders", "brand", "messages"]) assert.ok(has(v, k), k);
    for (const k of ["library", "coming-soon", "book", "videos", "subscriptions", "billing", "affiliate", "whitelabel", "socialx"])
      assert.ok(!has(v, k), `${k} should be hidden`);
    assert.equal(v.offers, false);
    assert.deepEqual(v.disabled, []);
  });

  test("a hidden override removes a section the rules would show, but never the four essentials", () => {
    const v = portalVisibility({
      ...base,
      lines: { premade: true, custom: true, editing: false },
      hasBilling: true,
      hidden: ["library", "affiliate", "messages", "settings"],
    });
    assert.ok(!has(v, "library"));
    assert.ok(!has(v, "affiliate"));
    assert.ok(has(v, "messages"));
    assert.ok(has(v, "settings"));
  });

  test("someone with all three lines sees all three screens and both kinds of billing", () => {
    const v = portalVisibility({
      ...base,
      lines: { premade: true, custom: true, editing: true },
      hasBilling: true,
      hasPlanBilling: true,
    });
    for (const k of ["videos", "projects", "subscriptions", "orders", "billing", "library"]) assert.ok(has(v, k), k);
    assert.ok(!has(v, "book"));
  });
});

describe("linesFrom", () => {
  test("a direct-brief account counts as custom before its first project", () => {
    assert.deepEqual(linesFrom({ premadeOrders: 0, projects: 0, directBrief: true, subscriptions: 0 }), {
      premade: false,
      custom: true,
      editing: false,
    });
  });
  test("a cancelled plan still counts as an editing line, so past months stay reachable", () => {
    assert.equal(linesFrom({ premadeOrders: 0, projects: 0, directBrief: false, subscriptions: 1 }).editing, true);
  });
});
