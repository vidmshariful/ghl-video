/*
 * What counts as a usable password, in a file with no imports.
 *
 * It lives apart from account.ts for one reason: that file is `server-only`,
 * and the checkout form is a client component. A client importing it fails
 * the build. The rule itself has to be known in both places, because a
 * minimum the form does not enforce is a minimum the server silently drops,
 * and the buyer would be told their account was ready when it was not.
 *
 * Same reason lib/deliverable-status.ts sits apart from lib/deliverables.ts.
 */

/** Supabase Auth's own floor is 6. Eight is ours, and it is the one shown. */
export const PASSWORD_MIN_LENGTH = 8;

export const isUsablePassword = (s: string) => s.length >= PASSWORD_MIN_LENGTH;
