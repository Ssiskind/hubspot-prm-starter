import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { createMdfRequest, getMdfRequests } from "@/lib/hubspot";
import { mdfRequestSchema } from "@/lib/schemas";

export async function GET() {
  const session = await auth();
  if (!session?.partnerCompanyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requests = await getMdfRequests(session.partnerCompanyId);
  return NextResponse.json(requests);
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.partnerCompanyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parseResult = mdfRequestSchema.safeParse(body);

    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return NextResponse.json(
        { error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid MDF request data" },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const typeLabel = data.campaignType.replace(/_/g, " ");
    const name = `${session.partnerCompanyName} – ${typeLabel} – ${new Date().toISOString().split("T")[0]}`;

    const record = await createMdfRequest(session.partnerCompanyId, {
      requestName: name,
      campaignType: data.campaignType,
      programSource: data.programSource,
      amountRequested: data.amountRequested,
      quarter: data.quarter,
      fiscalYear: data.fiscalYear,
      activityStartDate: data.activityStartDate || undefined,
      campaignDescription: data.campaignDescription || undefined,
    });

    try {
      revalidateTag(`mdf-requests-${session.partnerCompanyId}`);
    } catch {
      // ignore revalidation error if caching is disabled
    }

    return NextResponse.json(record, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to process MDF request";
    console.error("MDF request POST error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
