import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SITE_URL, wrapEmail } from "@/lib/email/templates";

/*
 * The one line at the foot of every email that tells a client they can
 * change what they are sent. No email carried it before 15 September 2026,
 * so the preferences screen was a thing a client had to find on their own.
 */

const link = `${SITE_URL}/portal/settings/`;

describe("the preferences link in the email frame", () => {
  test("a client's email carries it", () => {
    const html = wrapEmail("<p>hi</p>", { audience: "client" });
    assert.ok(html.includes(link));
    assert.ok(html.includes("Email preferences"));
  });

  test("an email whose audience nobody named carries it too", () => {
    assert.ok(wrapEmail("<p>hi</p>").includes(link));
    assert.ok(wrapEmail("<p>hi</p>", { audience: null }).includes(link));
  });

  test("a team alert, a lead, a partner and a teammate do not: there is no such screen for them", () => {
    for (const audience of ["team", "owner", "producer", "lead", "partner", "teammate"]) {
      assert.ok(!wrapEmail("<p>hi</p>", { audience }).includes(link), audience);
    }
  });

  test("the message sits inside the frame, with the brand line under it", () => {
    const html = wrapEmail("<p>hello there</p>", { audience: "client" });
    assert.ok(html.includes("<p>hello there</p>"));
    assert.ok(html.indexOf("<p>hello there</p>") < html.indexOf("a brand of Vidiosa LLC"));
    assert.ok(html.indexOf("a brand of Vidiosa LLC") < html.indexOf(link));
  });
});
