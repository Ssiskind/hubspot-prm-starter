import { auth } from "@/lib/auth";
import { getDealRegistrations } from "@/lib/hubspot";
import Link from "next/link";

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800",
  under_review: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-gray-100 text-gray-600",
};

export default async function DealsPage() {
  const session = await auth();
  if (!session) return null;
  const registrations = await getDealRegistrations(session.partnerCompanyId);

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Deal Registrations
        </h1>
        <Link
          href="/deals/new"
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Register Deal
        </Link>
      </div>

      {registrations.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">No deal registrations yet.</p>
          <p className="text-sm mt-1">
            Register your first deal to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Registration", "End Customer", "ARR", "Product", "Status", "Expires"].map((h) => (
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
              {registrations.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-xs truncate">
                    <Link
                      href={`/deals/${r.id}`}
                      className="text-gray-900 hover:text-orange-600 hover:underline"
                    >
                      {r.properties.registration_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {r.properties.end_customer_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {r.properties.estimated_arr
                      ? `$${Number(r.properties.estimated_arr).toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {r.properties.product_sku ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        STATUS_STYLES[r.properties.status ?? ""] ??
                        "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {(r.properties.status ?? "").replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {r.properties.expiry_date ?? "—"}
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
