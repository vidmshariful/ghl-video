/*
 * Warm the dev server before the parallel run: Next compiles pages on first
 * hit, and fifteen simultaneous first hits time each other out. One serial
 * GET per page makes the real tests measure the site, not the compiler.
 * Against a production `next start` this finishes in a blink.
 */
const PATHS = [
  "/",
  "/premade/",
  "/custom-video/",
  "/editing/",
  "/quote/",
  "/about/",
  "/contact/",
  "/work/",
  "/highlevel-demo-video/",
  "/highlevel-video-bundle/",
  "/blog/",
  "/resources/",
  "/legal/privacy/",
  "/legal/terms/",
  "/legal/refund/",
];

export default async function globalSetup() {
  for (const p of PATHS) {
    try {
      await fetch(`http://localhost:3000${p}`, { redirect: "follow" });
    } catch {
      // the webServer block hasn't finished booting yet; tests will retry
    }
  }
}
