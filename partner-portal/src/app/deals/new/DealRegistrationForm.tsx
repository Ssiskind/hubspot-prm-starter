"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { dealRegistrationSchema } from "@/lib/schemas";

const ALL_CHANNEL_TYPES = [
  { label: "Resell", value: "resell" },
  { label: "Referral", value: "referral" },
  { label: "Distribution", value: "distribution" },
  { label: "Co-Sell (Microsoft)", value: "co_sell", requiresGoldPlus: true },
];

const GOLD_PLUS = new Set(["gold", "platinum"]);

type ConflictInfo = {
  externalCount: number;
  ownCount: number;
  conflicts: { status: string; product: string; channelType: string }[];
};

type PriceBookItem = {
  id: string;
  name: string;
  sku: string;
  price: string;
  billingPeriod: string;
  productId: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function annualizedPrice(item: PriceBookItem): number {
  const price = Number(item.price) || 0;
  return round2(item.billingPeriod === "P1M" ? price * 12 : price);
}

function customerAnnualPrice(
  item: PriceBookItem,
  discountPct: number,
  discountFloorPct: number
): number {
  const tierPrice = annualizedPrice(item);
  const extraDiscountPct = Math.max(0, discountPct - discountFloorPct);
  return round2(tierPrice * (1 - extraDiscountPct / 100));
}

function listAnnualPrice(item: PriceBookItem, discountFloorPct: number): number {
  const tierPrice = annualizedPrice(item);
  return discountFloorPct >= 100
    ? tierPrice
    : round2(tierPrice / (1 - discountFloorPct / 100));
}

export default function DealRegistrationForm({
  partnerTier,
  discountFloorPct,
  discountCeilingPct,
  payoutRatePct,
  priceBookItems,
}: {
  partnerTier: string;
  discountFloorPct: number;
  discountCeilingPct: number;
  payoutRatePct: number;
  priceBookItems: PriceBookItem[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [domain, setDomain] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [discountPct, setDiscountPct] = useState(discountFloorPct);
  const [selectedSku, setSelectedSku] = useState(priceBookItems[0]?.sku ?? "");
  const hasDiscountBand = discountCeilingPct > 0;
  const selectedItem = priceBookItems.find((i) => i.sku === selectedSku);
  const estimatedArr = selectedItem
    ? customerAnnualPrice(selectedItem, discountPct, discountFloorPct)
    : 0;

  function validateDomain(value: string) {
    const parseResult = dealRegistrationSchema.shape.endCustomerDomain.safeParse(value);
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message ?? "Please enter a valid domain";
      setFieldErrors((prev) => ({ ...prev, endCustomerDomain: msg }));
      return false;
    }
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy.endCustomerDomain;
      return copy;
    });
    return true;
  }

  function validateCustomerName(value: string) {
    const parseResult = dealRegistrationSchema.shape.endCustomerName.safeParse(value);
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message ?? "End customer name is required";
      setFieldErrors((prev) => ({ ...prev, endCustomerName: msg }));
      return false;
    }
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy.endCustomerName;
      return copy;
    });
    return true;
  }

  function handleProductChange(sku: string) {
    setSelectedSku(sku);
  }

  function handleDiscountChange(pct: number) {
    setDiscountPct(pct);
  }

  const channelTypes = ALL_CHANNEL_TYPES.filter(
    (ct) => !ct.requiresGoldPlus || GOLD_PLUS.has(partnerTier)
  );

  const checkConflict = useCallback(async (dom: string, name: string) => {
    if (!dom.trim()) {
      setConflict(null);
      return;
    }
    setChecking(true);
    try {
      const params = new URLSearchParams({ endCustomerDomain: dom.trim() });
      if (name.trim()) params.set("endCustomerName", name.trim());
      const res = await fetch(`/api/deal-registrations/conflict?${params}`);
      if (res.ok) {
        const data: ConflictInfo = await res.json();
        setConflict(data.externalCount > 0 || data.ownCount > 0 ? data : null);
      }
    } catch {
      // non-critical — don't block form submission
    } finally {
      setChecking(false);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const rawPayload = {
      endCustomerName: form.get("endCustomerName"),
      endCustomerDomain: form.get("endCustomerDomain"),
      estimatedArr,
      productSku: selectedSku,
      dealChannelType: form.get("dealChannelType"),
      partnerNotes: form.get("partnerNotes"),
      coSellEligible: form.get("dealChannelType") === "co_sell",
      ...(hasDiscountBand && { requestedDiscountPct: discountPct }),
    };

    const parseResult = dealRegistrationSchema.safeParse(rawPayload);
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
      const res = await fetch("/api/deal-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseResult.data),
      });

      const responseText = await res.text();
      let responseData: { error?: string; conflictTicketError?: string } = {};
      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch {
        responseData = { error: responseText || `HTTP ${res.status} ${res.statusText}` };
      }

      if (!res.ok) {
        throw new Error(responseData.error ?? "Submission failed");
      }

      if (responseData.conflictTicketError) {
        console.warn("Conflict ticket error:", responseData.conflictTicketError);
        setError(`Deal registered, but conflict ticket failed: ${responseData.conflictTicketError}`);
        setSubmitting(false);
        return;
      }

      router.push("/deals");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">
          Register a Deal
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Customer Domain
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              name="endCustomerDomain"
              required
              placeholder="acme.com"
              value={domain}
              onChange={(e) => {
                const val = e.target.value;
                setDomain(val);
                if (fieldErrors.endCustomerDomain) {
                  validateDomain(val);
                }
              }}
              onBlur={(e) => {
                const isValid = validateDomain(e.target.value);
                if (isValid) {
                  checkConflict(e.target.value, customerName);
                } else {
                  setConflict(null);
                }
              }}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                fieldErrors.endCustomerDomain
                  ? "border-red-500 focus:ring-red-500 bg-red-50/30 text-red-900"
                  : "border-gray-300 focus:ring-orange-500 text-gray-900"
              }`}
            />
            {fieldErrors.endCustomerDomain ? (
              <p className="text-xs text-red-600 font-medium mt-1.5 flex items-center gap-1">
                <span>⚠️</span> {fieldErrors.endCustomerDomain}
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">
                Used as the unique key for conflict detection.
              </p>
            )}
            {checking && (
              <p className="text-xs text-gray-400 mt-1">
                Checking for existing registrations...
              </p>
            )}
          </div>

          {conflict && conflict.externalCount > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-amber-500 mt-0.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Deal Conflict Detected
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    This customer already has{" "}
                    <strong>{conflict.externalCount}</strong> active
                    registration{conflict.externalCount > 1 ? "s" : ""} with
                    another partner or Example Company directly. Your registration may be
                    reviewed for overlap.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {conflict.conflicts.map((c, i) => (
                      <li
                        key={i}
                        className="text-xs text-amber-600 flex items-center gap-1.5"
                      >
                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                        {c.product ?? "Unknown product"} —{" "}
                        {(c.channelType ?? "").replace("_", " ")} —{" "}
                        <span className="capitalize">{c.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {conflict && conflict.ownCount > 0 && conflict.externalCount === 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-sm text-blue-700">
                You already have <strong>{conflict.ownCount}</strong> registration
                {conflict.ownCount > 1 ? "s" : ""} for this customer.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Customer Name
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              name="endCustomerName"
              required
              value={customerName}
              onChange={(e) => {
                const val = e.target.value;
                setCustomerName(val);
                if (fieldErrors.endCustomerName) {
                  validateCustomerName(val);
                }
              }}
              onBlur={(e) => validateCustomerName(e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                fieldErrors.endCustomerName
                  ? "border-red-500 focus:ring-red-500 bg-red-50/30 text-red-900"
                  : "border-gray-300 focus:ring-orange-500 text-gray-900"
              }`}
            />
            {fieldErrors.endCustomerName && (
              <p className="text-xs text-red-600 font-medium mt-1.5 flex items-center gap-1">
                <span>⚠️</span> {fieldErrors.endCustomerName}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product
                <span className="text-red-500 ml-1">*</span>
              </label>
              {priceBookItems.length === 0 ? (
                <p className="text-xs text-red-500">
                  No price book found for your tier — contact your channel
                  manager.
                </p>
              ) : (
                <select
                  value={selectedSku}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {priceBookItems.map((item) => (
                    <option key={item.sku} value={item.sku}>
                      {item.name} — ${Number(item.price).toLocaleString()}/mo
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Pricing is your {partnerTier} tier price, from Example Company's
                price book.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated ARR (USD)
              </label>
              <input
                type="text"
                readOnly
                value={
                  selectedItem ? `$${estimatedArr.toLocaleString()}` : "—"
                }
                className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600"
              />
              <p className="text-xs text-gray-400 mt-1">
                Computed from product price and requested discount — see Deal
                Economics below.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Channel Type
            </label>
            <select
              name="dealChannelType"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {channelTypes.map((ct) => (
                <option key={ct.value} value={ct.value}>
                  {ct.label}
                </option>
              ))}
            </select>
            {!GOLD_PLUS.has(partnerTier) && (
              <p className="text-xs text-gray-400 mt-1">
                Co-Sell registration is available from Gold tier.
              </p>
            )}
          </div>

          {hasDiscountBand && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Requested Discount
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  name="requestedDiscountPctRange"
                  min={discountFloorPct}
                  max={discountCeilingPct}
                  step={1}
                  value={discountPct}
                  onChange={(e) => handleDiscountChange(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-medium text-gray-900 w-12 text-right">
                  {discountPct}%
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Your pre-approved band is {discountFloorPct}%–{discountCeilingPct}%.
                Requests within this range are fast-tracked automatically.
              </p>
            </div>
          )}

          {selectedItem && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                Deal Economics
              </h3>
              <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
                <dt className="text-gray-500">List price (annual)</dt>
                <dd className="text-gray-900 text-right">
                  $
                  {listAnnualPrice(
                    selectedItem,
                    discountFloorPct
                  ).toLocaleString()}
                </dd>
                <dt className="text-gray-500">Customer pays (annual)</dt>
                <dd className="text-gray-900 text-right font-medium">
                  $
                  {customerAnnualPrice(
                    selectedItem,
                    discountPct,
                    discountFloorPct
                  ).toLocaleString()}
                </dd>
                <dt className="text-gray-500">Total discount extended</dt>
                <dd className="text-gray-900 text-right">
                  $
                  {(
                    listAnnualPrice(selectedItem, discountFloorPct) -
                    customerAnnualPrice(selectedItem, discountPct, discountFloorPct)
                  ).toLocaleString()}
                </dd>
                <dt className="text-gray-500">
                  Your estimated payout ({payoutRatePct}%)
                </dt>
                <dd className="text-orange-600 text-right font-semibold">
                  $
                  {round2(
                    customerAnnualPrice(
                      selectedItem,
                      discountPct,
                      discountFloorPct
                    ) *
                      (payoutRatePct / 100)
                  ).toLocaleString()}
                </dd>
              </dl>
              <p className="text-xs text-gray-400 mt-2">
                Payout is an estimate based on your {partnerTier} tier rate.
                Actual payout terms are set by your partner agreement.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="partnerNotes"
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Any context helpful for approval..."
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
              {submitting ? "Submitting…" : "Submit Registration"}
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

      <aside className="lg:pt-14">
        <div className="rounded-xl border border-gray-200 p-5 sticky top-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Deal Registration Terms
          </h2>
          <ul className="space-y-2.5 text-xs text-gray-600">
            <li>
              Open to direct Example Company's partners in good standing only.
            </li>
            <li>
              The opportunity must not already be registered by another
              partner — we check this automatically when you enter the
              customer name and domain.
            </li>
            <li>
              First partner to submit a qualifying registration is approved
              for that customer.
            </li>
            <li>
              Approved registrations are protected for{" "}
              <strong>90 days</strong> from submission. A material change to
              the deal requires a new registration.
            </li>
            <li>
              Requested discounts must fall within your pre-approved band —
              requests outside that range are not accepted.
            </li>
            <li>
              If a registration is rejected or needs more context, you can
              respond directly from the registration&apos;s detail page.
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
