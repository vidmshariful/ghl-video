"use client";

/*
 * Which account the signed-in person is working in. Owners work in their
 * own account (no header sent). A team member picks an account from the
 * profile menu; the choice persists per portal and rides every API call as
 * `X-Act-For`, which the server validates against account_members.
 *
 * Storage values: absent = never chosen (the client may auto-pick the only
 * membership), "self" = explicitly their own account, anything else = the
 * owner email they act for.
 */

let current: string | null = null;

export function initActFor(storageKey: string): string | null {
  try {
    const stored = localStorage.getItem(storageKey);
    current = stored && stored !== "self" ? stored : null;
  } catch {
    current = null;
  }
  return current;
}

export function getActFor(): string | null {
  return current;
}

export function hasChosenAccount(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) != null;
  } catch {
    return false;
  }
}

export function setActFor(storageKey: string, ownerEmail: string | null): void {
  current = ownerEmail;
  try {
    localStorage.setItem(storageKey, ownerEmail ?? "self");
  } catch {
    /* private mode */
  }
}

/** The header fragment every portal fetch spreads in. */
export function actForHeader(): Record<string, string> {
  return current ? { "X-Act-For": current } : {};
}
