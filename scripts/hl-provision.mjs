/*
 * Provision a HighLevel sub-account for the sync, idempotently.
 *
 *   npm run hl:provision                       the sub-account in .env.local (staging sandbox)
 *   GHLV_ENV=prod npm run hl:provision         the live sub-account, only when asked
 *
 * Makes what is missing and reuses what is there, matched by name or key:
 * the eight contact fields, the two pipelines with their stages, the two
 * custom objects with their fields, and the associations that tie a project
 * and a video to a contact. Every id is written to hl_config so the sync
 * never guesses one. A second run changes nothing and prints the same table.
 *
 * Two things the API will not do for a Private Integration token, printed
 * at the end for a person: allowing more than one open deal per contact,
 * and pointing a workflow's webhook at us.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envFile = process.env.GHLV_ENV === "prod" ? ".env.prod.local" : ".env.local";
const env = {};
for (const line of readFileSync(new URL(`../${envFile}`, import.meta.url), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}
const need = (k) => {
  if (!env[k]) {
    console.error(`Missing ${k} in ${envFile}.`);
    process.exit(1);
  }
  return env[k];
};
const TOKEN = need("HIGHLEVEL_API_TOKEN");
const LOC = need("HIGHLEVEL_LOCATION_ID");
const db = createClient(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const BASE = "https://services.leadconnectorhq.com";
async function hl(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Version: env.HIGHLEVEL_API_VERSION || "2021-07-28",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!r.ok) {
    const err = new Error(`${method} ${path} -> ${r.status}: ${text.slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }
  return json ?? {};
}

const made = [];
const kept = [];
const note = (list, what) => list.push(what);

/* ---- contact fields ------------------------------------------------ */
const CONTACT_FIELDS = [
  ["lines", "GHLV lines", "premade, custom, editing"],
  ["arrangement", "GHLV arrangement", "Retainer partner, Custom projects, Editing plan, Premade buyer, Lead"],
  ["retainerFee", "GHLV retainer fee", "$11,000 a month"],
  ["retainerVideos", "GHLV retainer videos", "8 to 12 videos a month"],
  ["source", "GHLV source", "checkout, admin, invoice, enquiry"],
  ["lastSeen", "GHLV last seen", "YYYY-MM-DD, their last portal visit"],
  ["adminUrl", "GHLV admin record", "the client's record on ghlvideo.com"],
  ["customerId", "GHLV customer id", "our id for them"],
  ["editingPlan", "GHLV editing plan", "Growth, active, renews 2026-10-02"],
  ["waitingOn", "GHLV waiting on", "brief, review, approval, or empty: what the client owes us right now"],
  ["checkIn", "GHLV check-in", "YYYY-MM-DD, the retainer's next check-in"],
];

async function contactFields() {
  const have = (await hl("GET", `/locations/${LOC}/customFields?model=contact`)).customFields ?? [];
  const out = {};
  for (const [key, name, placeholder] of CONTACT_FIELDS) {
    const found = have.find((f) => f.name === name);
    if (found) {
      out[key] = found.id;
      note(kept, `contact field "${name}"`);
      continue;
    }
    const j = await hl("POST", `/locations/${LOC}/customFields`, {
      name,
      dataType: "TEXT",
      model: "contact",
      placeholder,
    });
    out[key] = j.customField?.id ?? j.id;
    note(made, `contact field "${name}"`);
  }
  return out;
}

/* ---- pipelines ----------------------------------------------------- */
const PIPELINES = {
  projects: {
    name: "GHL Video: Custom projects",
    stages: [
      ["backlog", "Backlog"],
      ["planning", "Planning"],
      ["in_progress", "In progress"],
      ["review", "Review"],
      ["revision", "Revision"],
      ["approved", "Approved"],
      ["cutdowns", "Cutdowns"],
      ["closed", "Closed"],
    ],
  },
  leads: {
    name: "GHL Video: Leads",
    stages: [
      ["new", "New"],
      ["contacted", "Contacted"],
      ["quoted", "Quoted"],
      ["won", "Won"],
      ["lost", "Lost"],
    ],
  },
};

