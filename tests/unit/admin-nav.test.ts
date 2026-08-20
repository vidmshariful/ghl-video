import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ALL_VIEWS } from "@/app/admin/nav";
import {
  ROLE_DEFAULT_FEATURES,
  ROLES,
  TOGGLEABLE_VIEWS,
  VIEW_GROUPS,
} from "@/app/admin/roles";

/*
 * The admin menu, held together.
 *
 * Every failure here is silent in the browser rather than loud: a view with a
 * group nobody draws loses its checkbox and can never be granted, and a role
 * defaulting to a view that no longer exists just quietly opens nothing. Both
 * have happened.
 */

describe("the menu and the grant screen agree", () => {
  test("every toggleable view is drawn in some group", () => {
    const drawn = new Set<string>(VIEW_GROUPS);
    for (const v of TOGGLEABLE_VIEWS) {
      assert.ok(
        drawn.has(v.group),
        `"${v.key}" is in group "${v.group}", which the grant screen never draws, so its checkbox would vanish`,
      );
    }
  });

  test("every group actually holds something", () => {
    for (const g of VIEW_GROUPS) {
      assert.ok(
        TOGGLEABLE_VIEWS.some((v) => v.group === g),
        `group "${g}" would render as an empty box`,
      );
    }
  });

  test("every toggleable view is a real screen", () => {
    for (const v of TOGGLEABLE_VIEWS) {
      assert.ok(ALL_VIEWS.includes(v.key), `"${v.key}" is not a routable view`);
    }
  });

  test("no view is listed twice", () => {
    const keys = TOGGLEABLE_VIEWS.map((v) => v.key);
    assert.equal(new Set(keys).size, keys.length);
  });
});

describe("role defaults point at screens that exist", () => {
  test("every default feature is a real view", () => {
    for (const role of ROLES) {
      for (const key of ROLE_DEFAULT_FEATURES[role] ?? []) {
        assert.ok(
          ALL_VIEWS.includes(key),
          `role "${role}" defaults to "${key}", which is not a view`,
        );
      }
    }
  });
});
