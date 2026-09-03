import { NextRequest, NextResponse } from "next/server";
import hubspot from "@/lib/hubspot";

// Thresholds for each tier (annualized MRR = partner_mrr_managed * 12)
const DEFAULT_THRESHOLDS = {
  silver: 50_000,
  gold: 200_000,
  platinum: 500_000,
};

export async function POST(req: NextRequest) {
  const body = await req.json();

  // HubSpot workflow action POST body has inputFields and object
  const { inputFields, object } = body as {
    inputFields: Record<string, string>;
    object: { objectId: string };
  };

  const companyId = object?.objectId;
  if (!companyId) {
    return NextResponse.json({ message: "Missing objectId" }, { status: 400 });
  }

  const silverThreshold = Number(inputFields?.silver_revenue_threshold ?? DEFAULT_THRESHOLDS.silver);
  const goldThreshold = Number(inputFields?.gold_revenue_threshold ?? DEFAULT_THRESHOLDS.gold);
  const platinumThreshold = Number(inputFields?.platinum_revenue_threshold ?? DEFAULT_THRESHOLDS.platinum);

  const companyRes = await hubspot.crm.companies.basicApi.getById(companyId, [
    "partner_mrr_managed",
    "partner_certification_count",
    "partner_tier",
  ]);

  const props = companyRes.properties;
  const ytdRevenue = Number(props.partner_mrr_managed ?? 0) * 12;
  const certCount = Number(props.partner_certification_count ?? 0);

  let newTier = "registered";
  if (ytdRevenue >= platinumThreshold && certCount >= 3) {
    newTier = "platinum";
  } else if (ytdRevenue >= goldThreshold && certCount >= 2) {
    newTier = "gold";
  } else if (ytdRevenue >= silverThreshold && certCount >= 1) {
    newTier = "silver";
  }

  if (newTier !== props.partner_tier) {
    await hubspot.crm.companies.basicApi.update(companyId, {
      properties: { partner_tier: newTier },
    });
  }

  // Workflow action response format
  return NextResponse.json({
    outputFields: { new_tier: newTier },
  });
}
