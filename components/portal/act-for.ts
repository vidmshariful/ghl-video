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

/**
 * Forget the choice entirely, so the next load is treated as a first visit.
 *
 * Different from setActFor(key, null), which RECORDS "I chose my own
 * account" and permanently disables the auto-pick. Error recovery must use
 * this one: a member whose saved account failed to load once should not be
 * pinned to an empty account of their own forever.
 */
export function clearActFor(storageKey: string): void {
  current = null;
  try {
    localStorage.removeItem(storageKey);
  } catch {
    /* private mode */
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
