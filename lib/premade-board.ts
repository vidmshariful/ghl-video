/*
 * The Premade board's columns, derived from the work and never set by hand.
 *
 * The board used to show the order's stored stage in five columns (Paid,
 * Intake, In production, Review, Delivered) with arrows to move a card, while
 * the stage was also derived from the videos by the job page: two controls
 * writing one record, and an "Intake" column nothing could reach. The
 * column is now a plain reading of what is true (Premade review, 16
 * September 2026): the brief, the videos, and whether the order is done.
 */
import type { FulfillmentStage } from "@/lib/order-stage";

export const BOARD_COLUMNS = [
  { key: "brief", label: "Waiting on brief" },
  { key: "start", label: "Ready to start" },
  { key: "building", label: "Building" },
  { key: "client", label: "With the client" },
  { key: "done", label: "Done" },
] as const;

export type BoardColumn = (typeof BOARD_COLUMNS)[number]["key"];

/**
 * Which column an order sits in. `stage` is the stored stage, which the job
 * route keeps derived from the videos; `briefIn` is the brief flag.
 */
export function boardColumn(stage: FulfillmentStage | string, briefIn: boolean): BoardColumn {
  if (stage === "delivered") return "done";
  if (!briefIn) return "brief";
  if (stage === "review") return "client";
  if (stage === "production") return "building";
  return "start";
}
