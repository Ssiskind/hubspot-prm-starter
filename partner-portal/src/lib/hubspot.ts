/**
 * HubSpot API client and CRM operations for the partner portal.
 *
 * This module wraps the @hubspot/api-client for common partner-portal queries:
 * auth (email → partner data lookup), deal registrations, MDF requests, price books.
 * It's analogous to Salesforce Apex callouts or external service definitions.
 *
 * Note: HubSpot CRM API is record-centric (no joins) — we batch-read associated IDs
 * in a separate call to simulate SQL joins.
 */

import { Client } from "@hubspot/api-client";
import { unstable_cache } from "next/cache";

const hubspot = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

export default hubspot;

export const OBJECT_TYPES = {
  dealRegistration: process.env.HUBSPOT_DEAL_REG_OBJECT_TYPE_ID!,
  partnerProgramEnrollment: "partner_program_enrollment",
  mdfRequest: process.env.HUBSPOT_MDF_REQUEST_OBJECT_TYPE_ID!,
} as const;

const DEAL_REG_PROPERTIES = [
  "registration_name",
  "hs_pipeline_stage",
  "end_customer_name",
  "end_customer_domain",
  "estimated_arr",
  "product_sku",
  "submission_date",
  "expiry_date",
  "approved_discount_pct",
  "deal_channel_type",
  "co_sell_eligible",
  "partner_notes",
  "channel_manager_notes",
  "rejection_reason",
  "microsoft_co_sell_id",
  "requested_discount_pct",
];

const MDF_PROPERTIES = [
  "request_name",
  "campaign_type",
  "hs_pipeline_stage",
  "program_source",
  "amount_requested",
  "amount_approved",
  "amount_claimed",
  "amount_reimbursed",
  "quarter",
  "fiscal_year",
  "activity_start_date",
  "campaign_description",
];

// ─── Associations helper ───────────────────────────────────────────────────

/**
 * Fetch IDs of records associated to a company (equivalent to a Salesforce lookup relationship).
 * Associations in HubSpot are bidirectional but fetched in a separate API call.
 * @param companyId - The HubSpot company record ID
 * @param toObjectType - The target object type (e.g., "2-XXXXXXXX" for custom objects)
 * @returns Array of associated record IDs, or empty array if none found/error
 */
export async function getAssociatedIds(
  companyId: string,
  toObjectType: string,
  userDefinedOnly = true
): Promise<string[]> {
  try {
    const res = await hubspot.apiRequest({
      method: "GET",
      path: `/crm/v4/objects/0-2/${companyId}/associations/${toObjectType}`,
    });
    const data = (await res.json()) as {
      results?: {
        toObjectId: number;
        associationTypes?: { category: string; typeId: number }[];
      }[];
    };
    const results = data.results ?? [];
    const filtered = userDefinedOnly
      ? results.filter((r) =>
          r.associationTypes?.some((t) => t.category === "USER_DEFINED")
        )
      : results;
    return filtered.map((r) => String(r.toObjectId));
  } catch {
    return [];
  }
}

// ─── Batch read helper ─────────────────────────────────────────────────────

interface CrmRecord {
  id: string;
  properties: Record<string, string>;
}

async function batchRead(
  objectType: string,
  ids: string[],
  properties: string[]
): Promise<CrmRecord[]> {
  if (ids.length === 0) return [];

  // Chunk IDs into slices of 100 max per API call (HubSpot limit)
  const CHUNK_SIZE = 100;
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const res = await hubspot.apiRequest({
        method: "POST",
        path: `/crm/v3/objects/${objectType}/batch/read`,
        body: {
          inputs: chunk.map((id) => ({ id })),
          properties,
        },
      });
      const data = (await res.json()) as { results?: CrmRecord[] };
      return data.results ?? [];
    })
  );

  return results.flat();
}

// ─── Partner companies ─────────────────────────────────────────────────────

