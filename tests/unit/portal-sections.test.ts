import { test } from "node:test";
import assert from "node:assert/strict";
import { isPortalHead, resolveSection, sectionPath } from "../../app/portal/sections";

test("the six sections and the strip's screens resolve, and unknown lands on Home", () => {
  assert.deepEqual(resolveSection([]), { section: "home", line: null, id: null });
  assert.deepEqual(resolveSection(["billing", "abc"]), { section: "billing", line: null, id: "abc" });
  assert.deepEqual(resolveSection(["work"]), { section: "work", line: null, id: null });
  assert.deepEqual(resolveSection(["work", "custom", "p1"]), { section: "work", line: "custom", id: "p1" });
  assert.deepEqual(resolveSection(["work", "nonsense"]), { section: "work", line: null, id: null });
  assert.deepEqual(resolveSection(["library", "exp-004"]), { section: "library", line: null, id: "exp-004" });
  assert.deepEqual(resolveSection(["whatever"]), { section: "home", line: null, id: null });
});

test("the old names still open the right screen", () => {
  assert.deepEqual(resolveSection(["dashboard"]), { section: "home", line: null, id: null });
  assert.deepEqual(resolveSection(["orders", "o1"]), { section: "billing", line: null, id: "o1" });
  assert.deepEqual(resolveSection(["projects", "p1"]), { section: "work", line: "custom", id: "p1" });
  assert.deepEqual(resolveSection(["videos"]), { section: "work", line: "premade", id: null });
  assert.deepEqual(resolveSection(["subscriptions"]), { section: "work", line: "editing", id: null });
  assert.equal(isPortalHead("projects"), true);
  assert.equal(isPortalHead("work"), true);
  assert.equal(isPortalHead("nope"), false);
});

test("a screen's path is the one every link uses", () => {
  assert.equal(sectionPath("home"), "/portal/");
  assert.equal(sectionPath("work"), "/portal/work/");
  assert.equal(sectionPath("work", "editing"), "/portal/work/editing/");
  assert.equal(sectionPath("work", "custom", "p1"), "/portal/work/custom/p1/");
  assert.equal(sectionPath("billing", null, "o1"), "/portal/billing/o1/");
  assert.equal(sectionPath("settings"), "/portal/settings/");
});
