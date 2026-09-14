import { test } from "node:test";
import assert from "node:assert/strict";
import { likeLiteral } from "../../lib/pg-pattern";

test("an email with pattern characters matches only itself", () => {
  assert.equal(likeLiteral("john@x.com"), "john@x.com");
  assert.equal(likeLiteral("j_hn@x.com"), "j\\_hn@x.com");
  assert.equal(likeLiteral("100%@x.com"), "100\\%@x.com");
  assert.equal(likeLiteral("a\\b@x.com"), "a\\\\b@x.com");
});
