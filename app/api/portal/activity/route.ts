import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { resolvePortalContext } from "@/lib/account-team";

export const runtime = "nodejs";

/*
 * The portal saying who is in it.
 *
 * Three things it is told: somebody signed in, somebody signed out, and a
 * tab is still open. The first two go in the log. The third only refreshes
 * that person's row in portal_presence, because a ping a minute per open tab
 * would bury the sign ins under its own noise.
 *
 * Staff using View as client are dropped on the floor. Us reading a client's
 * portal is not the client using it, and a usage log that cannot tell the
 * difference is wrong in the direction that flatters us.
 *
 * Fail-soft everywhere. This is bookkeeping about a visit, and it must never
 * be the reason somebody cannot use their portal, so every path answers ok.
 */
export async function POST(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx) return NextResponse.json({ ok: false }, { status: ctx.failStatus });
  if (ctx.viewingAsAdmin) return NextResponse.json({ ok: true, skipped: "staff" });

  const body = (await req.json().catch(() => ({}))) as { kind?: unknown };
  const kind = body.kind;
  const actor = ctx.selfEmail.toLowerCase();
  const account = ctx.ownerEmail.toLowerCase();

  try {
    if (kind === "signed_in" || kind === "signed_out") {
      await db.from("portal_activity").insert({ account_email: account, actor_email: actor, kind });
      /* a sign in is also the freshest possible presence; a sign out clears
         it, so a closed session cannot read as an open tab */
      if (kind === "signed_in") {
        await db
          .from("portal_presence")
          .upsert(
            { actor_email: actor, account_email: account, last_seen_at: new Date().toISOString() },
            { onConflict: "actor_email,account_email" },
          );
      } else {
        await db
          .from("portal_presence")
          .delete()
          .eq("actor_email", actor)
          .eq("account_email", account);
      }
    } else if (kind === "ping") {
      await db
        .from("portal_presence")
        .upsert(
          { actor_email: actor, account_email: account, last_seen_at: new Date().toISOString() },
          { onConflict: "actor_email,account_email" },
        );
    }
  } catch {
    /* never worth failing a page over */
  }

  return NextResponse.json({ ok: true });
}
