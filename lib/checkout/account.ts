import "server-only";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "./supabase-admin";
import { isUsablePassword } from "./password-rules";

/*
 * Ensure a Supabase Auth account exists for a buyer's email, so they can sign
 * into the portal the moment they have paid.
 *
 * Called best-effort right after the customer row is created; a failure here
 * must NEVER fail the order. Idempotent: an existing account is left alone.
 *
 * ON THE PASSWORD, AND WHY IT IS ONLY EVER SET ON CREATE
 * -----------------------------------------------------
 * The account used to be created with no password at all, which left a real
 * gap: a buyer paid, got an account, and then hit a reset screen the first
 * time they tried to use it. So checkout now collects one.
 *
 * It is applied ONLY when this call creates the account. Updating the
 * password of an account that already exists would be an account takeover
 * hole with a price tag on it: anyone who knew a customer's email could buy
 * the cheapest thing in the catalogue, type a new password at checkout, and
 * own that customer's portal. So a repeat buyer keeps whatever password they
 * already had, and whatever they typed at checkout is discarded.
 *
 * That is also why this function reports whether it created the account. The
 * caller needs to know whether the password it just collected is live, so it
 * can either sign them straight in or tell them to use the one they have.
 */

export type EnsureAccountResult = {
  /** true only when this call created the account */
  created: boolean;
  /** true when the buyer can sign in with the password they just typed */
  passwordSet: boolean;
};

/**
 * The password typed at checkout, kept as a hash until the money moves.
 *
 * Applied only at settlement (lib/checkout/settle.ts, the plan activation
 * in the Stripe webhook), and only when this checkout is the one that made
 * the login: a login that already exists keeps the password it has. Too
 * short is treated as not supplied, as before.
 */
export function hashCheckoutPassword(password: string | null | undefined): string | null {
  if (typeof password !== "string" || !isUsablePassword(password)) return null;
  return bcrypt.hashSync(password, 10);
}

/**
 * The portal login, made now that the payment settled.
 *
 * Created with the password typed at checkout when there was one (as a
 * hash: GoTrue applies a hash on create only, never on update, which is
 * why the login is held back until this moment rather than created early
 * and updated). An email that already has a login keeps the password it
 * has, exactly as before; the checkout password is then simply ignored.
 */
export async function settleCheckoutLogin(email: string, passwordHash: string | null): Promise<EnsureAccountResult> {
  const clean = email.trim().toLowerCase();
  if (!clean) return { created: false, passwordSet: false };
  try {
    const { error } = await supabaseAdmin().auth.admin.createUser({
      email: clean,
      email_confirm: true,
      ...(passwordHash ? { password_hash: passwordHash } : {}),
    });
    if (!error) return { created: true, passwordSet: Boolean(passwordHash) };
    if (/already|exist|registered/i.test(error.message)) return { created: false, passwordSet: false };
    console.error(`[account] createUser at settlement failed for ${clean}: ${error.message}`);
    return { created: false, passwordSet: false };
  } catch (err) {
    console.error(`[account] settleCheckoutLogin error: ${(err as Error).message}`);
    return { created: false, passwordSet: false };
  }
}

export async function ensureAuthAccount(
  email: string,
  password?: string | null,
): Promise<EnsureAccountResult> {
  const clean = email.trim().toLowerCase();
  if (!clean) return { created: false, passwordSet: false };

  /* Too short is treated as not supplied rather than as an error: checkout
   * validates this properly on the way in, and a weak password must never be
   * the thing that stops an order completing. */
  const pw = typeof password === "string" && isUsablePassword(password) ? password : null;

  try {
    const { error } = await supabaseAdmin().auth.admin.createUser({
      email: clean,
      email_confirm: true,
      ...(pw ? { password: pw } : {}),
    });

    if (!error) return { created: true, passwordSet: Boolean(pw) };

    /* Already registered is the happy path for a repeat buyer, not a fault.
     * Their existing password stands, untouched, for the reason above. */
    if (/already|exist|registered/i.test(error.message)) {
      return { created: false, passwordSet: false };
    }

    /* Never log the password, and it is not in the message anyway. */
    console.error(`[account] createUser failed for ${clean}: ${error.message}`);
    return { created: false, passwordSet: false };
  } catch (err) {
    console.error(`[account] ensureAuthAccount error: ${(err as Error).message}`);
    return { created: false, passwordSet: false };
  }
}

