import { test } from "node:test";
import assert from "node:assert/strict";
import { VOICE_ACCENTS, cleanAccent, normalizeWebsite } from "@/lib/brief-fields";

test("a website typed the way people type it becomes an address", () => {
  assert.equal(normalizeWebsite("speedmobi.com"), "https://speedmobi.com");
  assert.equal(normalizeWebsite("  www.madcapper.io/  "), "https://www.madcapper.io");
  assert.equal(normalizeWebsite("http://app.example.com/login"), "http://app.example.com/login");
});

test("something that is not an address is refused as empty", () => {
  assert.equal(normalizeWebsite(""), "");
  assert.equal(normalizeWebsite("not a website"), "");
  assert.equal(normalizeWebsite("ftp://files.example.com"), "");
  assert.equal(normalizeWebsite("localhost"), "");
});

test("the accent is one of the offered ones or nothing", () => {
  assert.deepEqual([...VOICE_ACCENTS], ["American", "British", "Australian", "No preference"]);
  assert.equal(cleanAccent("British"), "British");
  assert.equal(cleanAccent(" Australian "), "Australian");
  assert.equal(cleanAccent("Texan"), "");
  assert.equal(cleanAccent(undefined), "");
});
