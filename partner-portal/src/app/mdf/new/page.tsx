"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mdfRequestSchema } from "@/lib/schemas";

const CAMPAIGN_TYPES = [
  { label: "Event / Sponsorship", value: "event_sponsorship" },
  { label: "Digital Advertising", value: "digital_advertising" },
  { label: "Content / Webinar", value: "content_webinar" },
  { label: "Direct Mail", value: "direct_mail" },
  { label: "Sales Enablement", value: "sales_enablement" },
  { label: "Demo / POC", value: "demo_poc" },
  { label: "Other", value: "other" },
];

const PROGRAM_SOURCES = [
  { label: "Partner MDF", value: "partner_mdf" },
  { label: "Microsoft Co-op", value: "microsoft_co_op" },
];

const QUARTERS = [
  { label: "Q1", value: "q1" },
  { label: "Q2", value: "q2" },
  { label: "Q3", value: "q3" },
  { label: "Q4", value: "q4" },
];

export default function NewMdfRequestPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const amtStr = form.get("amountRequested");
    const yearStr = form.get("fiscalYear");

    const rawPayload = {
      campaignType: form.get("campaignType"),
      programSource: form.get("programSource") || "partner_mdf",
      amountRequested: amtStr ? Number(amtStr) : undefined,
      quarter: form.get("quarter") || "q1",
      fiscalYear: yearStr ? Number(yearStr) : new Date().getFullYear(),
      activityStartDate: form.get("activityStartDate") || undefined,
      campaignDescription: form.get("campaignDescription") || undefined,
    };

    const parseResult = mdfRequestSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      const errMap: Record<string, string> = {};
      for (const issue of parseResult.error.issues) {
        const fieldName = String(issue.path[0] ?? "");
        if (fieldName && !errMap[fieldName]) {
          errMap[fieldName] = issue.message;
        }
      }
      setFieldErrors(errMap);
      setError(parseResult.error.issues[0]?.message ?? "Validation failed");
      setSubmitting(false);
      return;
    }
    setFieldErrors({});

    try {
      const res = await fetch("/api/mdf-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseResult.data),
      });

      const responseText = await res.text();
      let responseData: { error?: string } = {};
      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch {
        responseData = { error: responseText || `HTTP ${res.status} ${res.statusText}` };
      }

      if (!res.ok) {
        throw new Error(responseData.error ?? "Submission failed");
      }

      router.push("/mdf");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        Submit MDF Request
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Campaign Type <span className="text-red-500 ml-1">*</span>
          </label>
          <select
            name="campaignType"
            required
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              fieldErrors.campaignType
                ? "border-red-500 focus:ring-red-500 bg-red-50/30 text-red-900"
                : "border-gray-300 focus:ring-orange-500 text-gray-900"
            }`}
          >
            {CAMPAIGN_TYPES.map((ct) => (
              <option key={ct.value} value={ct.value}>
                {ct.label}
              </option>
            ))}
          </select>
          {fieldErrors.campaignType && (
            <p className="text-xs text-red-600 font-medium mt-1">
              ⚠️ {fieldErrors.campaignType}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Program Source
          </label>
          <select
            name="programSource"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {PROGRAM_SOURCES.map((ps) => (
              <option key={ps.value} value={ps.value}>
                {ps.label}
              </option>
            ))}
          </select>
        </div>

        <Field
          label="Amount Requested (USD)"
          name="amountRequested"
          type="number"
          placeholder="5000"
          required
          error={fieldErrors.amountRequested}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quarter
            </label>
            <select
              name="quarter"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {QUARTERS.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Fiscal Year"
            name="fiscalYear"
            type="number"
            placeholder="2026"
            defaultValue={new Date().getFullYear()}
            required
            error={fieldErrors.fiscalYear}
          />
        </div>

        <Field
          label="Activity Start Date"
          name="activityStartDate"
          type="date"
          error={fieldErrors.activityStartDate}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Campaign Description
          </label>
          <textarea
            name="campaignDescription"
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Describe the marketing activity and expected outcomes..."
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {submitting ? "Submitting…" : "Submit Request"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  required,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string | number;
  required?: boolean;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
          error
            ? "border-red-500 focus:ring-red-500 bg-red-50/30 text-red-900"
            : "border-gray-300 focus:ring-orange-500 text-gray-900"
        }`}
      />
      {error && (
        <p className="text-xs text-red-600 font-medium mt-1">
          ⚠️ {error}
        </p>
      )}
    </div>
  );
}
