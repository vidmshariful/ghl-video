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
  /* /admin/customers/<id>/ opens that client's record directly, and
     /admin/custom/<id>/ opens that project's page the same way */
  const customerId = initial === "customers" && view?.[1] ? view[1] : null;
  const projectId = initial === "custom" && view?.[1] ? view[1] : null;
  return (
    <AdminClient
      initialView={initial}
      initialCustomerId={customerId}
      initialProjectId={projectId}
    />
  );
}
