import "server-only";
import { supabaseAdmin } from "./supabase-admin";

/*
 * Ensure a Supabase Auth account exists for a buyer's email, so they can
 * set a password and sign into the portal without waiting for a magic
 * link. Called best-effort right after the customer row is created; a
 * failure here must NEVER fail the order. Idempotent: an existing
 * account is left untouched (a repeat buyer just hits "already
 * registered", which is the happy path). The account is created with the
 * email pre-confirmed and NO password; the buyer sets one via the
 * portal's set-password flow (or signs in with the email-link fallback).
 */
export async function ensureAuthAccount(email: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  if (!clean) return;
  try {
    const { error } = await supabaseAdmin().auth.admin.createUser({
      email: clean,
      email_confirm: true,
    });
    if (error && !/already|exist|registered/i.test(error.message)) {
      console.error(`[account] createUser failed for ${clean}: ${error.message}`);
    }
  } catch (err) {
    console.error(`[account] ensureAuthAccount error: ${(err as Error).message}`);
  }
}
