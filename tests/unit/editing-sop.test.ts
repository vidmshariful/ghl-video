import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CLIENT_STAGES,
  EDITING_COLUMNS,
  QC_CHECKS,
  boardMovePatch,
  columnFor,
  qcPassed,
  qcRemaining,
  stageFor,
} from "@/lib/editing-sop";

/*
 * The editing SOP. Two rules here decide whether the studio looks fast or
 * slow and whether a client ever sees an unfinished cut, so both are pinned
 * down rather than left to a screen to remember.
 */

describe("which column a request sits in", () => {
  test("a request with no footage is waiting, not queued", () => {
    assert.equal(columnFor({ status: "queued", assetsReadyAt: null }), "waiting");
  });

  test("footage landing moves it into the queue proper", () => {
    assert.equal(
      columnFor({ status: "queued", assetsReadyAt: "2026-08-20T00:00:00Z" }),
      "queued",
    );
  });

  test("work already started is never dragged back to waiting", () => {
    /* an editor can be part way through while we chase a second file. The
       card must not jump backwards on the board when that happens. */
    assert.equal(columnFor({ status: "in_production", assetsReadyAt: null }), "in_production");
    assert.equal(columnFor({ status: "ready", assetsReadyAt: null }), "ready");
  });

  test("every column a request can land in is a real column", () => {
    const keys = new Set(EDITING_COLUMNS.map((c) => c.key));
    for (const status of ["queued", "in_production", "ready", "revisions", "approved"]) {
      assert.ok(keys.has(columnFor({ status, assetsReadyAt: "2026-08-20T00:00:00Z" })));
    }
  });
});

describe("the checks that run before a client sees a cut", () => {
  test("an empty checklist does not pass", () => {
    assert.equal(qcPassed({}), false);
    assert.equal(qcPassed(null), false);
  });

  test("five of six is still a fail", () => {
    const almost = Object.fromEntries(QC_CHECKS.slice(1).map((c) => [c.key, true]));
    assert.equal(qcPassed(almost), false);
    assert.deepEqual(qcRemaining(almost), [QC_CHECKS[0].label]);
  });

  test("all six passes", () => {
    const all = Object.fromEntries(QC_CHECKS.map((c) => [c.key, true]));
    assert.equal(qcPassed(all), true);
    assert.deepEqual(qcRemaining(all), []);
  });

  test("a check turned back off fails again", () => {
    const all = Object.fromEntries(QC_CHECKS.map((c) => [c.key, true]));
    assert.equal(qcPassed({ ...all, audio: false }), false);
  });

  test("the list stays short enough to actually be read", () => {
    /* a twenty item checklist gets ticked without being read, which is worse
       than none: it manufactures a record of care that did not happen */
    assert.ok(QC_CHECKS.length <= 8);
  });
});

describe("the client's stages and the studio's columns are the same set", () => {
  test("every board column has a word the client is given for it", () => {
    for (const c of EDITING_COLUMNS) {
      assert.ok(
        CLIENT_STAGES.some((s) => s.key === c.key),
        `the board has a "${c.key}" column with nothing to call it on the client's side`,
      );
    }
  });

  test("and no client stage exists that the board cannot produce", () => {
    /* a stage a client can see but the studio can never move a card into is
       a stage that stays empty forever and reads as broken */
    for (const s of CLIENT_STAGES) {
      assert.ok(EDITING_COLUMNS.some((c) => c.key === s.key), `"${s.key}" is unreachable`);
    }
  });

  test("stageFor never returns nothing, whatever it is handed", () => {
    assert.ok(stageFor("approved").label);
    assert.ok(stageFor("something we removed later").label);
  });
});

describe("what a drag between columns means", () => {
  test("into Needs footage says the files are not usable", () => {
    assert.deepEqual(boardMovePatch("in_production", "waiting"), {
      assetsReady: false,
      status: "queued",
    });
  });

  test("out of Needs footage says they arrived", () => {
    assert.deepEqual(boardMovePatch("waiting", "queued"), {
      status: "queued",
      assetsReady: true,
    });
    assert.deepEqual(boardMovePatch("waiting", "in_production"), {
      status: "in_production",
      assetsReady: true,
    });
  });

  test("an ordinary move is only a status change", () => {
    assert.deepEqual(boardMovePatch("queued", "in_production"), { status: "in_production" });
    assert.deepEqual(boardMovePatch("ready", "revisions"), { status: "revisions" });
  });

  test("dragging to Review carries no QC bypass: the server still decides", () => {
    /* the patch says only status; the QC gate lives server-side and a drag
       must reach it exactly like a button press would */
    assert.deepEqual(boardMovePatch("in_production", "ready"), { status: "ready" });
  });
});