async function pipelines() {
  const have = (await hl("GET", `/opportunities/pipelines?locationId=${LOC}`)).pipelines ?? [];
  const out = {};
  for (const [key, def] of Object.entries(PIPELINES)) {
    let p = have.find((x) => x.name === def.name);
    if (!p) {
      p = (
        await hl("POST", "/opportunities/pipelines", {
          locationId: LOC,
          name: def.name,
          stages: def.stages.map(([, name], position) => ({ name, position })),
        })
      ).pipeline;
      note(made, `pipeline "${def.name}" with ${def.stages.length} stages`);
    } else {
      note(kept, `pipeline "${def.name}"`);
    }
    const stages = {};
    const missing = [];
    for (const [stageKey, name] of def.stages) {
      const s = (p.stages ?? []).find((x) => x.name === name);
      if (s) stages[stageKey] = s.id;
      else missing.push(name);
    }
    if (missing.length) {
      /* add the missing stages after the ones already there */
      const all = [
        ...(p.stages ?? []).map((s, i) => ({ id: s.id, name: s.name, position: i })),
        ...missing.map((name, i) => ({ name, position: (p.stages ?? []).length + i })),
      ];
      const updated = (await hl("PUT", `/opportunities/pipelines/${p.id}`, { name: def.name, stages: all })).pipeline;
      for (const [stageKey, name] of def.stages) {
        const s = (updated?.stages ?? []).find((x) => x.name === name);
        if (s) stages[stageKey] = s.id;
      }
      note(made, `stages ${missing.join(", ")} on "${def.name}"`);
    }
    out[key] = { id: p.id, stages };
  }
  return out;
}

/* ---- custom objects ------------------------------------------------ */
const OBJECTS = {
  project: {
    key: "custom_objects.ghlv_project",
    labels: { singular: "GHLV Project", plural: "GHLV Projects" },
    description: "A custom video project mirrored from the GHL Video platform. Read-only here.",
    fields: [
      ["status", "Status", "TEXT"],
      ["category", "Category", "TEXT"],
      ["agreed", "Agreed price", "TEXT"],
      ["due", "Due", "TEXT"],
      ["brief", "Brief", "LARGE_TEXT"],
      ["admin_url", "Admin record", "TEXT"],
      ["project_id", "Project id", "TEXT"],
      ["retainer_month", "Retainer month", "TEXT"],
      ["retainer_kind", "Retainer kind", "TEXT"],
      ["client_email", "Client email", "TEXT"],
    ],
    association: { key: "ghlv_project_contact", label: "Project" },
  },
  video: {
    key: "custom_objects.ghlv_video",
    labels: { singular: "GHLV Video", plural: "GHLV Videos" },
    description: "A video owed to a client, mirrored from the GHL Video platform. Read-only here.",
    fields: [
      ["status", "Status", "TEXT"],
      ["kind", "Kind", "TEXT"],
      ["category", "Category", "TEXT"],
      ["position", "Position", "TEXT"],
      ["video_url", "Video link", "TEXT"],
      ["due", "Due", "TEXT"],
      ["ready", "Ready", "TEXT"],
      ["approved", "Approved", "TEXT"],
      ["admin_url", "Admin record", "TEXT"],
      ["video_id", "Video id", "TEXT"],
      ["client_email", "Client email", "TEXT"],
    ],
    association: { key: "ghlv_video_contact", label: "Video" },
  },
};

async function objectExists(key) {
  try {
    const j = await hl("GET", `/objects/${key}?locationId=${LOC}`);
    return j.object ?? j;
  } catch (e) {
    if (e.status === 404 || e.status === 400 || e.status === 422) return null;
    throw e;
  }
}

