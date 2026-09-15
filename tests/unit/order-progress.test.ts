import { test } from "node:test";
import assert from "node:assert/strict";
import { ORDER_PIPS, orderProgress } from "@/lib/order-progress";

test("the client's order tracker has five pips, none of them called Intake", () => {
  assert.deepEqual(
    ORDER_PIPS.map((p) => p.label),
    ["Paid", "Brief", "In production", "Review", "Delivered"],
  );
});

test("paid with no brief stops on the brief pip", () => {
  const p = orderProgress("paid", false);
  assert.deepEqual(p.done, ["paid"]);
  assert.equal(p.current, "brief");
});

test("paid with the brief in points at production", () => {
  const p = orderProgress("paid", true);
  assert.deepEqual(p.done, ["paid", "brief"]);
  assert.equal(p.current, "production");
});

test("the stored intake stage behaves like paid", () => {
  assert.equal(orderProgress("intake", false).current, "brief");
  assert.equal(orderProgress("intake", true).current, "production");
});

test("work that started before the brief leaves the brief pip open", () => {
  const p = orderProgress("production", false);
  assert.deepEqual(p.done, ["paid", "production"]);
  assert.equal(p.current, "brief");
});

test("review and delivered fill everything before them", () => {
  assert.equal(orderProgress("review", true).current, "delivered");
  assert.deepEqual(orderProgress("delivered", true).done, ["paid", "brief", "production", "review", "delivered"]);
  assert.equal(orderProgress("delivered", true).current, "delivered");
});
