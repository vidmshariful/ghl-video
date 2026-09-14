import "server-only";
import { existingOpportunityId } from "./highlevel-errors";

/*
 * HighLevel (LeadConnector) API v2 sync. Called from the Stripe webhook
 * AFTER payment succeeds, and fully decoupled from it: the caller wraps
 * this so a HighLevel failure never fails or reverses a captured payment.
 *
 * Flow: upsert the contact, add the purchase tags (which trigger the
 * existing fulfillment workflows), then create the opportunity in the
 * "000. Closed Clients" pipeline. Endpoint shapes are verified against
 * the live account during the test purchase.
 */
import { hlFetch, locationId } from "@/lib/highlevel/client";

/* still importable from here: the quote route and older callers use these names */
export { hlFetch, locationId };

function splitName(name?: string): { firstName?: string; lastName?: string } {
  if (!name) return {};
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export async function upsertContact(input: {
  email: string;
  name?: string;
  phone?: string;
  company?: string;
}): Promise<string> {
  const { firstName, lastName } = splitName(input.name);
  const body: Record<string, unknown> = {
    locationId: locationId(),
    email: input.email,
  };
  if (firstName) body.firstName = firstName;
  if (lastName) body.lastName = lastName;
  if (input.name) body.name = input.name;
  if (input.phone) body.phone = input.phone;
  if (input.company) body.companyName = input.company;

  const j = await hlFetch("/contacts/upsert", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const contact = (j.contact as Record<string, unknown>) ?? j;
  const id = (contact.id as string) ?? (j.id as string);
  if (!id) throw new Error(`HL upsertContact: no contact id in ${JSON.stringify(j).slice(0, 200)}`);
  return id;
}

export async function addTags(contactId: string, tags: string[]): Promise<void> {
  if (!tags.length) return;
  await hlFetch(`/contacts/${contactId}/tags`, {
    method: "POST",
    body: JSON.stringify({ tags }),
  });
}

async function createOpportunityIn(input: {
  contactId: string;
  name: string;
  monetaryValue: number;
  pipelineId: string;
  pipelineStageId: string;
}): Promise<string> {
  let j: Record<string, unknown>;
  try {
    j = await hlFetch("/opportunities/", {
      method: "POST",
      body: JSON.stringify({
        pipelineId: input.pipelineId,
        pipelineStageId: input.pipelineStageId,
        locationId: locationId(),
        contactId: input.contactId,
        name: input.name,
        status: "open",
        monetaryValue: input.monetaryValue,
      }),
    });
  } catch (err) {
    /* already had one: take the id HighLevel just handed us and move on */
    const existing = existingOpportunityId(err);
    if (existing) return existing;
    throw err;
  }
  const opp = (j.opportunity as Record<string, unknown>) ?? j;
  const id = (opp.id as string) ?? (j.id as string);
  if (!id) throw new Error(`HL createOpportunity: no id in ${JSON.stringify(j).slice(0, 200)}`);
  return id;
}

export async function createOpportunity(input: {
  contactId: string;
  name: string;
  monetaryValue: number;
}): Promise<string> {
  const pipelineId = process.env.HIGHLEVEL_PIPELINE_ID;
  const pipelineStageId = process.env.HIGHLEVEL_STAGE_ID;
  if (!pipelineId || !pipelineStageId) {
    throw new Error("Missing HIGHLEVEL_PIPELINE_ID / HIGHLEVEL_STAGE_ID");
  }
  return createOpportunityIn({ ...input, pipelineId, pipelineStageId });
}

/* Attach a note to a contact (used to carry a lead's free-text project brief). */
export async function addNote(contactId: string, body: string): Promise<void> {
  if (!body.trim()) return;
  await hlFetch(`/contacts/${contactId}/notes`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

/**
 * Full post-payment sync. Returns the HighLevel IDs on success. Throws on
 * any step failure; the webhook catches it, flags the order for retry, and
 * leaves the payment untouched.
 */
export async function syncOrderToHighLevel(input: {
  email: string;
  name?: string;
  phone?: string;
  company?: string;
  tags: string[];
  opportunityName: string;
  amountDollars: number;
}): Promise<{ contactId: string; opportunityId: string }> {
  const contactId = await upsertContact({
    email: input.email,
    name: input.name,
    phone: input.phone,
    company: input.company,
  });
  await addTags(contactId, input.tags);
  const opportunityId = await createOpportunity({
    contactId,
    name: input.opportunityName,
    monetaryValue: input.amountDollars,
  });
  return { contactId, opportunityId };
}

/*
 * Where a website lead's deal card goes. The env pair wins when set; else
 * the "GHL Video: Leads" pipeline the provisioning made in this
 * sub-account (hl_config); only with neither does the old hard-coded setter
 * pipeline stand in, loudly (audit, 15 September 2026: the hard-coded ids
 * belong to the sandbox era and silently missed the provisioned pipeline).
 */
async function leadTarget(): Promise<{ pipelineId: string; pipelineStageId: string }> {
  const envPipeline = process.env.HIGHLEVEL_LEAD_PIPELINE_ID;
  const envStage = process.env.HIGHLEVEL_LEAD_STAGE_ID;
  if (envPipeline && envStage) return { pipelineId: envPipeline, pipelineStageId: envStage };
  try {
    const { loadHlConfig } = await import("@/lib/highlevel/config");
    const { supabaseAdmin } = await import("@/lib/checkout/supabase-admin");
    const cfg = await loadHlConfig(supabaseAdmin(), locationId());
    if (cfg?.pipelines?.leads?.id && cfg.pipelines.leads.stages?.new) {
      return { pipelineId: cfg.pipelines.leads.id, pipelineStageId: cfg.pipelines.leads.stages.new };
    }
  } catch (e) {
    console.error("[highlevel] could not read the provisioned leads pipeline:", e instanceof Error ? e.message : e);
  }
  console.warn("[highlevel] no lead pipeline configured; using the legacy setter pipeline");
  return { pipelineId: "xPCPS2JiczcBOhQrZdXF", pipelineStageId: "88340841-cbe0-49fa-8e66-cb5a4a00880c" };
}

/**
 * Sync a pre-sale website lead (quote request) into HighLevel: upsert the
 * contact, tag it (tags fire the CRM's lead workflows), attach the project
 * brief as a note, and open an opportunity in the setter pipeline's New Lead
 * stage. Throws on any failure so the caller can tell the visitor to retry.
 */
export async function syncLeadToHighLevel(input: {
  email: string;
  name?: string;
  phone?: string;
  company?: string;
  tags: string[];
  note?: string;
  opportunityName: string;
}): Promise<{ contactId: string; opportunityId: string }> {
  const contactId = await upsertContact({
    email: input.email,
    name: input.name,
    phone: input.phone,
    company: input.company,
  });
  await addTags(contactId, input.tags);
  if (input.note) await addNote(contactId, input.note);
  const target = await leadTarget();
  const opportunityId = await createOpportunityIn({
    contactId,
    name: input.opportunityName,
    monetaryValue: 0,
    ...target,
  });
  return { contactId, opportunityId };
}
