import { auth } from "@/lib/auth";
import { getCoSellDeals } from "@/lib/hubspot";
import Link from "next/link";

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800",
  under_review: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-gray-100 text-gray-600",
};

export default async function CoSellPage() {
  const session = await auth();
  if (!session) return null;
  const deals = await getCoSellDeals(session.partnerCompanyId);

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Co-Sell Opportunities
        </h1>
        <Link
          href="/deals/new"
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Register Co-Sell Deal
        </Link>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 mb-6">
        <p className="text-sm text-blue-800">
          Co-sell opportunities are deal registrations flagged for Microsoft
          collaboration. To register a new co-sell deal, use the deal
          registration form and select &ldquo;Co-Sell (Microsoft)&rdquo; as the
          channel type.
        </p>
      </div>

      {deals.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">No co-sell opportunities yet.</p>
          <p className="text-sm mt-1">
            Register a deal with channel type &ldquo;Co-Sell (Microsoft)&rdquo;
            to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "Registration",
                  "End Customer",
                  "ARR",
                  "Product",
                  "Status",
                  "Co-Sell ID",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {deals.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-xs truncate">
                    {d.properties.registration_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {d.properties.end_customer_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {d.properties.estimated_arr
                      ? `$${Number(d.properties.estimated_arr).toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {d.properties.product_sku ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        STATUS_STYLES[d.properties.status ?? ""] ??
                        "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {(d.properties.status ?? "").replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {d.properties.microsoft_co_sell_id || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
