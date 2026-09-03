import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { appendDealPartnerNote, getDealRegistrationForPartner } from "@/lib/hubspot";
import { dealNoteSchema } from "@/lib/schemas";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.partnerCompanyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const record = await getDealRegistrationForPartner(
    session.partnerCompanyId,
    id
  );
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parseResult = dealNoteSchema.safeParse(body);

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0];
    return NextResponse.json(
      { error: issue ? issue.message : "Note content is required" },
      { status: 400 }
    );
  }

  const updated = await appendDealPartnerNote(
    id,
    record.properties.partner_notes ?? "",
    parseResult.data.note
  );

  revalidateTag(`deal-registrations-${session.partnerCompanyId}`, { expire: 0 });

  return NextResponse.json(updated);
}
