/*
 * Is a portal screen inventing its own buttons again?
 *
 * components/portal/ui.tsx exists because they all were: twenty five files
 * opening with their own `btn`, `field` and `lab` strings, each a slightly
 * different guess at the same thing.
 *
 * That number is higher than the twenty two first reported, because the
 * one-line grep used to measure it missed every declaration whose value sat
 * on the following line. This check reads both shapes, which is the whole
 * argument for a check over a grep somebody runs by hand. That is what made the portals read as everything inline full width,
 * and adding a shared vocabulary fixes it exactly once. Nothing stops the
 * next screen from starting the pile again, which is what this is for.
 *
 * A RATCHET, NOT A CLIFF
 * ----------------------
 * Every screen is still on the old way today, so a check that simply refused
 * them would have to be switched off until the last conversion lands, which
 * is weeks of no protection during the exact period the pile could grow.
 *
 * So the files that have not been converted yet are listed below, and the
 * check refuses local styles anywhere else. A new screen cannot start the
 * pile, and a converted screen cannot slide back. The list only ever
 * shrinks: a name comes off when that screen moves onto the vocabulary and
 * can never go back on, because putting it back is a visible edit somebody
 * has to justify.
 *
 * It doubles as the migration tracker. When this list is empty, the
 * conversion is done.
 *
 *   npm run check:portal-ui
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const ROOTS = ["app/admin", "app/portal", "app/partners", "components/portal"];

/* The names screens kept reinventing. Matched at the start of a line, so a
 * `const btnLabel = "Save"` holding a WORD rather than a class list is not
 * caught: the rule is about styling, not about naming. */
const LOCAL_STYLE =
  /^const (btn|field|lab|input|card|chip|pill|box|cell|th|td|sel)[A-Za-z]*\s*=\s*$|^const (btn|field|lab|input|card|chip|pill|box|cell|th|td|sel)[A-Za-z]*\s*=\s*["'`]/;

/* Not yet converted. Delete a line when its screen moves onto the shared
 * vocabulary. Adding one back is the thing to argue about in review. */
const NOT_YET_CONVERTED = new Set([
  "app/admin/BlogScreen.tsx",
  "app/admin/BrandingBrief.tsx",
  "app/admin/BumpsScreen.tsx",
  "app/admin/CatalogScreen.tsx",
  "app/admin/CouponsScreen.tsx",
  "app/admin/EmailTemplatesScreen.tsx",
  "app/admin/HealthScreen.tsx",
  "app/admin/JournalScreen.tsx",
  "app/admin/PartnersScreen.tsx",
  "app/admin/ProductionJob.tsx",
  "app/admin/ProductsHub.tsx",
  "app/admin/ProductsScreen.tsx",
  "app/admin/ReferenceScreen.tsx",
  "app/admin/SeoScreen.tsx",
  "app/admin/SettingsScreen.tsx",
  "app/admin/StudioScreen.tsx",
  "app/admin/SubscriptionsScreen.tsx",
  "app/admin/TeamScreen.tsx",
  "app/partners/PartnersClient.tsx",
  "app/partners/apply/ApplyClient.tsx",
  "app/partners/set-password/SetPasswordClient.tsx",
  "app/portal/set-password/SetPasswordClient.tsx",
  "components/portal/account.tsx",
  "components/portal/booking.tsx",
  "components/portal/team.tsx",
]);

/* The vocabulary itself, and the chrome, are where these strings belong. */
const OWNS_THE_STYLES = new Set([
  "components/portal/ui.tsx",
  "components/portal/charts.tsx",
  "components/portal/Shell.tsx",
]);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const offenders: { file: string; line: number; text: string }[] = [];
const stale: string[] = [];
const seen = new Set<string>();

for (const file of ROOTS.flatMap((r) => walk(join(ROOT, r)))) {
  const rel = relative(ROOT, file);
  if (OWNS_THE_STYLES.has(rel)) continue;

  const lines = readFileSync(file, "utf8").split("\n");
  const hits = lines
    .map((text, i) => ({ text: text.trim(), line: i + 1 }))
    .filter((l) => LOCAL_STYLE.test(l.text));

  if (hits.length) seen.add(rel);
  if (NOT_YET_CONVERTED.has(rel)) continue;
  for (const h of hits) offenders.push({ file: rel, line: h.line, text: h.text.slice(0, 76) });
}

/* A name on the list that no longer declares anything is a conversion
 * somebody finished without ticking it off. Reported so the list stays an
 * honest count of what is left rather than quietly overstating the work. */
for (const f of NOT_YET_CONVERTED) if (!seen.has(f)) stale.push(f);

if (offenders.length) {
  console.error(
    `${offenders.length} portal screen(s) declaring their own styles instead of using the shared vocabulary:\n`,
  );
  for (const o of offenders) {
    console.error(`  ${o.file}:${o.line}`);
    console.error(`     ${o.text}`);
  }
  console.error(
    `\nUse components/portal/ui.tsx: Button, Field, Input, Card, Chip, Table.`,
  );
  console.error(
    `See them all at /uikits/portal in development. If this screen genuinely`,
  );
  console.error(
    `cannot use them, say why in scripts/check-portal-ui.ts rather than here.`,
  );
  process.exit(1);
}

if (stale.length) {
  console.log(`${stale.length} screen(s) already converted but still listed as pending:\n`);
  for (const s of stale) console.log(`  ${s}`);
  console.log(`\nRemove them from NOT_YET_CONVERTED so the count stays honest.\n`);
}

console.log(
  `OK: no new local styles. ${NOT_YET_CONVERTED.size - stale.length} screen(s) still to convert onto the shared vocabulary.`,
);
