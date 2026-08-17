/*
 * Has a colour literal crept back into a component?
 *
 * The tokenisation pass took the main site from two in five painted surfaces
 * ignoring the skin down to almost none, which is the only reason a concept
 * board previews the truth. Nothing defends that. One `bg-[#0a0a0a]` typed
 * into a new component is invisible in review, costs nothing that day, and
 * quietly takes a piece of the page out of the skin's reach forever.
 *
 * So this counts them, and the rule is an allowlist rather than a number.
 * A budget ("no more than 34") tells you nothing about whether the 34 are
 * the right ones, and every honest addition makes the budget a lie. A named
 * exception with a reason beside it stays readable a year from now.
 *
 *   npm run check:leaks
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { LITERAL_ALLOWLIST, isAllowlisted } from "@/lib/design-tokens";

const ROOT = process.cwd();

/*
 * Where the user interface lives, and therefore where a colour literal is a
 * leak. lib/ is deliberately outside this: the part-boundary rules keep UI out
 * of it, and what colours it does hold are inside generated email HTML, where
 * a literal is the only thing mail clients render. Scanning it would mean
 * pardoning every email template by name, which buys nothing and makes the
 * allowlist harder to read.
 */
const ROOTS = ["app", "components"];
const EXT = /\.(tsx?|css)$/;

/* Three and six digit hex. Eight digit (with alpha) counts too: it is the
 * same mistake wearing a longer coat. */
const HEX = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;

type Leak = { file: string; line: number; text: string; value: string };
const leaks: Leak[] = [];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXT.test(name)) out.push(full);
  }
  return out;
}

/*
 * A literal handed over as a token's fallback is not a leak, it is the
 * correct shape for the few places that cannot use var() directly: GSAP
 * tweens concrete colours, and Stripe paints the card fields inside a
 * cross-origin iframe our properties never reach. Both read the resolved
 * token and keep a literal only for the moment before the tokens exist.
 *
 * Recognised by a token reference sitting to the left of the literal on the
 * same line, which covers read("--dim", "#7d8499"), t("--gold", "#FCC000")
 * and var(--x, #hex) without needing to know each helper by name.
 */
function isGuarded(line: string, at: number) {
  return /--[a-z][a-z0-9-]*/.test(line.slice(0, at));
}

for (const file of ROOTS.flatMap((r) => walk(join(ROOT, r)))) {
  const rel = relative(ROOT, file);

  /* The kit is dev-only and its whole job is displaying raw values. */
  if (rel.includes("uikits")) continue;

  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(HEX)) {
      if (isGuarded(line, m.index)) continue;
      if (isAllowlisted(rel, m[0])) continue;
      leaks.push({ file: rel, line: i + 1, text: line.trim().slice(0, 90), value: m[0] });
    }
  });
}

if (leaks.length) {
  console.error(
    `${leaks.length} colour literal(s) outside the token system:\n`,
  );
  for (const l of leaks) {
    console.error(`  ${l.file}:${l.line}  ${l.value}`);
    console.error(`     ${l.text}`);
  }
  console.error(
    `\nUse the token instead (var(--gold), bg-canvas, border-hair and so on).`,
  );
  console.error(
    `If the literal is correct, add the file to LITERAL_ALLOWLIST in lib/design-tokens.ts with the reason.`,
  );
  process.exit(1);
}

console.log(
  `OK: no colour literals outside the token system. ${LITERAL_ALLOWLIST.length} file(s) allowed one, each with a reason.`,
);
