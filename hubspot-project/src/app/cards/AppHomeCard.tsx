import {
  hubspot,
  Text,
  Flex,
  Divider,
  LoadingSpinner,
  Alert,
  Statistics,
  StatisticsItem,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Tag,
  Heading,
  Box,
  Link,
} from "@hubspot/ui-extensions";
import { useExtensionContext } from "@hubspot/ui-extensions";
import { useState, useEffect } from "react";

type SearchResult<T> = { results: T[]; total: number };

type DealReg = {
  properties: {
    status?: string;
    estimated_arr?: string;
    deal_channel_type?: string;
  };
};

type MdfReq = {
  properties: {
    status?: string;
    amount_requested?: string;
    amount_approved?: string;
  };
};

type PartnerCompany = {
  properties: {
    name?: string;
    partner_tier?: string;
    partner_mrr_managed?: string;
  };
};

type DashboardData = {
  activePartners: number;
  tierCounts: Record<string, number>;
  totalMrrManaged: number;
  dealByStatus: Record<string, number>;
  approvedArr: number;
  mdfRequested: number;
  mdfApproved: number;
};

const TIER_ORDER = ["platinum", "gold", "silver", "registered"];
const TIER_VARIANT: Record<string, "default" | "success" | "warning" | "error"> = {
  platinum: "success",
  gold: "warning",
  silver: "default",
  registered: "default",
};

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "error"> = {
  submitted: "default",
  under_review: "warning",
  approved: "success",
  rejected: "error",
  expired: "default",
};

