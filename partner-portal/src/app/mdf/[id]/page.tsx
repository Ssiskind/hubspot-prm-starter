import { auth } from "@/lib/auth";
import { getMdfRequestForPartner } from "@/lib/hubspot";
import Link from "next/link";
import { notFound } from "next/navigation";

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

const PROGRAM_LABELS: Record<string, string> = {
  partner_mdf: "Partner MDF",
  microsoft_co_op: "Microsoft Co-op",
};

export default async function MdfDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.partnerCompanyId) notFound();

  const mdf = await getMdfRequestForPartner(session.partnerCompanyId, id);
  if (!mdf) notFound();

  const p = mdf.properties;
  const campaignTypeLabel =
    CAMPAIGN_LABELS[p.campaign_type ?? ""] ?? p.campaign_type ?? "—";
  const programSourceLabel =
    PROGRAM_LABELS[p.program_source ?? ""] ?? p.program_source ?? "—";

  return (
    <div className="max-w-3xl mx-auto p-8">
      <Link
        href="/mdf"
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block font-medium"
      >
        ← Back to MDF Requests
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {p.request_name}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {campaignTypeLabel} · {programSourceLabel}
          </p>
        </div>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium capitalize ${
            STATUS_STYLES[p.status ?? ""] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {(p.status ?? "").replace(/_/g, " ")}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
            Amount Requested
          </p>
          <p className="text-xl font-semibold text-gray-900">
            {p.amount_requested
              ? `$${Number(p.amount_requested).toLocaleString()}`
              : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
            Amount Approved
          </p>
          <p className="text-xl font-semibold text-green-700">
            {p.amount_approved
              ? `$${Number(p.amount_approved).toLocaleString()}`
              : "$0"}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
            Amount Reimbursed
          </p>
          <p className="text-xl font-semibold text-emerald-700">
            {p.amount_reimbursed
              ? `$${Number(p.amount_reimbursed).toLocaleString()}`
              : "$0"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          Request Details
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoField label="Campaign Type" value={campaignTypeLabel} />
          <InfoField label="Program Source" value={programSourceLabel} />
          <InfoField
            label="Quarter & FY"
            value={
              p.quarter || p.fiscal_year
                ? `${(p.quarter ?? "").toUpperCase()} ${p.fiscal_year ?? ""}`
                : "—"
            }
          />
          <InfoField
            label="Activity Start Date"
            value={p.activity_start_date ?? "—"}
          />
          {p.amount_claimed && (
            <InfoField
              label="Amount Claimed"
              value={`$${Number(p.amount_claimed).toLocaleString()}`}
            />
          )}
        </div>
      </div>

      {p.campaign_description && (
        <div className="rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">
            Campaign Description
          </h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
            {p.campaign_description}
          </p>
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
      <p className="text-sm text-gray-800 font-medium">{value ?? "—"}</p>
    </div>
  );
}

