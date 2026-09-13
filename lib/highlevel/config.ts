/*
 * What HighLevel gave us when the sub-account was provisioned: the ids of
 * the contact fields, the pipelines and their stages, the custom objects
 * and the associations the sync writes to. Made by scripts/hl-provision.mjs,
 * stored in hl_config per location, read here. Nothing in the sync guesses
 * an id, and a location that was never provisioned syncs nothing.
 *
 * Client-safe types; the loader takes a Supabase client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const CONTACT_FIELD_KEYS = [
  "lines",
  "arrangement",
  "retainerFee",
  "retainerVideos",
  "source",
  "lastSeen",
  "adminUrl",
  "customerId",
  "editingPlan",
] as const;
export type ContactFieldKey = (typeof CONTACT_FIELD_KEYS)[number];

export const PROJECT_STAGE_KEYS = [
  "backlog",
  "planning",
  "in_progress",
  "review",
  "revision",
  "approved",
  "cutdowns",
  "closed",
] as const;
export type ProjectStageKey = (typeof PROJECT_STAGE_KEYS)[number];

export const LEAD_STAGE_KEYS = ["new", "contacted", "quoted", "won", "lost"] as const;
export type LeadStageKey = (typeof LEAD_STAGE_KEYS)[number];

export type HlConfig = {
  locationId: string;
  /** contact custom fields, by our name -> HighLevel field id */
  contactFields: Record<ContactFieldKey, string>;
  pipelines: {
    leads: { id: string; stages: Record<LeadStageKey, string> };
    projects: { id: string; stages: Record<ProjectStageKey, string> };
  };
  objects: {
    project: { key: string; fields: Record<string, string> };
    video: { key: string; fields: Record<string, string> };
  };
  associations: { projectContact: string; videoContact: string };
};

/** The stored config for a location, or null when it was never provisioned. */
export async function loadHlConfig(db: SupabaseClient, locationId: string): Promise<HlConfig | null> {
  const { data } = await db.from("hl_config").select("config").eq("location_id", locationId).maybeSingle();
  if (!data?.config) return null;
  const c = data.config as Partial<HlConfig>;
  if (!c.contactFields || !c.pipelines?.projects || !c.objects?.project || !c.objects?.video || !c.associations)
    return null;
  return { ...(c as HlConfig), locationId };
}

/** The tags the sync keeps on a contact, derived from what the account has. */
export const HL_TAGS = {
  premade: "ghlv-premade",
  custom: "ghlv-custom",
  editing: "ghlv-editing",
  retainer: "ghlv-retainer",
  directBrief: "ghlv-direct-brief",
  lead: "ghlv-lead",
  internal: "ghlv-internal",
} as const;
/** Only these are ever removed by the sync; a tag the studio adds by hand is theirs. */
export const HL_MANAGED_TAGS: readonly string[] = Object.values(HL_TAGS);