export async function getPartnerCompanies() {
  const results = await hubspot.crm.companies.searchApi.doSearch({
    filterGroups: [
      {
        filters: [
          {
            propertyName: "partner_tier",
            operator: "HAS_PROPERTY" as never,
          },
        ],
      },
    ],
    properties: [
      "name",
      "domain",
      "partner_tier",
      "partner_status",
      "partner_type",
      "partner_territory",
      "partner_mrr_managed",
      "mdf_balance_available",
      "partner_discount_floor_pct",
      "partner_discount_ceiling_pct",
      "partner_payout_rate_pct",
    ],
    limit: 100,
    after: "0",
    sorts: [],
  });
  return results.results;
}

export async function getPartnerCompanyById(companyId: string) {
  return hubspot.crm.companies.basicApi.getById(companyId, [
    "name",
    "domain",
    "partner_tier",
    "partner_status",
    "partner_territory",
    "mdf_balance_available",
    "microsoft_partner_id",
    "partner_type",
    "partner_mrr_managed",
    "partner_discount_floor_pct",
    "partner_discount_ceiling_pct",
    "partner_payout_rate_pct",
  ]);
}

// ─── Auth helper ───────────────────────────────────────────────────────────

export async function getPartnerCompanyByEmail(email: string) {
  const contacts = await hubspot.crm.contacts.searchApi.doSearch({
    filterGroups: [
      {
        filters: [
          {
            propertyName: "email",
            operator: "EQ" as never,
            value: email,
          },
        ],
      },
    ],
    properties: [
      "email",
      "firstname",
      "lastname",
      "partner_user_role",
      "is_partner_portal_user",
    ],
    limit: 1,
    after: "0",
    sorts: [],
  });

  const contact = contacts.results[0];
  if (!contact) return null;

  const assocRes = await hubspot.apiRequest({
    method: "GET",
    path: `/crm/v3/objects/contacts/${contact.id}/associations/companies`,
  });
  const assocData = (await assocRes.json()) as {
    results: { id: string }[];
  };

  if (!assocData.results.length) return null;

  const companyId = assocData.results[0].id;
  const company = await hubspot.crm.companies.basicApi.getById(companyId, [
    "name",
    "domain",
    "partner_tier",
    "partner_status",
    "partner_territory",
    "mdf_balance_available",
    "microsoft_partner_id",
    "partner_discount_floor_pct",
    "partner_discount_ceiling_pct",
    "partner_payout_rate_pct",
  ]);

  return { contact, company };
}

// ─── Deal Registrations (scoped to partner) ────────────────────────────────

function withDealRegStatus(
  records: CrmRecord[],
  stageIdToStatus: Record<string, string>
): CrmRecord[] {
  return records.map((r) => ({
    ...r,
    properties: {
      ...r.properties,
      status: stageIdToStatus[r.properties.hs_pipeline_stage ?? ""] ?? "",
    },
  }));
}

function withMdfStatus(
  records: CrmRecord[],
  stageIdToStatus: Record<string, string>
): CrmRecord[] {
  return records.map((r) => ({
    ...r,
    properties: {
      ...r.properties,
      status: stageIdToStatus[r.properties.hs_pipeline_stage ?? ""] ?? "",
    },
  }));
}

export async function getDealRegistrations(partnerCompanyId: string) {
  return unstable_cache(
    async () => {
      const [ids, pipeline] = await Promise.all([
        getAssociatedIds(partnerCompanyId, OBJECT_TYPES.dealRegistration),
        getDealRegPipeline(),
      ]);
      const records = await batchRead(
        OBJECT_TYPES.dealRegistration,
        ids,
        DEAL_REG_PROPERTIES
      );
      return withDealRegStatus(records, pipeline?.stageIdToStatus ?? {});
    },
    [`deal-registrations-${partnerCompanyId}`],
    {
      tags: [`deal-registrations-${partnerCompanyId}`, `deal-registrations`],
      revalidate: 60,
    }
  )();
}

