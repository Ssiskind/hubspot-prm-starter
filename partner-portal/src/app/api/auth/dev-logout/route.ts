import { NextRequest, NextResponse } from "next/server";

const DEV_COOKIES = [
  "dev_partner_id",
  "dev_partner_name",
  "dev_partner_tier",
  "dev_mdf_balance",
  "dev_discount_floor",
  "dev_discount_ceiling",
  "dev_payout_rate",
];

export async function GET(req: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", req.url));
  for (const name of DEV_COOKIES) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return response;
}