async function customObject(def) {
  let obj = await objectExists(def.key);
  if (obj) note(kept, `object ${def.labels.plural}`);
  else {
    obj = (
      await hl("POST", "/objects/", {
        labels: def.labels,
        key: def.key,
        description: def.description,
        primaryDisplayPropertyDetails: { key: `${def.key}.title`, name: "Title", dataType: "TEXT" },
        locationId: LOC,
      })
    ).object;
    note(made, `object ${def.labels.plural}`);
  }

  const listing = await hl("GET", `/custom-fields/object-key/${def.key}?locationId=${LOC}`);
  const have = listing.fields ?? [];
  const folders = listing.folders ?? [];
  const fields = {};
  const title = have.find((f) => f.fieldKey === `${def.key}.title`);
  if (title) fields.title = title.id;

  /* the Details folder the fields sit in: by name, else the one an existing field is in, else new */
  let folderId =
    folders.find((f) => f.name === "Details")?.id ??
    have.find((f) => f.fieldKey !== `${def.key}.title`)?.parentId ??
    null;
  if (!folderId) {
    folderId = (await hl("POST", "/custom-fields/folder", { locationId: LOC, objectKey: def.key, name: "Details" }))
      .folder?.id;
    note(made, `folder Details on ${def.labels.plural}`);
  }

  for (const [prop, name, dataType] of def.fields) {
    const fieldKey = `${def.key}.${prop}`;
    const found = have.find((f) => f.fieldKey === fieldKey);
    if (found) {
      fields[prop] = found.id;
      continue;
    }
    let j;
    try {
      j = await hl("POST", "/custom-fields/", {
        locationId: LOC,
        objectKey: def.key,
        parentId: folderId,
        name,
        dataType,
        fieldKey,
        showInForms: false,
      });
    } catch (e) {
      if (dataType === "TEXT") throw e;
      /* a type this account does not offer: plain text still holds it */
      j = await hl("POST", "/custom-fields/", {
        locationId: LOC,
        objectKey: def.key,
        parentId: folderId,
        name,
        dataType: "TEXT",
        fieldKey,
        showInForms: false,
      });
    }
    fields[prop] = j.field?.id ?? j.id;
    note(made, `field ${name} on ${def.labels.plural}`);
  }
  if (have.length && Object.keys(fields).length === have.length) note(kept, `${have.length} fields on ${def.labels.plural}`);
  return { id: obj.id, key: def.key, fields };
}

async function association(def) {
  const have = (await hl("GET", `/associations/?locationId=${LOC}&skip=0&limit=100`)).associations ?? [];
  const found = have.find((a) => a.key === def.association.key);
  if (found) {
    note(kept, `association ${def.association.key}`);
    return found.id;
  }
  const j = await hl("POST", "/associations/", {
    locationId: LOC,
    key: def.association.key,
    firstObjectLabel: "Client",
    firstObjectKey: "contact",
    secondObjectLabel: def.association.label,
    secondObjectKey: def.key,
  });
  note(made, `association ${def.association.key}`);
  return j.id ?? j.association?.id;
}

/* ---- run ----------------------------------------------------------- */
(async () => {
  const loc = await hl("GET", `/locations/${LOC}`);
  const name = loc.location?.name ?? LOC;
  console.log(`\nProvisioning "${name}" (${LOC}) for the sync\n`);

  const config = {
    contactFields: await contactFields(),
    pipelines: await pipelines(),
    objects: {
      project: await customObject(OBJECTS.project),
      video: await customObject(OBJECTS.video),
    },
    associations: {
      projectContact: await association(OBJECTS.project),
      videoContact: await association(OBJECTS.video),
    },
  };

  const { error } = await db
    .from("hl_config")
    .upsert({ location_id: LOC, config, updated_at: new Date().toISOString() }, { onConflict: "location_id" });
  if (error) {
    console.error(`Could not save hl_config: ${error.message}. Has migration 0095 been applied?`);
    process.exit(1);
  }

  if (made.length) {
    console.log("Made:");
    for (const m of made) console.log(`  + ${m}`);
  }
  console.log(`Kept: ${kept.length} things already there.`);
  console.log(`\nSaved to hl_config for ${LOC}:`);
  console.log(`  contact fields   ${Object.keys(config.contactFields).length}`);
  console.log(`  pipelines        projects ${config.pipelines.projects.id}, leads ${config.pipelines.leads.id}`);
  console.log(`  objects          ${config.objects.project.key}, ${config.objects.video.key}`);
  console.log(`  associations     ${config.associations.projectContact}, ${config.associations.videoContact}`);

  const dup = loc.location?.settings?.allowDuplicateOpportunity;
  console.log("\nBy hand, in the sub-account:");
  if (dup !== true)
    console.log(
      "  1. Settings > Business Profile > turn on \"Allow duplicate opportunity\", so each project gets its own deal card (until then a client's open card carries their latest project).",
    );
  console.log(
    "  2. Automation > a workflow on \"Contact Changed\" with a Webhook action to POST https://<site>/api/webhooks/highlevel?key=<HIGHLEVEL_WEBHOOK_SECRET>, so edits made in HighLevel come back.",
  );
  console.log("\nQuote leads pipeline ids, if the website should file leads here:");
  console.log(`  HIGHLEVEL_LEAD_PIPELINE_ID=${config.pipelines.leads.id}`);
  console.log(`  HIGHLEVEL_LEAD_STAGE_ID=${config.pipelines.leads.stages.new}\n`);
})().catch((e) => {
  console.error(`\nProvisioning stopped: ${e.message}`);
  process.exit(1);
});
