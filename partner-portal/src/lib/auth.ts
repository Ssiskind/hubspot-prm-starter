/**
 * NextAuth configuration for partner portal authentication.
 *
 * Auth flow: Partner enters email + shared password → looks up HubSpot Contact by email →
 * retrieves associated Company → caches tier, MDF balance, discount band in the JWT token.
 *
 * This is a demo credentials provider; production should use an enterprise SSO (Entra, Okta, Auth0).
 *
 * Edge-compatibility note: this file runs only in the Node.js runtime (API routes, server
 * components). Middleware uses auth.config.ts, which has no HubSpot imports.
 */

import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getPartnerCompanyByEmail } from "./hubspot";
import { authConfig } from "./auth.config";
import { PartnerTier, PartnerUserRole } from "@/types/next-auth";

export type PartnerSession = {
  user: { name?: string; email?: string; image?: string };
  partnerCompanyId: string;
  partnerTier: "registered" | "silver" | "gold" | "platinum";
  partnerUserRole: "admin" | "sales" | "pre_sales" | "technical" | "marketing";
  partnerCompanyName: string;
  mdfBalanceAvailable: string;
  discountFloorPct: number;
  discountCeilingPct: number;
  payoutRatePct: number;
};

const nextAuth = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "Email + Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        if (credentials.password !== process.env.DEMO_PASSWORD) return null;

        const partner = await getPartnerCompanyByEmail(credentials.email as string);
        if (!partner) return null;

        return {
          id: partner.company.id,
          email: credentials.email as string,
          name: `${partner.contact.properties.firstname ?? ""} ${partner.contact.properties.lastname ?? ""}`.trim(),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.email) {
        const partner = await getPartnerCompanyByEmail(user.email);
        if (partner) {
          token.partnerCompanyId = partner.company.id;
          token.partnerTier = partner.company.properties.partner_tier;
          token.partnerUserRole = partner.contact.properties.partner_user_role;
          token.partnerCompanyName = partner.company.properties.name;
          token.mdfBalanceAvailable = partner.company.properties.mdf_balance_available;
          token.discountFloorPct = Number(partner.company.properties.partner_discount_floor_pct ?? 0);
          token.discountCeilingPct = Number(partner.company.properties.partner_discount_ceiling_pct ?? 0);
          token.payoutRatePct = Number(partner.company.properties.partner_payout_rate_pct ?? 0);
        }
      }
      return token;
    },
    session: authConfig.callbacks!.session!,
  },
});

export const handlers = nextAuth.handlers;
export const signIn = nextAuth.signIn;
export const signOut = nextAuth.signOut;
export const auth = nextAuth.auth;