export async function getDealRegistrationForPartner(
  partnerCompanyId: string,
  dealId: string
): Promise<CrmRecord | null> {
  const ids = await getAssociatedIds(
    partnerCompanyId,
    OBJECT_TYPES.dealRegistration
  );
  if (!ids.includes(dealId)) return null;

  const [[record], pipeline] = await Promise.all([
    batchRead(OBJECT_TYPES.dealRegistration, [dealId], DEAL_REG_PROPERTIES),
    getDealRegPipeline(),
  ]);
  if (!record) return null;
  return withDealRegStatus([record], pipeline?.stageIdToStatus ?? {})[0] ?? null;
}

export async function appendDealPartnerNote(
  dealId: string,
  existingNotes: string,
  note: string
) {
  const timestamp = new Date().toISOString().split("T")[0];
  const combined = existingNotes
    ? `${existingNotes}\n\n[${timestamp}] ${note}`
    : `[${timestamp}] ${note}`;

  return hubspot.crm.objects.basicApi.update(OBJECT_TYPES.dealRegistration, dealId, {
    properties: { partner_notes: combined },
  });
}

// Cache the deal registration pipeline with a full status→stageId map.
// Stage labels are expected to match status values (submitted, under_review, approved, etc.).
type DealRegPipelineCache = {
  pipelineId: string;
  stageByStatus: Record<string, string>; // normalized status → stage ID
  stageIdToStatus: Record<string, string>; // stage ID → normalized status
  firstStageId: string;
};
let _dealRegPipeline: DealRegPipelineCache | null | undefined = undefined;

export async function getDealRegPipeline(): Promise<DealRegPipelineCache | null> {
  if (_dealRegPipeline !== undefined) return _dealRegPipeline;

  try {
    const res = await hubspot.apiRequest({
      method: "GET",
      path: `/crm/v3/pipelines/${OBJECT_TYPES.dealRegistration}`,
    });
    const data = (await res.json()) as {
      results?: { id: string; stages: { id: string; label: string; displayOrder: number }[] }[];
    };
    const pipeline = data.results?.[0];
    if (!pipeline) { _dealRegPipeline = null; return null; }

    const stages = [...pipeline.stages].sort((a, b) => a.displayOrder - b.displayOrder);
    const stageByStatus: Record<string, string> = {};
    const stageIdToStatus: Record<string, string> = {};
    for (const s of stages) {
      const key = s.label.toLowerCase().replace(/\s+/g, "_");
      stageByStatus[key] = s.id;
      stageIdToStatus[s.id] = key;
    }

    _dealRegPipeline = {
      pipelineId: pipeline.id,
      stageByStatus,
      stageIdToStatus,
      firstStageId: stages[0]?.id ?? "",
    };
  } catch {
    _dealRegPipeline = null;
  }
  return _dealRegPipeline;
}

// Returns the hs_pipeline + hs_pipeline_stage properties for a given status value,
// or an empty object if no pipeline is configured.
export async function dealRegPipelineProps(
  status: string
): Promise<Record<string, string>> {
  const pipeline = await getDealRegPipeline();
  if (!pipeline) return {};
  const stageId =
    pipeline.stageByStatus[status] ??
    pipeline.stageByStatus[status.toLowerCase().replace(/\s+/g, "_")] ??
    pipeline.firstStageId;
  return {
    hs_pipeline: pipeline.pipelineId,
    hs_pipeline_stage: stageId,
  };
}

// ─── MDF Request pipeline cache (mirrors deal reg pipeline pattern) ───────────

type MdfPipelineCache = {
  pipelineId: string;
  stageByStatus: Record<string, string>;
  stageIdToStatus: Record<string, string>;
  firstStageId: string;
};
let _mdfPipeline: MdfPipelineCache | null | undefined = undefined;

