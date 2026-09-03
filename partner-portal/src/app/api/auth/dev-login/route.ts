import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const data = await req.formData();
  const companyId = data.get("companyId") as string;
  const companyName = data.get("companyName") as string;
  const tier = (data.get("tier") as string) || "registered";
  const mdfBalance = (data.get("mdfBalance") as string) || "0";
  const discountFloor = (data.get("discountFloor") as string) || "0";
  const discountCeiling = (data.get("discountCeiling") as string) || "0";
  const payoutRate = (data.get("payoutRate") as string) || "0";

  if (!companyId || !companyName) {
    return NextResponse.json(
      { error: "companyId and companyName are required" },
      { status: 400 }
    );
  }

  const response = NextResponse.redirect(new URL("/", req.url));
  response.cookies.set("dev_partner_id", companyId, {
    path: "/",
    maxAge: 86400,
  });
  response.cookies.set("dev_partner_name", companyName, {
    path: "/",
    maxAge: 86400,
  });
  response.cookies.set("dev_partner_tier", tier, {
    path: "/",
    maxAge: 86400,
  });
  response.cookies.set("dev_mdf_balance", mdfBalance, {
    path: "/",
    maxAge: 86400,
  });
  response.cookies.set("dev_discount_floor", discountFloor, {
    path: "/",
    maxAge: 86400,
  });
  response.cookies.set("dev_discount_ceiling", discountCeiling, {
    path: "/",
    maxAge: 86400,
  });
  response.cookies.set("dev_payout_rate", payoutRate, {
    path: "/",
    maxAge: 86400,
  });

  return response;
}
