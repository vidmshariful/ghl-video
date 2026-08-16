/*
 * Does the handbook still describe the system we actually have?
 *
 * Documentation does not rot because people are careless, it rots because
 * nothing tells them it has. This is what tells them. It cannot check prose,
 * but it can check every hard fact the handbook leans on, and those are
 * exactly the things that change when a feature changes.
 *
 * Proof of why: the customer help page described handing over one delivery
 * link for months after we replaced that with per-video approval. No check
 * existed, so nothing complained.
 *
 *   npm run check:handbook
 */
import { HANDBOOK, type FactId } from "@/lib/handbook";
import {
  DELIVERABLE_STATUSES,
  REVISIONS_INCLUDED,
  STATUS_LABEL,
} from "@/lib/deliverable-status";
import { ROLES, ROLE_BLURB, ROLE_LABELS } from "@/app/admin/roles";
import { ALL_VIEWS } from "@/app/admin/nav";

const problems: string[] = [];

/* Every facts block must resolve to something the API can actually build. */
const KNOWN_FACTS: FactId[] = [
  "video-statuses",
  "order-stages",
  "revision-policy",
  "roles",
  "emails",
  "catalog-counts",
];

for (const page of HANDBOOK) {
  for (const b of page.blocks) {
    if (b.kind !== "facts") continue;
    if (!KNOWN_FACTS.includes(b.id)) {
      problems.push(`${page.slug}: asks for facts "${b.id}", which nothing knows how to build`);
    }
  }
}

/* The handbook names screens and statuses in its prose. If one gets renamed
 * or removed, the sentence quietly becomes a lie. */
const prose = HANDBOOK.flatMap((p) => [
  p.title,
  p.summary,
  ...p.blocks.flatMap((b) =>
    b.kind === "text" ? [b.body] : b.kind === "steps" ? b.steps.flatMap((s) => [s.title, s.body]) : [],
  ),
]).join(" ");

/* Statuses are referred to by their human label, so those labels must exist. */
for (const s of DELIVERABLE_STATUSES) {
  const label = STATUS_LABEL[s];
  if (!label) problems.push(`status "${s}" has no label, but the handbook renders labels`);
}

/* Screens named in the guidance have to be real views. */
const NAMED_SCREENS: { phrase: string; view: string }[] = [
  { phrase: "Products & Packs", view: "products" },
  { phrase: "Production", view: "production" },
  { phrase: "Settings, Emails", view: "settings" },
  { phrase: "Settings, Team", view: "settings" },
];
for (const n of NAMED_SCREENS) {
  if (!prose.includes(n.phrase)) continue;
  if (!ALL_VIEWS.includes(n.view as never)) {
    problems.push(`handbook points at "${n.phrase}" but the ${n.view} screen no longer exists`);
  }
}

/* Claims with a number in them are the most dangerous kind: they read as true
 * long after they stop being true. So the rule is not "does this number match"
 * but "why is this number written down at all" - anything the system knows
 * belongs in a facts block, where it is read live and cannot drift.
 *
 * An earlier version of this check looked for one exact phrase and therefore
 * passed no matter what, which is worse than no check because it looks like
 * cover. */
const NUMBER_WORDS = "(one|two|three|four|five|\\d+)";
const restated: { where: string; text: string }[] = [];
for (const page of HANDBOOK) {
  const texts = page.blocks.flatMap((b) =>
    b.kind === "text" ? [b.body] : b.kind === "steps" ? b.steps.map((s) => s.body) : [],
  );
  for (const t of texts) {
    const m = t.match(new RegExp(`${NUMBER_WORDS}\\s+(round|revision)`, "i"));
    if (m) restated.push({ where: page.slug, text: m[0] });
  }
}
for (const r of restated) {
  problems.push(
    `${r.where}: writes the revision count into prose ("${r.text}"). It is ${REVISIONS_INCLUDED} in code and would go stale here. Use the revision-policy facts block instead.`,
  );
}

/* Every role must be describable, since the roles table is generated from them. */
for (const r of ROLES) {
  if (!ROLE_LABELS[r] || !ROLE_BLURB[r]) {
    problems.push(`role "${r}" is missing a label or description, so the roles table would be blank`);
  }
}

/* A page with no content is a page somebody started and abandoned. */
for (const p of HANDBOOK) {
  if (!p.blocks.length) problems.push(`${p.slug}: has no content`);
  if (!p.summary.trim()) problems.push(`${p.slug}: has no summary, so the index card reads blank`);
}

if (problems.length) {
  console.error(`Handbook is out of step with the system, ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

console.log(
  `OK: ${HANDBOOK.length} handbook pages, every fact block resolvable, every screen and role they name still exists.`,
);
