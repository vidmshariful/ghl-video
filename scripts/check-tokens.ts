/*
 * Does anything point at a design token that no longer exists?
 *
 * A dead token is silent in every direction, which is what makes it worth a
 * check. var(--gone) paints nothing and the element falls back to a browser
 * default. A concept board that sets --gone does nothing at all, so the board
 * looks broken and the tokens look innocent. And a documentation page naming
 * --gone teaches a name that cannot work, which is how a reference stops
 * being worth opening.
 *
 * Proof of why: the kit's own audit page advertised six token names one
 * commit after they were consolidated away. Nothing complained, because
 * nothing was looking.
 *
 *   npm run check:tokens
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { RETIRED_TOKENS } from "@/lib/design-tokens";

const ROOT = process.cwd();
const CSS_FILES = ["app/globals.css", "app/(sales)/sales.css"];
const CODE_ROOTS = ["app", "components", "lib"];
const CODE_EXT = /\.(tsx?|css)$/;

const problems: string[] = [];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (CODE_EXT.test(name)) out.push(full);
  }
  return out;
}

const files = CODE_ROOTS.flatMap((r) => walk(join(ROOT, r)));
const read = (f: string) => readFileSync(f, "utf8");
const rel = (f: string) => relative(ROOT, f);

/* ---- what exists ---- */

/* A declaration is a custom property at the start of a line, which is what a
 * :root or [data-surface] block looks like. Matching var(--x) here instead
 * would make every reference define itself and the check would pass always. */
const defined = new Set<string>();
for (const f of CSS_FILES) {
  for (const m of read(join(ROOT, f)).matchAll(/^\s*--([a-z0-9-]+)\s*:/gim)) {
    defined.add(m[1]);
  }
}

/* Not every definition lives in a stylesheet, and the ones that do not are
 * the easiest to mistake for ghosts:
 *   style={{ "--x": ... }}          declared inline on an element
 *   variable: "--font-body"          next/font, stamped on <html> at render
 *   setProperty("--chrome-h", ...)   measured at runtime, see Header.tsx
 * All three are real. Missing them would make the check cry wolf on its
 * first run, which is how a check gets switched off. */
for (const f of files) {
  const body = read(f);
  for (const m of body.matchAll(/["']--([a-z0-9-]+)["']\s*:/g)) defined.add(m[1]);
  for (const m of body.matchAll(/variable:\s*["']--([a-z0-9-]+)["']/g)) defined.add(m[1]);
  for (const m of body.matchAll(/setProperty\(\s*["']--([a-z0-9-]+)["']/g)) defined.add(m[1]);
}

/*
 * A custom property, and not the many things that look like one.
 *
 * The lookbehind is doing real work: the sales system uses BEM, so
 * `.sp-section--band` and `.sp-btn--primary` are class modifiers rather than
 * tokens. Without it the check reports nine imaginary tokens on the sales
 * page alone and becomes noise. A trailing dash means a namespace being
 * discussed in prose (`--sp-*`, `--kit-*`), which names no single token, so
 * the caller skips those.
 */
const TOKEN = /(?<![\w-])--([a-z][a-z0-9-]*)/g;
const isNamespace = (name: string) => name.endsWith("-");

const retired = new Set(Object.keys(RETIRED_TOKENS));

/* ---- rule 1: a retirement has to be true ---- */
for (const name of retired) {
  if (defined.has(name)) {
    problems.push(
      `--${name} is listed as retired in lib/design-tokens.ts but is still defined in CSS. Either it came back, in which case drop it from RETIRED_TOKENS, or the definition is a leftover.`,
    );
  }
}

/* ---- rule 2: every var() reference resolves ---- */
for (const f of files) {
  const body = read(f);
  const seen = new Set<string>();
  for (const m of body.matchAll(/var\(\s*--([a-z0-9-]+)/g)) {
    const name = m[1];
    if (defined.has(name) || seen.has(name)) continue;
    seen.add(name);
    const note = retired.has(name) ? ` It was retired: now ${RETIRED_TOKENS[name]}` : "";
    problems.push(`${rel(f)}: uses var(--${name}), which is not defined anywhere.${note}`);
  }
}

/* ---- rule 3: the kit may not name a token that is neither live nor
 * knowingly retired.
 *
 * The kit is documentation, so its history tables legitimately mention names
 * that are gone. That is why RETIRED_TOKENS exists: a merged token stays
 * mentionable, but only once somebody has written down what replaced it.
 * Renaming a token without recording it is what this catches. */
const kitFiles = files.filter((f) => /\/uikits\//.test(rel(f)));
for (const f of kitFiles) {
  const body = read(f);
  const seen = new Set<string>();
  for (const m of body.matchAll(TOKEN)) {
    const name = m[1];
    if (isNamespace(name) || defined.has(name) || retired.has(name) || seen.has(name)) continue;
    seen.add(name);
    problems.push(
      `${rel(f)}: names --${name}, which is not defined and is not recorded as retired. If it was renamed or merged, add it to RETIRED_TOKENS in lib/design-tokens.ts with what replaced it.`,
    );
  }
}

/* ---- rule 4: every concept board sets tokens something actually reads ----
 *
 * This is the one that matters most for the kit's whole purpose. A board is
 * only a set of overrides, so a board naming a dead token is not an error
 * anywhere: it just quietly fails to change that part of the page, and the
 * preview stops telling the truth about what a reskin would do. */
const boardsPath = join(ROOT, "components/uikits/boards.ts");
const boardsSrc = read(boardsPath);
for (const block of boardsSrc.matchAll(/tokens:\s*\{([\s\S]*?)\n\s{2,}\}/g)) {
  for (const m of block[1].matchAll(/["']?([a-z][a-z0-9-]+)["']?\s*:/g)) {
    const name = m[1];
    if (defined.has(name)) continue;
    problems.push(
      `components/uikits/boards.ts: a board sets --${name}, which nothing defines, so that value would silently do nothing when the board is previewed.`,
    );
  }
}

if (problems.length) {
  console.error(`Design tokens are out of step, ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

console.log(
  `OK: ${defined.size} tokens defined, ${retired.size} recorded as retired. Every var() resolves, every board sets something real, and the kit names no ghost.`,
);
