import { test } from "node:test";
import assert from "node:assert/strict";
import { isTransientHlFailure } from "@/lib/highlevel/client";

test("HighLevel's gateway timeout dressed as a 401 is a hiccup, not a refusal", () => {
  assert.equal(isTransientHlFailure(401, '{"statusCode":401,"message":"Command timed out"}'), true);
});

test("a real refusal or a bad request is not retried", () => {
  assert.equal(isTransientHlFailure(401, '{"statusCode":401,"message":"Invalid JWT"}'), false);
  assert.equal(isTransientHlFailure(400, '{"message":"items should not be empty"}'), false);
  assert.equal(isTransientHlFailure(404, '{"message":"Invoice not found"}'), false);
  assert.equal(isTransientHlFailure(422, '{"message":"Unprocessable"}'), false);
});

test("rate limits and server errors are", () => {
  assert.equal(isTransientHlFailure(429, '{"message":"Too many requests"}'), true);
  assert.equal(isTransientHlFailure(502, "Bad Gateway"), true);
  assert.equal(isTransientHlFailure(503, ""), true);
});
