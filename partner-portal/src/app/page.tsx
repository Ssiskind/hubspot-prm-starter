import { auth } from "@/lib/auth";
import Link from "next/link";

const TIER_COLORS: Record<string, string> = {
  registered: "text-gray-600 bg-gray-100",
  silver: "text-slate-700 bg-slate-100",
  gold: "text-yellow-700 bg-yellow-100",
  platinum: "text-violet-700 bg-violet-100",
};

const TIER_BENEFITS: Record<string, string[]> = {
  registered: ["Deal registration", "Managed accounts view"],
  silver: ["Deal registration", "Managed accounts view", "MDF requests"],
  gold: [
    "Deal registration",
    "Managed accounts view",
    "MDF requests",
    "Microsoft co-sell registration",
    "Priority channel manager review",
  ],
  platinum: [
    "Deal registration",
    "Managed accounts view",
    "MDF requests",
    "Microsoft co-sell registration",
    "Priority channel manager review",
    "Highest pre-approved discount band",
  ],
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session) return null;

  const cards = [
    {
      title: "Deal Registrations",
      description: "Submit and track partner deal registrations for approval.",
      href: "/deals",
      available: true,
    },
    {
      title: "MDF Requests",
      description: "Request and manage Market Development Funds.",
      href: "/mdf",
      available: ["silver", "gold", "platinum"].includes(session.partnerTier),
      lockMessage: "Available from Silver tier",
    },
    {
      title: "Co-Sell Opportunities",
      description: "Collaborate on Microsoft co-sell deals.",
      href: "/co-sell",
      available: ["gold", "platinum"].includes(session.partnerTier),
      lockMessage: "Available from Gold tier",
    },
    {
      title: "Managed Accounts",
      description: "View and manage your customer relationships.",
      href: "/accounts",
      available: true,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {session.partnerCompanyName}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Partner Portal</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${
            TIER_COLORS[session.partnerTier] ?? TIER_COLORS.registered
          }`}
        >
          {session.partnerTier} Partner
        </span>
      </div>

      <div className="rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 capitalize">
          {session.partnerTier} Level Benefits
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(
            TIER_BENEFITS[session.partnerTier] ?? TIER_BENEFITS.registered
          ).map((benefit) => (
            <li
              key={benefit}
              className="flex items-center gap-2 text-sm text-gray-600"
            >
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full shrink-0" />
              {benefit}
            </li>
          ))}
          {session.discountCeilingPct > 0 && (
            <li className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full shrink-0" />
              Pre-approved discount band: {session.discountFloorPct}%–
              {session.discountCeilingPct}%
            </li>
          )}
        </ul>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((card) => (
          <div
            key={card.href}
            className={`rounded-xl border p-6 ${
              card.available
                ? "border-gray-200 hover:border-orange-300 hover:shadow-sm transition-all"
                : "border-gray-100 bg-gray-50 opacity-60"
            }`}
          >
            <h2 className="text-base font-semibold text-gray-900 mb-1">
              {card.title}
            </h2>
            <p className="text-sm text-gray-500 mb-4">{card.description}</p>
            {card.available ? (
              <Link
                href={card.href}
                className="text-sm text-orange-600 font-medium hover:underline"
              >
                Open →
              </Link>
            ) : (
              <span className="text-xs text-gray-400">{card.lockMessage}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
