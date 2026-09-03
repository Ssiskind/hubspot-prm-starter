import { auth } from "@/lib/auth";
import { getDealRegistrations } from "@/lib/hubspot";

interface ManagedAccount {
  name: string;
  domain: string;
  totalArr: number;
  products: string[];
  registrationCount: number;
  hasApproved: boolean;
}

export default async function AccountsPage() {
  const session = await auth();
  if (!session) return null;
  const registrations = await getDealRegistrations(session.partnerCompanyId);

  const accountMap = new Map<string, ManagedAccount>();

  for (const r of registrations) {
    const customerName = r.properties.end_customer_name;
    if (!customerName) continue;

    const existing = accountMap.get(customerName);
    const arr = Number(r.properties.estimated_arr) || 0;
    const product = r.properties.product_sku;
    const status = r.properties.status ?? "";
    const isApproved = status === "approved";

    if (existing) {
      existing.totalArr += arr;
      existing.registrationCount += 1;
      if (product && !existing.products.includes(product)) {
        existing.products.push(product);
      }
      if (isApproved) existing.hasApproved = true;
    } else {
      accountMap.set(customerName, {
        name: customerName,
        domain: r.properties.end_customer_domain ?? "",
        totalArr: arr,
        products: product ? [product] : [],
        registrationCount: 1,
        hasApproved: isApproved,
      });
    }
  }

  const accounts = Array.from(accountMap.values()).sort(
    (a, b) => b.totalArr - a.totalArr
  );

  const totalArr = accounts.reduce((sum, a) => sum + a.totalArr, 0);
  const totalPayout = totalArr * (session.payoutRatePct / 100);

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Managed Accounts
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          End customers with deal registrations managed by your organization.
        </p>
      </div>

      {accounts.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400">Total Managed ARR</p>
            <p className="text-xl font-semibold text-gray-900 mt-0.5">
              ${totalArr.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400">
              Estimated Payout ({session.payoutRatePct}%)
            </p>
            <p className="text-xl font-semibold text-orange-600 mt-0.5">
              ${totalPayout.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400">Managed Accounts</p>
            <p className="text-xl font-semibold text-gray-900 mt-0.5">
              {accounts.length}
            </p>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">No managed accounts yet.</p>
          <p className="text-sm mt-1">
            Register and get deals approved to see your managed customers here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {accounts.map((account) => (
            <div
              key={account.name}
              className="rounded-xl border border-gray-200 p-5 hover:border-orange-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    {account.name}
                  </h2>
                  {account.domain && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {account.domain}
                    </p>
                  )}
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    account.hasApproved
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {account.hasApproved ? "Active" : "Pending"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div>
                  <p className="text-gray-400 text-xs">Total ARR</p>
                  <p className="font-medium text-gray-900">
                    ${account.totalArr.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">
                    Est. Payout ({session.payoutRatePct}%)
                  </p>
                  <p className="font-medium text-orange-600">
                    $
                    {(
                      account.totalArr *
                      (session.payoutRatePct / 100)
                    ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-400 text-xs">Registrations</p>
                  <p className="font-medium text-gray-900">
                    {account.registrationCount}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Products</p>
                  <p className="font-medium text-gray-900">
                    {account.products.length > 0
                      ? account.products.join(", ")
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
