import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_TOGGLEABLE, ALWAYS_OPEN, canAccessAny, canAccessView, effectiveViews, normalizeRole } from "../../lib/admin-roles";
import { ALL_VIEWS } from "../../app/admin/nav";

test("a Sales Rep opens the sales tools and nothing else; a manager everything but the code; an admin everything", () => {
  assert.equal(canAccessView("orders", "sales_rep", null), true);
  assert.equal(canAccessView("customers", "sales_rep", null), true);
  assert.equal(canAccessView("sales", "sales_rep", null), false);
  assert.equal(canAccessView("subscriptions", "sales_rep", null), false);
  assert.equal(canAccessView("seo", "sales_rep", null), false);
  assert.equal(canAccessView("health", "sales_rep", null), false);
  assert.equal(canAccessView("dashboard", "sales_rep", null), true);
  assert.equal(canAccessView("code", "manager", null), false);
  assert.equal(canAccessView("seo", "manager", null), true);
  assert.equal(canAccessView("code", "admin", null), true);
  assert.equal(canAccessView("code", "admin", ["orders"]), true);
});

test("an explicit grant list narrows or widens a person, and an unknown view never opens", () => {
  assert.equal(canAccessView("sales", "sales_rep", ["sales"]), true);
  assert.equal(canAccessView("orders", "sales_rep", ["sales"]), false);
  assert.equal(canAccessView("made-up", "manager", null), false);
  assert.deepEqual(effectiveViews("sales_rep", ["orders", "nonsense"]), ["orders"]);
  assert.equal(canAccessAny(["production", "custom", "editing"], "sales_rep", null), false);
  assert.equal(canAccessAny(["production", "custom", "editing"], "sales_rep", ["editing"]), true);
  assert.equal(normalizeRole(undefined), "manager");
  assert.equal(normalizeRole("sales_rep"), "sales_rep");
});

test("every toggleable view is a real admin view", () => {
  for (const key of [...ALL_TOGGLEABLE, ...ALWAYS_OPEN]) assert.ok((ALL_VIEWS as string[]).includes(key), key);
});

/*
 * Every admin route is gated by the view it serves, unless it is on the
 * short list of routes every admin may call (their own identity, the bell,
 * the dashboard, the handbook) or is gated to the admin role by its own
 * hand (team, integrations). A new route that forgets the view gate fails
 * this test.
 */
const ANY_ADMIN = new Set([
  "access-check/route.ts",
  "dashboard/route.ts",
  "handbook/route.ts",
  "integrations/route.ts",
  "integrations/google/route.ts",
  "me/route.ts",
  "me/avatar/route.ts",
  "notifications/route.ts",
  "team/route.ts",
]);
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name === "route.ts") out.push(p);
  }
  return out;
}
test("every admin route names the view it serves, or is on the any-admin list", () => {
  const root = fileURLToPath(new URL("../../app/api/admin", import.meta.url));
  const known = new Set([...ALL_TOGGLEABLE, ...ALWAYS_OPEN]);
  for (const file of walk(root)) {
    const rel = relative(root, file);
    const src = readFileSync(file, "utf8");
    if (ANY_ADMIN.has(rel)) continue;
    assert.ok(src.includes("verifyAdminFor("), `${rel} is not gated by a view`);
    assert.ok(!/await verifyAdmin\(/.test(src), `${rel} still calls the plain admin check`);
    for (const m of src.matchAll(/verifyAdminFor\(\w+,\s*("[^"]+"|\[[^\]]+\])\)/g)) {
      const views = m[1].startsWith("[") ? (JSON.parse(m[1]) as string[]) : [JSON.parse(m[1]) as string];
      for (const v of views) assert.ok(known.has(v), `${rel} names an unknown view ${v}`);
    }
  }
});
