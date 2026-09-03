import { NextRequest, NextResponse } from "next/server";
import { auth, PartnerSession } from "@/lib/auth";
import {
  checkDealConflict,
  getAssociatedIds,
  OBJECT_TYPES,
} from "@/lib/hubspot";

export async function GET(req: NextRequest) {
  const session = (await auth()) as unknown as PartnerSession | null;
  if (!session?.partnerCompanyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const endCustomerDomain = req.nextUrl.searchParams.get("endCustomerDomain");
  const endCustomerName = req.nextUrl.searchParams.get("endCustomerName");
  if (!endCustomerDomain?.trim()) {
    return NextResponse.json({ conflicts: [], externalCount: 0, ownCount: 0 });
  }

  const [allConflicts, ownDealIds] = await Promise.all([
    checkDealConflict(endCustomerDomain.trim(), endCustomerName?.trim() || undefined),
    getAssociatedIds(
      session.partnerCompanyId,
      OBJECT_TYPES.dealRegistration
    ),
  ]);

  const ownIdSet = new Set(ownDealIds);
  const external = allConflicts.filter((c) => !ownIdSet.has(c.id));
  const own = allConflicts.filter((c) => ownIdSet.has(c.id));

  return NextResponse.json({
    externalCount: external.length,
    ownCount: own.length,
    conflicts: external.map((c) => ({
      status: c.properties.status,
      product: c.properties.product_sku,
      channelType: c.properties.deal_channel_type,
    })),
  });
}
