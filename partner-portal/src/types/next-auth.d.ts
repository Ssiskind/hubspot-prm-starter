import { DefaultSession } from "next-auth";
import type {} from "next-auth/jwt";

export type PartnerTier = "registered" | "silver" | "gold" | "platinum";
export type PartnerUserRole =
  | "admin"
  | "sales"
  | "pre_sales"
  | "technical"
  | "marketing";

declare module "next-auth" {
  interface Session {
    partnerCompanyId: string;
    partnerTier: PartnerTier;
    partnerUserRole: PartnerUserRole;
    partnerCompanyName: string;
    mdfBalanceAvailable: string;
    discountFloorPct: number;
    discountCeilingPct: number;
    payoutRatePct: number;
    user: DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    partnerCompanyId?: string;
    partnerTier?: string;
    partnerUserRole?: string;
    partnerCompanyName?: string;
    mdfBalanceAvailable?: string;
    discountFloorPct?: number;
    discountCeilingPct?: number;
    payoutRatePct?: number;
  }
}