async function searchAll<T>(objectType: string, properties: string[], filters: object[] = []): Promise<T[]> {
  const results: T[] = [];
  let after: string | undefined;

  do {
    const body: Record<string, unknown> = {
      filterGroups: filters.length ? [{ filters }] : [],
      properties,
      limit: 100,
      sorts: [],
    };
    if (after) body.after = after;

    const res = await hubspot.fetch(`https://api.hubapi.com/crm/v3/objects/${objectType}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = (await res.json()) as SearchResult<T> & { paging?: { next?: { after?: string } } };
    results.push(...(data.results ?? []));
    after = data.paging?.next?.after;
  } while (after && results.length < 500);

  return results;
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

hubspot.extend(() => <AppHomeDashboard />);

function AppHomeDashboard() {
  const ctx = useExtensionContext();
  const portalId = String(ctx.portal.id);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      searchAll<PartnerCompany>("companies", ["name", "partner_tier", "partner_mrr_managed", "partner_status"], [
        { propertyName: "partner_status", operator: "EQ", value: "active" },
      ]),
      searchAll<DealReg>("deal_registration", ["status", "estimated_arr", "deal_channel_type"]),
      searchAll<MdfReq>("mdf_request", ["status", "amount_requested", "amount_approved"]),
    ])
      .then(([partners, deals, mdfs]) => {
        const tierCounts: Record<string, number> = { platinum: 0, gold: 0, silver: 0, registered: 0 };
        let totalMrrManaged = 0;
        for (const p of partners) {
          const tier = p.properties.partner_tier ?? "registered";
          tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
          totalMrrManaged += Number(p.properties.partner_mrr_managed ?? 0);
        }

        const dealByStatus: Record<string, number> = {};
        let approvedArr = 0;
        for (const d of deals) {
          const s = d.properties.status ?? "unknown";
          dealByStatus[s] = (dealByStatus[s] ?? 0) + 1;
          if (s === "approved") approvedArr += Number(d.properties.estimated_arr ?? 0);
        }

        let mdfRequested = 0;
        let mdfApproved = 0;
        for (const m of mdfs) {
          mdfRequested += Number(m.properties.amount_requested ?? 0);
          if (["approved", "proof_submitted", "reimbursed"].includes(m.properties.status ?? "")) {
            mdfApproved += Number(m.properties.amount_approved ?? 0);
          }
        }

        setData({
          activePartners: partners.length,
          tierCounts,
          totalMrrManaged,
          dealByStatus,
          approvedArr,
          mdfRequested,
          mdfApproved,
        });
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <LoadingSpinner label="Loading partner program data..." layout="centered" />;
  if (error || !data) return <Alert title="Error loading dashboard" variant="error">{error ?? "Unknown error"}</Alert>;

  const totalDeals = Object.values(data.dealByStatus).reduce((a, b) => a + b, 0);

  return (
    <Flex direction="column" gap="large">

      {/* KPI row */}
      <Statistics>
        <StatisticsItem label="Active Partners" number={String(data.activePartners)} />
        <StatisticsItem label="MRR Managed" number={fmt(data.totalMrrManaged)} />
        <StatisticsItem label="Approved Pipeline" number={fmt(data.approvedArr)} />
        <StatisticsItem label="MDF Approved" number={fmt(data.mdfApproved)} />
      </Statistics>

      <Divider />

      {/* Deal Registration Pipeline */}
      <Flex direction="column" gap="small">
        <Flex justify="between" align="center">
          <Heading>Deal Registration Pipeline</Heading>
          <Text variant="microcopy">{totalDeals} total</Text>
        </Flex>
        <Table bordered={false}>
          <TableHead>
            <TableRow>
              <TableHeader>Status</TableHeader>
              <TableHeader>Count</TableHeader>
              <TableHeader>% of Total</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {["submitted", "under_review", "approved", "rejected", "expired"]
              .filter((s) => (data.dealByStatus[s] ?? 0) > 0)
              .map((status) => {
                const count = data.dealByStatus[status] ?? 0;
                const pct = totalDeals > 0 ? ((count / totalDeals) * 100).toFixed(0) : "0";
                return (
                  <TableRow key={status}>
                    <TableCell>
                      <Tag variant={STATUS_VARIANT[status] ?? "default"}>
                        {status.replace(/_/g, " ")}
                      </Tag>
                    </TableCell>
                    <TableCell><Text>{String(count)}</Text></TableCell>
                    <TableCell><Text>{pct}%</Text></TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
        <Link href={`https://app.hubspot.com/contacts/${portalId}/objects/deal_registration`}>
          View all registrations →
        </Link>
      </Flex>

      <Divider />

      {/* Partner Tier Distribution */}
      <Flex direction="column" gap="small">
        <Flex justify="between" align="center">
          <Heading>Partner Tier Distribution</Heading>
          <Text variant="microcopy">{data.activePartners} active</Text>
        </Flex>
        <Table bordered={false}>
          <TableHead>
            <TableRow>
              <TableHeader>Tier</TableHeader>
              <TableHeader>Partners</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {TIER_ORDER.filter((t) => (data.tierCounts[t] ?? 0) > 0).map((tier) => (
              <TableRow key={tier}>
                <TableCell>
                  <Tag variant={TIER_VARIANT[tier]}>
                    {tier.charAt(0).toUpperCase() + tier.slice(1)}
                  </Tag>
                </TableCell>
                <TableCell><Text>{String(data.tierCounts[tier] ?? 0)}</Text></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Link href={`https://app.hubspot.com/contacts/${portalId}/objects/companies`}>
          View all partners →
        </Link>
      </Flex>

      <Divider />

      {/* MDF Overview */}
      <Flex direction="column" gap="small">
        <Heading>MDF Overview</Heading>
        <Statistics>
          <StatisticsItem label="Total Requested" number={fmt(data.mdfRequested)} />
          <StatisticsItem label="Total Approved" number={fmt(data.mdfApproved)} />
          <StatisticsItem
            label="Utilization"
            number={data.mdfRequested > 0 ? `${((data.mdfApproved / data.mdfRequested) * 100).toFixed(0)}%` : "—"}
          />
        </Statistics>
        <Link href={`https://app.hubspot.com/contacts/${portalId}/objects/mdf_request`}>
          View all MDF requests →
        </Link>
      </Flex>

    </Flex>
  );
}
