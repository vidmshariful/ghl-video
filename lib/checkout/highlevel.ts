import "server-only";

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
const BASE = "https://services.leadconnectorhq.com";

function headers() {
  const token = process.env.HIGHLEVEL_API_TOKEN;
  if (!token) throw new Error("Missing HIGHLEVEL_API_TOKEN");
  return {
    Authorization: `Bearer ${token}`,
    Version: process.env.HIGHLEVEL_API_VERSION || "2021-07-28",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function locationId() {
  const id = process.env.HIGHLEVEL_LOCATION_ID;
  if (!id) throw new Error("Missing HIGHLEVEL_LOCATION_ID");
  return id;
}

function splitName(name?: string): { firstName?: string; lastName?: string } {
  if (!name) return {};
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

async function hlFetch(path: string, init: RequestInit) {
  // Hard timeout: a hung HighLevel call must fail fast and be caught, never
  // hang long enough for the serverless platform to kill the invocation
  // after the order was already marked paid.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  let r: Response;
  try {
    r = await fetch(`${BASE}${path}`, { ...init, headers: headers(), signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
  const text = await r.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body */
  }
  if (!r.ok) {
    throw new Error(`HL ${init.method} ${path} -> ${r.status}: ${text.slice(0, 300)}`);
  }
  return json as Record<string, unknown>;
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
  const j = await hlFetch("/opportunities/", {
    method: "POST",
    body: JSON.stringify({
      pipelineId,
      pipelineStageId,
      locationId: locationId(),
      contactId: input.contactId,
      name: input.name,
      status: "open",
      monetaryValue: input.monetaryValue,
    }),
  });
  const opp = (j.opportunity as Record<string, unknown>) ?? j;
  const id = (opp.id as string) ?? (j.id as string);
  if (!id) throw new Error(`HL createOpportunity: no id in ${JSON.stringify(j).slice(0, 200)}`);
  return id;
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
