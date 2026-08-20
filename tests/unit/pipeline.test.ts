import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  approveStation,
  ballInCourt,
  clientStationWord,
  currentStation,
  defaultPipeline,
  normalizePipeline,
  pipelinePercent,
  returnStation,
  statusForPipeline,
  type Pipeline,
} from "@/lib/pipeline";

/*
 * The production line's rules. Worth testing hard because the derived coarse
 * status feeds the board, the dashboard counts and the client cards: a wrong
 * derivation quietly lies on four screens at once.
 */

const at = "2026-08-21T10:00:00.000Z";

describe("what a fresh line looks like", () => {
  test("gates follow the studio's real rules, not a template", () => {
    const p = defaultPipeline();
    assert.equal(p.script.gate, true);
    assert.equal(p.voiceover.gate, true);
    assert.equal(p.design.gate, false);
    assert.equal(p.animation.gate, true);
    assert.equal(p.sfx.gate, false);
    assert.equal(p.delivery.gate, true);
  });

  test("garbage in storage becomes a whole line, not a crash", () => {
    const p = normalizePipeline({ script: { state: "nonsense" }, junk: 1 });
    assert.equal(p.script.state, "todo");
    assert.equal(p.delivery.state, "todo");
  });

  test("a client-provided piece is done by definition and never gated", () => {
    const p = normalizePipeline({ script: { state: "todo", provided: true, gate: true } });
    assert.equal(p.script.state, "done");
    assert.equal(p.script.gate, false);
    assert.equal(clientStationWord("script", p.script), "You provided this");
  });

  test("sound can never be marked client-provided", () => {
    const p = normalizePipeline({ sfx: { state: "todo", provided: true } });
    assert.equal(p.sfx.provided, false);
  });
});

describe("where the work stands", () => {
  test("the current station is the first unfinished one", () => {
    const p = normalizePipeline({
      script: { state: "done" },
      voiceover: { state: "done" },
      design: { state: "with_us" },
    });
    assert.equal(currentStation(p), "design");
  });

  test("the ball is with the client the moment anything waits on them", () => {
    const p = normalizePipeline({ script: { state: "with_client" }, design: { state: "with_us" } });
    assert.equal(ballInCourt(p), "client");
  });

  test("a finished line has no ball at all", () => {
    const p = normalizePipeline(
      Object.fromEntries(
        ["script", "voiceover", "design", "animation", "sfx", "delivery"].map((k) => [
          k,
          { state: "done" },
        ]),
      ),
    );
    assert.equal(ballInCourt(p), null);
    assert.equal(pipelinePercent(p), 100);
  });
});

describe("the derived coarse status", () => {
  const done = { state: "done" as const };
  test("untouched is queued, touched is in production", () => {
    assert.equal(statusForPipeline(defaultPipeline(), 0), "queued");
    assert.equal(
      statusForPipeline(normalizePipeline({ script: { state: "with_us" } }), 0),
      "in_production",
    );
  });

  test("anything waiting on the client reads as ready", () => {
    const p = normalizePipeline({ script: done, animation: { state: "with_client" } });
    assert.equal(statusForPipeline(p, 0), "ready");
  });

  test("animation back with us after feedback reads as revisions", () => {
    const p = normalizePipeline({ script: done, voiceover: done, design: done, animation: { state: "with_us" } });
    assert.equal(statusForPipeline(p, 1), "revisions");
    // the same shape before any feedback is just production
    assert.equal(statusForPipeline(p, 0), "in_production");
  });

  test("every station done is approved", () => {
    const p = normalizePipeline({
      script: done, voiceover: done, design: done, animation: done, sfx: done, delivery: done,
    });
    assert.equal(statusForPipeline(p, 2), "approved");
  });
});

describe("gate transitions", () => {
  test("approving a station hands the next one to us", () => {
    let p: Pipeline = normalizePipeline({
      script: { state: "done" },
      voiceover: { state: "with_client" },
    });
    p = approveStation(p, "voiceover", at);
    assert.equal(p.voiceover.state, "done");
    assert.equal(p.design.state, "with_us");
    assert.equal(ballInCourt(p), "us");
  });

  test("changes requested brings the station back to us", () => {
    let p: Pipeline = normalizePipeline({ animation: { state: "with_client" } });
    p = returnStation(p, "animation", at);
    assert.equal(p.animation.state, "with_us");
    assert.equal(ballInCourt(p), "us");
  });

  test("approving delivery finishes the line", () => {
    let p: Pipeline = normalizePipeline({
      script: { state: "done" }, voiceover: { state: "done" }, design: { state: "done" },
      animation: { state: "done" }, sfx: { state: "done" }, delivery: { state: "with_client" },
    });
    p = approveStation(p, "delivery", at);
    assert.equal(statusForPipeline(p, 1), "approved");
  });
});
