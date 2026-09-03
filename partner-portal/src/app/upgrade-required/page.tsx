import { auth } from "@/lib/auth";
import Link from "next/link";

const TIER_COLORS: Record<string, string> = {
  registered: "text-gray-600 bg-gray-100",
  silver: "text-slate-700 bg-slate-100",
  gold: "text-yellow-700 bg-yellow-100",
  platinum: "text-violet-700 bg-violet-100",
};

const TIER_FEATURES = [
  {
    tier: "Registered",
    features: ["Deal Registrations", "Managed Accounts"],
    color: "text-gray-600",
  },
  {
    tier: "Silver",
    features: ["Everything in Registered", "MDF Requests"],
    color: "text-slate-700",
  },
  {
    tier: "Gold",
    features: ["Everything in Silver", "Co-Sell Opportunities", "Business Plans"],
    color: "text-yellow-700",
  },
  {
    tier: "Platinum",
    features: ["Everything in Gold", "Priority Support", "Dedicated TAM"],
    color: "text-violet-700",
  },
];

export default async function UpgradeRequiredPage() {
  let tier = "registered";
  try {
    const session = await auth();
    if (session?.partnerTier) tier = session.partnerTier;
  } catch {
    // Session may not be available — show page anyway
  }

  return (
    <div className="max-w-xl mx-auto p-8 text-center">
      <div className="mb-6">
        <svg
          className="mx-auto h-16 w-16 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
          />
        </svg>
      </div>

      <h1 className="text-2xl font-semibold text-gray-900 mb-2">
        Feature Unavailable
      </h1>
      <p className="text-gray-500 mb-4">
        Your current partner tier does not include access to this feature.
        Contact your channel manager to discuss upgrading your
        partnership.
      </p>

      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium capitalize mb-8 ${
          TIER_COLORS[tier] ?? TIER_COLORS.registered
        }`}
      >
        Current tier: {tier}
      </span>

      <div className="text-left rounded-xl border border-gray-200 overflow-hidden mb-8">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tier
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Features
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {TIER_FEATURES.map((t) => (
              <tr
                key={t.tier}
                className={
                  t.tier.toLowerCase() === tier ? "bg-orange-50" : ""
                }
              >
                <td
                  className={`px-4 py-3 text-sm font-medium ${t.color}`}
                >
                  {t.tier}
                  {t.tier.toLowerCase() === tier && (
                    <span className="ml-2 text-xs text-orange-500">
                      (You)
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {t.features.join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Link
        href="/"
        className="text-sm text-orange-600 font-medium hover:underline"
      >
        ← Back to Dashboard
      </Link>
    </div>
  );
}
