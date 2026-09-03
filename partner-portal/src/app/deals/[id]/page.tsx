import { auth } from "@/lib/auth";
import { getDealRegistrationForPartner } from "@/lib/hubspot";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppealForm from "./AppealForm";

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800",
  under_review: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-gray-100 text-gray-600",
};

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) return notFound();
  const deal = await getDealRegistrationForPartner(
    session.partnerCompanyId,
    id
  );

  if (!deal) notFound();

  const p = deal.properties;
  const canAppeal = p.status === "rejected" || p.status === "under_review";

  return (
    <div className="max-w-3xl mx-auto p-8">
      <Link
        href="/deals"
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
      >
        ← Back to Deal Registrations
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {p.end_customer_name}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{p.registration_name}</p>
        </div>
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
            STATUS_STYLES[p.status ?? ""] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {(p.status ?? "").replace("_", " ")}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <InfoField label="End Customer Domain" value={p.end_customer_domain} />
        <InfoField
          label="Estimated ARR"
          value={
            p.estimated_arr
              ? `$${Number(p.estimated_arr).toLocaleString()}`
              : undefined
          }
        />
        <InfoField label="Product / SKU" value={p.product_sku} />
        <InfoField
          label="Channel Type"
          value={p.deal_channel_type?.replace("_", " ")}
        />
        <InfoField label="Submitted" value={p.submission_date} />
        <InfoField label="Expires" value={p.expiry_date} />
        {p.approved_discount_pct && (
          <InfoField
            label="Approved Discount"
            value={`${p.approved_discount_pct}%`}
          />
        )}
        {p.microsoft_co_sell_id && (
          <InfoField label="Microsoft Co-Sell ID" value={p.microsoft_co_sell_id} />
        )}
      </div>

      {p.rejection_reason && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-4">
          <p className="text-sm font-medium text-red-800 mb-1">
            Rejection Reason
          </p>
          <p className="text-sm text-red-700">{p.rejection_reason}</p>
        </div>
      )}

      {p.channel_manager_notes && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-4">
          <p className="text-sm font-medium text-gray-800 mb-1">
            Channel Manager Notes
          </p>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">
            {p.channel_manager_notes}
          </p>
        </div>
      )}

      {p.partner_notes && (
        <div className="rounded-lg border border-gray-200 p-4 mb-6">
          <p className="text-sm font-medium text-gray-800 mb-1">
            Notes &amp; Communication History
          </p>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">
            {p.partner_notes}
          </p>
        </div>
      )}

      {canAppeal && (
        <div className="border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            {p.status === "rejected"
              ? "Appeal This Decision"
              : "Add Context for Reviewer"}
          </h2>
          <AppealForm dealId={deal.id} />
        </div>
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p className="text-sm text-gray-800">{value ?? "—"}</p>
    </div>
  );
}
