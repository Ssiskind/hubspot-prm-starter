import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { PartnerTier, PartnerUserRole } from "@/types/next-auth";

export const authConfig = {
  providers: [
    CredentialsProvider({
      name: "Email + Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async () => null,
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (token) {
        session.partnerCompanyId = (token.partnerCompanyId as string) ?? "";
        session.partnerTier = (token.partnerTier as PartnerTier) ?? "registered";
        session.partnerUserRole = (token.partnerUserRole as PartnerUserRole) ?? "sales";
        session.partnerCompanyName = (token.partnerCompanyName as string) ?? "";
        session.mdfBalanceAvailable = (token.mdfBalanceAvailable as string) ?? "0";
        session.discountFloorPct = (token.discountFloorPct as number) ?? 0;
        session.discountCeilingPct = (token.discountCeilingPct as number) ?? 0;
        session.payoutRatePct = (token.payoutRatePct as number) ?? 0;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