export async function getMdfPipeline(): Promise<MdfPipelineCache | null> {
  if (_mdfPipeline !== undefined) return _mdfPipeline;
  try {
    const res = await hubspot.apiRequest({
      method: "GET",
      path: `/crm/v3/pipelines/${OBJECT_TYPES.mdfRequest}`,
    });
    const data = (await res.json()) as {
      results?: { id: string; stages: { id: string; label: string; displayOrder: number }[] }[];
    };
    const pipeline = data.results?.[0];
    if (!pipeline) { _mdfPipeline = null; return null; }

    const stages = [...pipeline.stages].sort((a, b) => a.displayOrder - b.displayOrder);
    const stageByStatus: Record<string, string> = {};
    const stageIdToStatus: Record<string, string> = {};
    for (const s of stages) {
      const key = s.label.toLowerCase().replace(/\s+/g, "_");
      stageByStatus[key] = s.id;
      stageIdToStatus[s.id] = key;
    }
    _mdfPipeline = {
      pipelineId: pipeline.id,
      stageByStatus,
      stageIdToStatus,
      firstStageId: stages[0]?.id ?? "",
    };
  } catch {
    _mdfPipeline = null;
  }
  return _mdfPipeline;
}

export async function mdfPipelineProps(status: string): Promise<Record<string, string>> {
  const pipeline = await getMdfPipeline();
  if (!pipeline) return {};
  const stageId =
    pipeline.stageByStatus[status] ??
    pipeline.stageByStatus[status.toLowerCase().replace(/\s+/g, "_")] ??
    pipeline.firstStageId;
  return { hs_pipeline: pipeline.pipelineId, hs_pipeline_stage: stageId };
}

// Cache the USER_DEFINED association type ID between deal registrations and companies.
// This is portal-specific and cannot be hardcoded — look it up once and reuse.
let _dealRegToCompanyAssocTypeId: number | null | undefined = undefined;

async function getDealRegToCompanyAssocTypeId(): Promise<number> {
  if (_dealRegToCompanyAssocTypeId !== undefined) {
    if (_dealRegToCompanyAssocTypeId === null) {
      throw new Error("No USER_DEFINED association type found between deal registrations and companies.");
    }
    return _dealRegToCompanyAssocTypeId;
  }
  const res = await hubspot.apiRequest({
    method: "GET",
    path: `/crm/v4/associations/${OBJECT_TYPES.dealRegistration}/0-2/labels`,
  });
  const data = (await res.json()) as {
    results?: { category: string; typeId: number; label: string | null }[];
  };
  const match = data.results?.find((r) => r.category === "USER_DEFINED");
  _dealRegToCompanyAssocTypeId = match?.typeId ?? null;
  if (!_dealRegToCompanyAssocTypeId) {
    throw new Error(
      `No USER_DEFINED association type found between ${OBJECT_TYPES.dealRegistration} and companies. Results: ${JSON.stringify(data.results)}`
    );
  }
  return _dealRegToCompanyAssocTypeId;
}

export class DiscountOutOfBandError extends Error {
  constructor(
    public readonly floor: number,
    public readonly ceiling: number
  ) {
    super(
      `Requested discount is outside your pre-approved band (${floor}%–${ceiling}%).`
    );
  }
}

