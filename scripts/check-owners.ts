/*
 * Does this code know that work is not always a purchase?
 *
 * A video hangs off one of three things: an order somebody bought, a custom
 * project, or a monthly editing plan. Everything written before the last two
 * existed reaches for order_id, finds null, and quietly does nothing. It never
 * throws. It returns an empty list, or a 404, or sends no email, and the
 * screen looks fine.
 *
 * That single assumption produced, in one week:
 *   - every Download button in the portal, broken on every screen
 *   - client feedback on plan videos reaching no studio screen at all
 *   - client feedback on extra formats, the same
 *   - no version history for plan work, so a revision erased the cut before it
 *   - Share answering Not found for every editing client
 *   - the customer record showing 1 of Chase's 21 videos, and 0 of Extendly's 5
 *   - the studio queue answering "what do I do next" for a third of the work
 *   - "your video is ready" never sent to a custom or editing client
 *   - the one-question ask reaching 1 of 14 finished videos
 *
 * Nine bugs, one cause. This is the guard so the tenth fails a build instead
 * of a client.
 *
 * A RATCHET, NOT A CLIFF
 * ----------------------
 * Plenty of code is order-only and RIGHT to be: the Orders screen, the
 * premade production board, the expansion that runs when an order settles.
 * Those are listed below with the reason, and the list is the point. Adding
 * to it is a decision somebody writes down; forgetting is what this catches.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/* the tables where a row belongs to one of the three owners */
const SPINE = [
  "order_deliverables",
  "deliverable_comments",
  "deliverable_versions",
  "video_feedback",
];

/*
 * Order-only on purpose. The reason is required: a file here without one is
 * a file somebody skipped rather than decided.
 */
const ORDER_ONLY: Record<string, string> = {
  "app/api/admin/orders/[id]/comments/route.ts":
    "addressed by order by design; the video-addressed twin lives at admin/deliverables/[id]/comments",
  "app/api/admin/orders/[id]/deliverables/route.ts":
    "the premade job screen, which is an order",
  "app/api/portal/orders/[id]/route.ts": "one order, as the client sees it",
  "app/api/portal/library/route.ts":
    "builds the set of catalogue codes a client already owns; bespoke work has no catalogue code",
  "lib/deliverables.ts": "expansion at settlement, which only an order has",
  "lib/versions.ts": "writes order_id through from the deliverable; nullable since 0071",
  "app/admin/OrdersScreen.tsx": "the Orders screen",
  "app/admin/ProductionScreen.tsx": "the premade board; custom and editing have their own",
  "lib/review.ts":
    "already branches on it: re-staging and completing an order is order-level bookkeeping, and a project keeps its own state through syncProjectState",
  "lib/subscription-cycles.ts":
    "a credit top-up is bought as an order, so editing_credit_grants is keyed by one",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const files = [...walk("app"), ...walk("lib")];
const offenders: { file: string; why: string }[] = [];
const stale: string[] = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  if (!SPINE.some((t) => src.includes(t))) continue;

  const usesOrder = /\border_id\b/.test(src);
  const usesProject = /\bproject_id\b/.test(src);
  const usesCycle = /\bcycle_id\b/.test(src);
  if (!usesOrder) continue;

  const listed = ORDER_ONLY[file];
  const complete = usesProject && usesCycle;

  if (complete && listed) {
    stale.push(file);
    continue;
  }
  if (complete || listed) continue;

  const missing = [!usesProject && "custom projects", !usesCycle && "editing plans"]
    .filter(Boolean)
    .join(" and ");
  offenders.push({ file, why: `reads order_id but never ${missing}` });
}

if (offenders.length) {
  console.log(
    `${offenders.length} file(s) touch a video but only know about purchases:\n`,
  );
  for (const o of offenders) console.log(`  ${o.file}\n      ${o.why}`);
  console.log(
    `\nEither handle all three owners, or add the file to ORDER_ONLY in
scripts/check-owners.ts with the reason it is genuinely order-only.\n`,
  );
  process.exit(1);
}

if (stale.length) {
  console.log(`${stale.length} file(s) listed as order-only now handle all three:\n`);
  for (const s of stale) console.log(`  ${s}`);
  console.log(`\nRemove them from ORDER_ONLY so the list stays honest.\n`);
}

console.log(
  `OK: every file that touches a video handles all three owners, or says why not. ${
    Object.keys(ORDER_ONLY).length
  } are order-only on purpose.`,
);
