import { test } from "node:test";
import assert from "node:assert/strict";
import { BOARD_COLUMNS, boardColumn } from "@/lib/premade-board";

test("five columns that read the work, none of them Paid or Intake", () => {
  assert.deepEqual(
    BOARD_COLUMNS.map((c) => c.label),
    ["Waiting on brief", "Ready to start", "Building", "With the client", "Done"],
  );
});

test("no brief means waiting on the brief, whatever the stored stage says", () => {
  assert.equal(boardColumn("paid", false), "brief");
  assert.equal(boardColumn("intake", false), "brief");
  assert.equal(boardColumn("production", false), "brief");
});

test("a brief with nothing started is ready to start", () => {
  assert.equal(boardColumn("paid", true), "start");
  assert.equal(boardColumn("intake", true), "start");
});

test("videos moving is building, every video with the client is with the client", () => {
  assert.equal(boardColumn("production", true), "building");
  assert.equal(boardColumn("review", true), "client");
});

test("delivered is done even before the brief flag caught up", () => {
  assert.equal(boardColumn("delivered", true), "done");
  assert.equal(boardColumn("delivered", false), "done");
});