export async function createDealRegistration(
  partnerCompanyId: string,
  data: {
    registrationName: string;
    endCustomerName: string;
    endCustomerDomain: string;
    estimatedArr: number;
    productSku: string;
    dealChannelType: string;
    partnerNotes: string;
    coSellEligible: boolean;
    requestedDiscountPct?: number;
  }
) {
  // HubSpot is the library of what's allowed — a partner's discount band
  // lives on their Company record. Never write a request outside that band.
  if (data.requestedDiscountPct !== undefined) {
    const company = await getPartnerCompanyById(partnerCompanyId);
    const floor = Number(company.properties.partner_discount_floor_pct ?? 0);
    const ceiling = Number(
      company.properties.partner_discount_ceiling_pct ?? 0
    );
    if (
      data.requestedDiscountPct < floor ||
      data.requestedDiscountPct > ceiling
    ) {
      throw new DiscountOutOfBandError(floor, ceiling);
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const expiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [assocTypeId, pipelineProps] = await Promise.all([
    getDealRegToCompanyAssocTypeId(),
    dealRegPipelineProps("submitted"),
  ]);

  return hubspot.crm.objects.basicApi.create(OBJECT_TYPES.dealRegistration, {
    properties: {
      registration_name: data.registrationName,
      ...pipelineProps,
      end_customer_name: data.endCustomerName,
      end_customer_domain: data.endCustomerDomain,
      estimated_arr: String(data.estimatedArr),
      product_sku: data.productSku,
      deal_channel_type: data.dealChannelType,
      partner_notes: data.partnerNotes,
      co_sell_eligible: String(data.coSellEligible),
      submission_date: today,
      expiry_date: expiry,
      ...(data.requestedDiscountPct !== undefined && {
        requested_discount_pct: String(data.requestedDiscountPct),
      }),
    },
    associations: [
      {
        to: { id: partnerCompanyId },
        types: [
          {
            associationCategory: "USER_DEFINED" as never,
            associationTypeId: assocTypeId,
          },
        ],
      },
    ],
  });
}

// ─── Deal conflict check (across ALL partners) ────────────────────────────

export async function checkDealConflict(
  endCustomerDomain: string,
  endCustomerName?: string
): Promise<CrmRecord[]> {
  // Domain is the reliable unique key (company names aren't unique) — legacy/
  // demo records may predate requiring a domain, so fall back to a name match
  // for those.
  const pipeline = await getDealRegPipeline();
  const rejectedStageId = pipeline?.stageByStatus["rejected"];

  const stageFilter = rejectedStageId
    ? [{ propertyName: "hs_pipeline_stage", operator: "NEQ" as never, value: rejectedStageId }]
    : [];

  const filterGroups = [
    {
      filters: [
        {
          propertyName: "end_customer_domain",
          operator: "EQ" as never,
          value: endCustomerDomain,
        },
        ...stageFilter,
      ],
    },
    ...(endCustomerName
      ? [
          {
            filters: [
              {
                propertyName: "end_customer_name",
                operator: "EQ" as never,
                value: endCustomerName,
              },
              ...stageFilter,
            ],
          },
        ]
      : []),
  ];

  const results = await hubspot.crm.objects.searchApi.doSearch(
    OBJECT_TYPES.dealRegistration,
    {
      filterGroups,
      properties: [
        "registration_name",
        "hs_pipeline_stage",
        "end_customer_name",
        "product_sku",
        "deal_channel_type",
      ],
      limit: 10,
      after: "0",
      sorts: [],
    }
  );

  const seen = new Set<string>();
  const deduped: CrmRecord[] = [];
  for (const r of results.results as unknown as CrmRecord[]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    deduped.push(r);
  }
  return withDealRegStatus(deduped, pipeline?.stageIdToStatus ?? {});
}

// ─── Deal conflict tickets — one per competing pair of registrations ──────

const CONFLICT_TICKET_PIPELINE_ID = process.env.HUBSPOT_CONFLICT_TICKET_PIPELINE_ID!;
const CONFLICT_TICKET_STAGE_NEW = process.env.HUBSPOT_CONFLICT_TICKET_STAGE_NEW!;
const TICKETS_OBJECT_TYPE = "tickets";

let _ticketToDealRegAssocTypeId: number | null | undefined = undefined;

async function getTicketToDealRegAssocTypeId(): Promise<number> {
  if (_ticketToDealRegAssocTypeId !== undefined) {
    if (_ticketToDealRegAssocTypeId === null) {
      throw new Error("Could not obtain a ticket↔deal-registration association type.");
    }
    return _ticketToDealRegAssocTypeId;
  }

  const listPath = `/crm/v4/associations/${TICKETS_OBJECT_TYPE}/${OBJECT_TYPES.dealRegistration}/labels`;

  const listRes = await hubspot.apiRequest({ method: "GET", path: listPath });
  const listData = (await listRes.json()) as {
    results?: { category: string; typeId: number; label: string | null }[];
  };
  const existing = listData.results?.find((r) => r.category === "USER_DEFINED");

  if (existing?.typeId) {
    _ticketToDealRegAssocTypeId = existing.typeId;
    return existing.typeId;
  }

  // Create the label on first use so no manual HubSpot setup is required.
  await hubspot.apiRequest({
    method: "POST",
    path: listPath,
    body: { label: "Conflict ticket", name: "conflict_ticket" },
  });

  // Re-fetch to get the authoritative typeId for the ticket→deal-reg direction.
  const refetchRes = await hubspot.apiRequest({ method: "GET", path: listPath });
  const refetchData = (await refetchRes.json()) as {
    results?: { category: string; typeId: number; label: string | null }[];
  };
  const created = refetchData.results?.find((r) => r.category === "USER_DEFINED");
  _ticketToDealRegAssocTypeId = created?.typeId ?? null;

  if (!_ticketToDealRegAssocTypeId) {
    throw new Error("Failed to create ticket↔deal-registration association type.");
  }
  return _ticketToDealRegAssocTypeId;
}

export async function getCompanyForDealRegistration(
  dealId: string
): Promise<string | null> {
  try {
    const res = await hubspot.apiRequest({
      method: "GET",
      path: `/crm/v4/objects/${OBJECT_TYPES.dealRegistration}/${dealId}/associations/companies`,
    });
    const data = (await res.json()) as { results?: { toObjectId: number }[] };
    const id = data.results?.[0]?.toObjectId;
    return id ? String(id) : null;
  } catch {
    return null;
  }
}

async function associateTicket(
  ticketId: string,
  toObjectType: string,
  toObjectId: string,
  associationTypeId: number,
  associationCategory: "USER_DEFINED" | "HUBSPOT_DEFINED"
) {
  const res = await hubspot.apiRequest({
    method: "PUT",
    path: `/crm/v4/objects/${TICKETS_OBJECT_TYPE}/${ticketId}/associations/${toObjectType}/${toObjectId}`,
    body: [{ associationCategory, associationTypeId }],
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `associateTicket ${toObjectType}/${toObjectId} failed (${res.status}): ${JSON.stringify(body)}`
    );
  }
}

export async function createDealConflictTicket(params: {
  endCustomerName: string;
  newDealId: string;
  newDealCompanyId: string;
  existingDealId: string;
}) {
  if (!CONFLICT_TICKET_PIPELINE_ID || !CONFLICT_TICKET_STAGE_NEW) {
    throw new Error(
      "HUBSPOT_CONFLICT_TICKET_PIPELINE_ID and HUBSPOT_CONFLICT_TICKET_STAGE_NEW must be set to create conflict tickets."
    );
  }

  const [existingDealCompanyId, ticketToDealRegAssocTypeId] = await Promise.all([
    getCompanyForDealRegistration(params.existingDealId),
    getTicketToDealRegAssocTypeId(),
  ]);

  const ticketRes = await hubspot.apiRequest({
    method: "POST",
    path: `/crm/v3/objects/${TICKETS_OBJECT_TYPE}`,
    body: {
      properties: {
        subject: `Deal Conflict — ${params.endCustomerName}`,
        content: `Two partners have submitted deal registrations for "${params.endCustomerName}". Review both registrations (linked below) and resolve which one should be upheld.`,
        hs_pipeline: CONFLICT_TICKET_PIPELINE_ID,
        hs_pipeline_stage: CONFLICT_TICKET_STAGE_NEW,
      },
    },
  });
  const ticketBody = (await ticketRes.json()) as { id?: string; message?: string; status?: string };
  if (!ticketBody.id) {
    throw new Error(
      `Ticket creation failed (${ticketRes.status}): ${ticketBody.message ?? JSON.stringify(ticketBody)}`
    );
  }
  const ticket = ticketBody as { id: string };

  await Promise.all([
    associateTicket(
      ticket.id,
      OBJECT_TYPES.dealRegistration,
      params.newDealId,
      ticketToDealRegAssocTypeId,
      "USER_DEFINED"
    ),
    associateTicket(
      ticket.id,
      OBJECT_TYPES.dealRegistration,
      params.existingDealId,
      ticketToDealRegAssocTypeId,
      "USER_DEFINED"
    ),
    associateTicket(
      ticket.id,
      "companies",
      params.newDealCompanyId,
      339,
      "HUBSPOT_DEFINED"
    ),
    ...(existingDealCompanyId
      ? [
          associateTicket(
            ticket.id,
            "companies",
            existingDealCompanyId,
            339,
            "HUBSPOT_DEFINED"
          ),
        ]
      : []),
  ]);

  return ticket;
}

// ─── MDF Requests (scoped to partner) ──────────────────────────────────────

let _mdfToCompanyAssocTypeId: number | null | undefined = undefined;

async function getMdfToCompanyAssocTypeId(): Promise<number> {
  if (_mdfToCompanyAssocTypeId !== undefined) {
    if (_mdfToCompanyAssocTypeId === null) {
      throw new Error("No USER_DEFINED association type found between MDF requests and companies.");
    }
    return _mdfToCompanyAssocTypeId;
  }
  const res = await hubspot.apiRequest({
    method: "GET",
    path: `/crm/v4/associations/${OBJECT_TYPES.mdfRequest}/0-2/labels`,
  });
  const data = (await res.json()) as {
    results?: { category: string; typeId: number; label: string | null }[];
  };
  const match = data.results?.find((r) => r.category === "USER_DEFINED");
  _mdfToCompanyAssocTypeId = match?.typeId ?? null;
  if (!_mdfToCompanyAssocTypeId) {
    throw new Error(
      `No USER_DEFINED association type found between ${OBJECT_TYPES.mdfRequest} and companies. Results: ${JSON.stringify(data.results)}`
    );
  }
  return _mdfToCompanyAssocTypeId;
}

export async function getMdfRequests(partnerCompanyId: string) {
  return unstable_cache(
    async () => {
      const [ids, pipeline] = await Promise.all([
        getAssociatedIds(partnerCompanyId, OBJECT_TYPES.mdfRequest),
        getMdfPipeline(),
      ]);
      const records = await batchRead(OBJECT_TYPES.mdfRequest, ids, MDF_PROPERTIES);
      return withMdfStatus(records, pipeline?.stageIdToStatus ?? {});
    },
    [`mdf-requests-${partnerCompanyId}`],
    {
      tags: [`mdf-requests-${partnerCompanyId}`, `mdf-requests`],
      revalidate: 60,
    }
  )();
}

export async function getMdfRequestForPartner(
  partnerCompanyId: string,
  mdfId: string
) {
  const ids = await getAssociatedIds(
    partnerCompanyId,
    OBJECT_TYPES.mdfRequest
  );
  if (!ids.includes(mdfId)) return null;

  const [[record], pipeline] = await Promise.all([
    batchRead(OBJECT_TYPES.mdfRequest, [mdfId], MDF_PROPERTIES),
    getMdfPipeline(),
  ]);
  if (!record) return null;
  return withMdfStatus([record], pipeline?.stageIdToStatus ?? {})[0] ?? null;
}

export async function createMdfRequest(
  partnerCompanyId: string,
  data: {
    requestName: string;
    campaignType: string;
    programSource: string;
    amountRequested: number;
    quarter: string;
    fiscalYear: number;
    activityStartDate?: string;
    campaignDescription?: string;
  }
) {
  const [pipelineProps, assocTypeId] = await Promise.all([
    mdfPipelineProps("submitted"),
    getMdfToCompanyAssocTypeId(),
  ]);

  const properties = {
    request_name: data.requestName,
    ...pipelineProps,
    campaign_type: data.campaignType,
    program_source: data.programSource,
    amount_requested: String(data.amountRequested),
    quarter: data.quarter,
    fiscal_year: String(data.fiscalYear),
    ...(data.activityStartDate && {
      activity_start_date: data.activityStartDate,
    }),
    ...(data.campaignDescription && {
      campaign_description: data.campaignDescription,
    }),
  };

  try {
    return await hubspot.crm.objects.basicApi.create(OBJECT_TYPES.mdfRequest, {
      properties,
      associations: [
        {
          to: { id: partnerCompanyId },
          types: [
            {
              associationCategory: "USER_DEFINED" as never,
              associationTypeId: assocTypeId,
            },
          ],
        },
      ],
    });
  } catch (err: unknown) {
    const hsErr = err as { body?: { message?: string }; message?: string };
    try {
      const record = await hubspot.crm.objects.basicApi.create(
        OBJECT_TYPES.mdfRequest,
        { properties }
      );
      try {
        await hubspot.apiRequest({
          method: "PUT",
          path: `/crm/v4/objects/${OBJECT_TYPES.mdfRequest}/${record.id}/associations/companies/${partnerCompanyId}`,
          body: [{ associationCategory: "USER_DEFINED", associationTypeId: assocTypeId }],
        });
      } catch {
        // Association is optional fallback
      }
      return record;
    } catch (fallbackErr: unknown) {
      const fallbackHsErr = fallbackErr as { body?: { message?: string }; message?: string };
      const msg =
        fallbackHsErr.body?.message ||
        fallbackHsErr.message ||
        hsErr.body?.message ||
        hsErr.message ||
        "Failed to create MDF request in HubSpot";
      throw new Error(msg);
    }
  }
}

// ─── Price Books (native association lives on Deals, not Companies) ───────

const PRICE_BOOKS_OBJECT_TYPE = "0-3384";

// Tier -> price book ID. Price books can't be looked up by tier natively
// (see getActivePriceBookForDeal), so we map each partner tier to its price book.
const TIER_PRICE_BOOK_IDS: Record<string, string> = {
  platinum: process.env.HUBSPOT_PRICE_BOOK_PLATINUM!,
  gold: process.env.HUBSPOT_PRICE_BOOK_GOLD!,
  silver: process.env.HUBSPOT_PRICE_BOOK_SILVER!,
  registered: process.env.HUBSPOT_PRICE_BOOK_REGISTERED!,
};

export interface PriceBookItem {
  id: string;
  name: string;
  sku: string;
  price: string;
  billingPeriod: string;
  productId: string;
}

export async function getPriceBookItemsForTier(
  tier: string
): Promise<PriceBookItem[]> {
  const priceBookId = TIER_PRICE_BOOK_IDS[tier];
  if (!priceBookId) return [];

  const res = await hubspot.apiRequest({
    method: "GET",
    path: `/commerce/price-books/2026-09-beta/price-books/${priceBookId}/items`,
  });

  type RawItem = {
    id: string;
    name: string;
    sku?: string;
    status: string;
    billingPeriod?: string;
    productId: string;
    pricing?: { prices?: { currencyCode: string; price: string }[] };
  };

  const data = (await res.json()) as { results?: RawItem[]; status?: string; message?: string };
  console.log("[getPriceBookItemsForTier] tier=%s priceBookId=%s rawCount=%d", tier, priceBookId, data.results?.length ?? 0);
  if (data.message) console.error("[getPriceBookItemsForTier] API error:", data.message);

  return (data.results ?? [])
    .filter((item) => item.status === "active")
    .map((item) => {
      const usdPrice =
        item.pricing?.prices?.find((p) => p.currencyCode === "USD")?.price ??
        item.pricing?.prices?.[0]?.price ??
        "0";
      return {
        id: item.id,
        name: item.name,
        sku: item.sku ?? item.id,
        price: usdPrice,
        billingPeriod: item.billingPeriod ?? "P1Y",
        productId: item.productId,
      };
    });
}

export async function getActivePriceBookForDeal(dealId: string) {
  const assocRes = await hubspot.apiRequest({
    method: "GET",
    path: `/crm/v4/objects/deals/${dealId}/associations/${PRICE_BOOKS_OBJECT_TYPE}`,
  });
  const assocData = (await assocRes.json()) as {
    results?: { toObjectId: number }[];
  };
  const priceBookId = assocData.results?.[0]?.toObjectId;
  if (!priceBookId) return null;

  const res = await hubspot.apiRequest({
    method: "GET",
    path: `/commerce/price-books/2026-09-beta/price-books/${priceBookId}`,
  });
  return res.json();
}

// ─── Co-Sell Deals (scoped to partner, filtered to co-sell) ────────────────

export async function getCoSellDeals(partnerCompanyId: string) {
  const all = await getDealRegistrations(partnerCompanyId);
  return all.filter(
    (r) =>
      r.properties.deal_channel_type === "co_sell" ||
      r.properties.co_sell_eligible === "true"
  );
}
