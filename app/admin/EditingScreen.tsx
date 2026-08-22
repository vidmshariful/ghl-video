"use client";

import { PageHeader } from "@/components/portal/ui";
import { EditingBoard, EditingClients } from "./EditingBoard";

/*
 * Editing plans, the third service line.
 *
 * A screen of its own rather than a tab inside Premade. The three lines sell
 * differently, are made differently and are counted differently: an order
 * board, a project board and a monthly board are three jobs, not three views
 * of one. Putting editing inside the order board made it look like a special
 * case of an order, which is exactly the confusion the spine exists to end.
 *
 * Which client is open lives in the URL (/admin/editing/extendly/) rather
 * than in this component, so a board can be sent to somebody, bookmarked,
 * and walked back out of with the browser's own back button.
 */
export function EditingScreen({
  openSlug,
  onOpenClient,
}: {
  openSlug: string | null;
  onOpenClient: (slug: string | null) => void;
}) {
  return (
    <div className="w-full">
      {!openSlug && (
        <PageHeader
          title="Editing"
          description="Everyone on a monthly plan. Open a client for their board: what they have asked for, what needs footage, and what is with them for review."
        />
      )}
      {openSlug ? (
        <EditingBoard slug={openSlug} onBack={() => onOpenClient(null)} />
      ) : (
        <EditingClients onOpen={onOpenClient} />
      )}
    </div>
  );
}
