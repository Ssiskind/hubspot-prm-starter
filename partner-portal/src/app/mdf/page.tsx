import { auth } from "@/lib/auth";
import { getMdfRequests } from "@/lib/hubspot";
import Link from "next/link";

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800",
  under_review: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  proof_submitted: "bg-indigo-100 text-indigo-800",
  reimbursed: "bg-emerald-100 text-emerald-800",
};

const CAMPAIGN_LABELS: Record<string, string> = {
  event_sponsorship: "Event / Sponsorship",
  digital_advertising: "Digital Advertising",
  content_webinar: "Content / Webinar",
  direct_mail: "Direct Mail",
  sales_enablement: "Sales Enablement",
  demo_poc: "Demo / POC",
  other: "Other",
};

export default async function MdfPage() {
  const session = await auth();
  if (!session) return null;
  const requests = await getMdfRequests(session.partnerCompanyId);

  const totalRequested = requests.reduce(
    (sum, r) => sum + (Number(r.properties.amount_requested) || 0),
    0
  );
  const totalApproved = requests.reduce(
    (sum, r) => sum + (Number(r.properties.amount_approved) || 0),
    0
  );
  const balance = Number(session.mdfBalanceAvailable) || 0;

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">MDF Requests</h1>
        <Link
          href="/mdf/new"
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + New Request
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Balance Available
          </p>
          <p className="text-xl font-semibold text-gray-900">
            ${balance.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Total Requested
          </p>
          <p className="text-xl font-semibold text-gray-900">
            ${totalRequested.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Total Approved
          </p>
          <p className="text-xl font-semibold text-green-700">
            ${totalApproved.toLocaleString()}
          </p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">No MDF requests yet.</p>
          <p className="text-sm mt-1">
            Submit your first request to access marketing funds.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "Request",
                  "Campaign Type",
                  "Status",
                  "Requested",
                  "Approved",
                  "Reimbursed",
                  "Quarter",
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
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-xs truncate">
                    <Link
                      href={`/mdf/${r.id}`}
                      className="text-gray-900 hover:text-orange-600 hover:underline"
                    >
                      {r.properties.request_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {CAMPAIGN_LABELS[r.properties.campaign_type ?? ""] ??
                      r.properties.campaign_type ??
                      "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        STATUS_STYLES[r.properties.status ?? ""] ??
                        "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {(r.properties.status ?? "").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {r.properties.amount_requested
                      ? `$${Number(r.properties.amount_requested).toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {r.properties.amount_approved
                      ? `$${Number(r.properties.amount_approved).toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {r.properties.amount_reimbursed
                      ? `$${Number(r.properties.amount_reimbursed).toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 uppercase">
                    {r.properties.quarter ?? "—"}
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
