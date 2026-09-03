import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse, NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

const TIER_ORDER = ["registered", "silver", "gold", "platinum"] as const;
type Tier = (typeof TIER_ORDER)[number];

const TIER_GATES: Record<string, Tier> = {
  "/mdf": "silver",
  "/co-sell": "gold",
  "/business-plan": "gold",
};

const DEV_BYPASS = process.env.DEV_BYPASS_AUTH === "true";

function checkTierGates(pathname: string, tier: string, reqUrl: string) {
  const requiredTier = Object.entries(TIER_GATES).find(([path]) =>
    pathname.startsWith(path)
  )?.[1];

  if (requiredTier) {
    const userTierIndex = TIER_ORDER.indexOf((tier ?? "registered") as Tier);
    const requiredTierIndex = TIER_ORDER.indexOf(requiredTier);
    if (userTierIndex < requiredTierIndex) {
      return NextResponse.redirect(new URL("/upgrade-required", reqUrl));
    }
  }
  return NextResponse.next();
}

function buildAuthMiddleware() {
  return auth((req) => {
    const session = req.auth as unknown as {
      partnerTier?: Tier;
      partnerCompanyId?: string;
    } | null;

    if (!session?.partnerCompanyId) {
      const loginUrl = new URL("/api/auth/signin", req.url);
      loginUrl.searchParams.set("callbackUrl", req.url);
      return NextResponse.redirect(loginUrl);
    }

    return checkTierGates(
      req.nextUrl.pathname,
      session.partnerTier ?? "registered",
      req.url
    );
  });
}

function devMiddleware(req: NextRequest) {
  const partnerId = req.cookies.get("dev_partner_id")?.value;
  if (!partnerId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const tier = req.cookies.get("dev_partner_tier")?.value ?? "registered";
  return checkTierGates(req.nextUrl.pathname, tier, req.url);
}

export default DEV_BYPASS ? devMiddleware : buildAuthMiddleware();

export const config = {
  matcher: [
    "/((?!api/auth|api/partners|_next/static|_next/image|favicon.ico|login|upgrade-required).*)",
  ],
};
