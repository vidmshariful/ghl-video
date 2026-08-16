import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { HANDBOOK, type FactId } from "@/lib/handbook";
import {
  DELIVERABLE_STATUSES,
  REVISIONS_INCLUDED,
  STATUS_LABEL,
  isWatchable,
  type DeliverableStatus,
} from "@/lib/deliverable-status";
import { ROLES, ROLE_BLURB, ROLE_LABELS } from "@/app/admin/roles";

export const runtime = "nodejs";

/*
 * The handbook, with its facts filled in from the systems that own them.
 *
 * The point of doing it here rather than writing the facts into the page: a
 * status, a policy or a role exists in exactly one place in this codebase, and
 * the handbook reads that place. Nobody has to remember to update two things,
 * because there is only ever one.
 */

/* What the client is told for each status, taken from the words the portal
 * actually shows them. Kept beside the statuses so the two move together. */
const CLIENT_SEES: Record<DeliverableStatus, string> = {
  queued: "In the queue. We start this once your brief is in.",
  in_production: "Our editors are building this one now.",
  ready: "Ready for you to watch.",
  revisions: "We are making the changes you asked for.",
  approved: "You approved this one. It is yours to use.",
};

const WHEN_TO_USE: Record<DeliverableStatus, string> = {
  queued: "Where a video starts. Nothing to do.",
  in_production: "Set it when you pick the video up.",
  ready: "Set it when the link is in and you are happy for them to see it. This releases the video and emails them.",
  revisions: "The client sets this by asking for changes. You can set it if you know more is coming.",
  approved: "The client sets this. Set it yourself only to close out someone who never came back.",
};

const STAGES = [
  { key: "paid", label: "Paid", body: "Money in, nothing else yet. Set by the payment, not by a person." },
  { key: "intake", label: "Intake", body: "Waiting on the client's brief. Production cannot start without it." },
  { key: "production", label: "In production", body: "At least one video is being built, or changes are coming back." },
  { key: "review", label: "Review", body: "Every video is with the client. Nothing is owed by us." },
  { key: "delivered", label: "Complete", body: "Every video approved. The order closed itself and the client has their wrap-up." },
];

async function facts(id: FactId) {
  const db = supabaseAdmin();

  if (id === "video-statuses") {
    return {
      columns: ["Status", "When to use it", "What the client sees", "Can they watch it"],
      rows: DELIVERABLE_STATUSES.map((s) => [
        STATUS_LABEL[s],
        WHEN_TO_USE[s],
        CLIENT_SEES[s],
        isWatchable(s) ? "Yes" : "No, the link is withheld",
      ]),
    };
  }

  if (id === "order-stages") {
    return {
      columns: ["Stage", "What it means"],
      rows: STAGES.map((s) => [s.label, s.body]),
    };
  }

  if (id === "revision-policy") {
    return {
      columns: ["What we promise", "Detail"],
      rows: [
        [
          "Rounds included",
          `${REVISIONS_INCLUDED} per video. The client is told this under the buttons before they use it, and asking a second time is refused with a line pointing them to us.`,
        ],
        [
          "After they approve",
          "Their review closes for that video. Anything else is a conversation, and we re-open it from the job page.",
        ],
        [
          "Old cuts",
          "Every cut is kept while the work is live. Clear the old ones from the job page once a video is approved.",
        ],
      ],
    };
  }

  if (id === "roles") {
    return {
      columns: ["Role", "What it gets"],
      rows: ROLES.map((r) => [ROLE_LABELS[r], ROLE_BLURB[r]]),
    };
  }

  if (id === "emails") {
    const { data } = await db
      .from("email_templates")
      .select("key, name, description, enabled")
      .order("key");
    const { DEFAULT_TEMPLATES } = await import("@/lib/email/templates");
    // DB rows win, code defaults fill in anything never edited
    const seen = new Set((data ?? []).map((t) => t.key as string));
    const all = [
      ...(data ?? []).map((t) => ({
        name: t.name as string,
        description: (t.description as string) ?? "",
        enabled: t.enabled !== false,
      })),
      ...DEFAULT_TEMPLATES.filter((t) => !seen.has(t.key)).map((t) => ({
        name: t.name,
        description: t.description,
        enabled: true,
      })),
    ];
    return {
      columns: ["Email", "When it sends", "On"],
      rows: all.map((t) => [t.name, t.description, t.enabled ? "Yes" : "Turned off"]),
    };
  }

  if (id === "catalog-counts") {
    const { data } = await db.from("catalog").select("kind");
    const n = (k: string) => (data ?? []).filter((c) => c.kind === k).length;
    return {
      columns: ["Shape", "How many", "What it is"],
      rows: [
        ["Videos", String(n("video")), "Sold on their own, or inside a pack."],
        ["Packs", String(n("pack")), "Fixed contents we choose."],
        ["Bundles", String(n("bundle")), "A count per category; the client picks the titles at intake."],
      ],
    };
  }

  return { columns: [], rows: [] };
}

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const ids = [
    ...new Set(
      HANDBOOK.flatMap((p) =>
        p.blocks.filter((b) => b.kind === "facts").map((b) => (b as { id: FactId }).id),
      ),
    ),
  ];
  const resolved = Object.fromEntries(
    await Promise.all(ids.map(async (id) => [id, await facts(id)] as const)),
  );

  /* Recent changes come from the journal, which is already written in plain
   * language for the owner. No second changelog to maintain. */
  const db = supabaseAdmin();
  const { data: recent } = await db
    .from("journal")
    .select("title, body, created_at, kind")
    .eq("kind", "log")
    .order("created_at", { ascending: false })
    .limit(8);

  return NextResponse.json({
    pages: HANDBOOK,
    facts: resolved,
    recent: (recent ?? []).map((r) => ({
      title: r.title as string,
      // first paragraph is enough for a "what changed" list
      body: String(r.body ?? "").split("\n\n")[0],
      at: r.created_at as string,
    })),
  });
}
