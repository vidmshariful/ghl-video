import { AdminClient } from "../AdminClient";
import { ALL_VIEWS, type View } from "../nav";

/* Every admin screen is a real URL: /admin/orders/, /admin/settings/, ...
 * The segment picks the opening screen; anything unknown lands on the
 * dashboard. Access control stays inside the client (role gates + RLS). */
export default async function AdminViewPage({
  params,
}: {
  params: Promise<{ view?: string[] }>;
}) {
  const { view } = await params;
  const seg = view?.[0] ?? "dashboard";
  const initial = (ALL_VIEWS as string[]).includes(seg) ? (seg as View) : "dashboard";
  return <AdminClient initialView={initial} />;
}
