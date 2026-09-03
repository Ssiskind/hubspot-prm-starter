import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import {
  checkDealConflict,
  createDealConflictTicket,
  createDealRegistration,
  DiscountOutOfBandError,
  getAssociatedIds,
  getDealRegistrations,
  OBJECT_TYPES,
} from "@/lib/hubspot";
import { dealRegistrationSchema } from "@/lib/schemas";

export async function GET() {
  const session = await auth();
  if (!session?.partnerCompanyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const registrations = await getDealRegistrations(session.partnerCompanyId);
  return NextResponse.json(registrations);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.partnerCompanyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parseResult = dealRegistrationSchema.safeParse(body);

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0];
    return NextResponse.json(
      { error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid registration data" },
      { status: 400 }
    );
  }

  const data = parseResult.data;
  const name = `${session.partnerCompanyName} – ${data.endCustomerName} – ${data.productSku} – ${new Date().toISOString().split("T")[0]}`;

  // Capture any competing registration from another partner before creating
  // this one, so we can open a conflict ticket linking both records.
  const [allConflicts, ownDealIds] = await Promise.all([
    checkDealConflict(data.endCustomerDomain, data.endCustomerName),
    getAssociatedIds(session.partnerCompanyId, OBJECT_TYPES.dealRegistration),
  ]);
  const ownIdSet = new Set(ownDealIds);
  const externalConflict = allConflicts.find((c) => !ownIdSet.has(c.id));

  try {
    const record = await createDealRegistration(session.partnerCompanyId, {
      registrationName: name,
      endCustomerName: data.endCustomerName,
      endCustomerDomain: data.endCustomerDomain,
      estimatedArr: data.estimatedArr,
      productSku: data.productSku,
      dealChannelType: data.dealChannelType,
      partnerNotes: data.partnerNotes,
      coSellEligible: data.coSellEligible,
      ...(data.requestedDiscountPct !== undefined && {
        requestedDiscountPct: data.requestedDiscountPct,
      }),
    });

    let conflictTicketError: string | undefined;
    if (externalConflict) {
      try {
        await createDealConflictTicket({
          endCustomerName: data.endCustomerName,
          newDealId: record.id,
          newDealCompanyId: session.partnerCompanyId,
          existingDealId: externalConflict.id,
        });
      } catch (ticketErr) {
        conflictTicketError = ticketErr instanceof Error ? ticketErr.message : String(ticketErr);
        console.error("Failed to create deal conflict ticket:", ticketErr);
      }
    }

    revalidateTag(`deal-registrations-${session.partnerCompanyId}`);

    return NextResponse.json(
      { ...record, conflictTicketError },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof DiscountOutOfBandError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
