import { useState, useEffect, useRef } from "react";
import {
  hubspot,
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
  Link,
  useCrmSearch,
  useExtensionContext,
} from "@hubspot/ui-extensions";
import {
  createPageRouter,
  PageRoutes,
  PageHeader,
  PageTitle,
  PageBreadcrumbs,
} from "@hubspot/ui-extensions/pages";

// Constants shared across components
const TIER_CONFIG = [
  { value: "platinum", variant: "success" as const },
  { value: "gold", variant: "warning" as const },
  { value: "silver", variant: "default" as const },
  { value: "registered", variant: "default" as const },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatCurrencyShorthand = (value: number): string => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
};

const toNumber = (value: string | undefined | null): number => {
  if (!value) return 0;
  const cleaned = String(value).replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
};

const capitalize = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1);

const formatStatusLabel = (status: string): string =>
  status.replace(/_/g, " ");

// ─── Paginated CRM Search Hook ─────────────────────────────────────────────

interface PaginatedSearchResult {
  allResults: Array<{
    objectId: number;
    properties: Record<string, string>;
  }>;
  total: number;
  isLoading: boolean;
  error: unknown;
}

function usePaginatedCrmSearch(
  config: Parameters<typeof useCrmSearch>[0],
  options?: Parameters<typeof useCrmSearch>[1]
): PaginatedSearchResult {
  const [accumulated, setAccumulated] = useState<
    PaginatedSearchResult["allResults"]
  >([]);
  const [fetchComplete, setFetchComplete] = useState(false);
  const lastPageRef = useRef(0);

  const { results, total, isLoading, error, pagination } = useCrmSearch(
    config,
    options
  );

  useEffect(() => {
    if (isLoading) return;
    if (error) {
      setFetchComplete(true);
      return;
    }

    const currentPage = pagination?.currentPage ?? 0;

    if (currentPage !== lastPageRef.current) {
      lastPageRef.current = currentPage;
      setAccumulated((prev) =>
        currentPage === 1 ? [...results] : [...prev, ...results]
      );
    }

    if (pagination?.hasNextPage) {
      pagination.nextPage();
    } else {
      setFetchComplete(true);
    }
  }, [isLoading, error, pagination?.currentPage]);

  return {
    allResults: accumulated,
    total: total ?? 0,
    isLoading: isLoading || !fetchComplete,
    error,
  };
}

// ─── Section 1: Partners ────────────────────────────────────────────────────

function PartnersSection() {
  const ctx = useExtensionContext();
  const PORTAL_ID = String(ctx.portal.id);

  const { allResults, total, isLoading, error } = usePaginatedCrmSearch({
    objectType: "0-2",
    properties: ["partner_tier", "partner_mrr_managed"],
    filterGroups: [
      {
        filters: [
          { propertyName: "partner_status", operator: "EQ", value: "active" },
          { propertyName: "partner_tier", operator: "HAS_PROPERTY" },
        ],
      },
    ],
    pageLength: 200,
  });

  if (isLoading) return <LoadingSpinner label="Loading partners…" />;

  if (error) {
    return (
      <Alert title="Partners" variant="warning">
        Unable to load partner data. Please try again later.
      </Alert>
    );
  }

  const tierCounts: Record<string, number> = {};
  let totalMrr = 0;

  allResults.forEach((record) => {
    const tier = (record.properties.partner_tier || "").toLowerCase();
    if (tier) tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    totalMrr += toNumber(record.properties.partner_mrr_managed);
  });

  return (
    <Flex direction="column" gap="medium">
      <Heading>Partners</Heading>
      <Statistics>
        <StatisticsItem label="Active Partners" number={String(total)} />
        <StatisticsItem
          label="MRR Managed"
          number={formatCurrencyShorthand(totalMrr)}
        />
      </Statistics>
      <Table bordered={true}>
        <TableHead>
          <TableRow>
            <TableHeader>Tier</TableHeader>
            <TableHeader>Partners</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {TIER_CONFIG.map(({ value, variant }) => (
            <TableRow key={value}>
              <TableCell>
                <Tag variant={variant}>{capitalize(value)}</Tag>
              </TableCell>
              <TableCell>{tierCounts[value] || 0}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Link
        href={`https://app.hubspot.com/contacts/${PORTAL_ID}/objects/0-2/views/all/list`}
      >
        View all companies
      </Link>
    </Flex>
  );
}

// ─── Section 2: Channel Manager Performance ────────────────────────────────

interface ManagerData {
  manager: string;
  partners: number;
  mrr: number;
  tierMix: Record<string, number>;
}

function ChannelManagerSection() {
  const { allResults, isLoading, error } = usePaginatedCrmSearch({
    objectType: "0-2",
    properties: ["partner_tier", "partner_mrr_managed", "hubspot_owner_id"],
    filterGroups: [
      {
        filters: [
          { propertyName: "partner_status", operator: "EQ", value: "active" },
          { propertyName: "partner_tier", operator: "HAS_PROPERTY" },
        ],
      },
    ],
    pageLength: 200,
  });

  const {
    results: userResults,
    isLoading: usersLoading,
    error: usersError,
  } = useCrmSearch({
    objectType: "0-115",
    properties: ["hs_searchable_calculated_name", "hs_internal_user_id"],
    pageLength: 200,
  });

  if (isLoading || usersLoading)
    return <LoadingSpinner label="Loading channel manager performance…" />;

  if (error || usersError) {
    return (
      <Alert title="Channel Manager Performance" variant="warning">
        Unable to load channel manager data. Please try again later.
      </Alert>
    );
  }

  const ownerNameMap: Record<string, string> = {};
  userResults.forEach((user) => {
    const name = user.properties.hs_searchable_calculated_name;
    if (name) {
      ownerNameMap[String(user.objectId)] = name;
      const internalId = user.properties.hs_internal_user_id;
      if (internalId) {
        ownerNameMap[internalId] = name;
      }
    }
  });

  const managerMap: Record<string, ManagerData> = {};

  allResults.forEach((record) => {
    const ownerId = record.properties.hubspot_owner_id || "";
    const resolvedName = ownerId ? ownerNameMap[ownerId] : undefined;
    if (ownerId && !resolvedName) return; // skip unresolved owner IDs
    const owner = resolvedName ?? "Unassigned";
    const tier = (record.properties.partner_tier || "").toLowerCase();
    const mrr = toNumber(record.properties.partner_mrr_managed);

    if (!managerMap[owner]) {
      managerMap[owner] = { manager: owner, partners: 0, mrr: 0, tierMix: {} };
    }
    managerMap[owner].partners += 1;
    managerMap[owner].mrr += mrr;
    if (tier)
      managerMap[owner].tierMix[tier] =
        (managerMap[owner].tierMix[tier] || 0) + 1;
  });

  const managers = Object.values(managerMap).sort((a, b) => b.mrr - a.mrr);

  const formatTierMix = (tierMix: Record<string, number>): string => {
    const order = ["platinum", "gold", "silver", "registered"];
    const parts: string[] = [];
    order.forEach((tier) => {
      if (tierMix[tier]) parts.push(`${tierMix[tier]} ${capitalize(tier)}`);
    });
    Object.keys(tierMix).forEach((tier) => {
      if (!order.includes(tier))
        parts.push(`${tierMix[tier]} ${capitalize(tier)}`);
    });
    return parts.length > 0 ? parts.join(", ") : "—";
  };

  return (
    <Flex direction="column" gap="medium">
      <Heading>Channel Manager Performance</Heading>
      <Table bordered={true}>
        <TableHead>
          <TableRow>
            <TableHeader>Manager</TableHeader>
            <TableHeader>Partners</TableHeader>
            <TableHeader>MRR Managed</TableHeader>
            <TableHeader>Tier Mix</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {managers.length === 0 ? (
            <TableRow>
              <TableCell>No channel manager data available</TableCell>
              <TableCell>—</TableCell>
              <TableCell>—</TableCell>
              <TableCell>—</TableCell>
            </TableRow>
          ) : (
            managers.map((m) => (
              <TableRow key={m.manager}>
                <TableCell>{m.manager}</TableCell>
                <TableCell>{m.partners}</TableCell>
                <TableCell>{formatCurrencyShorthand(m.mrr)}</TableCell>
                <TableCell>{formatTierMix(m.tierMix)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Flex>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

function PrmDashboard() {
  return (
    <>
      <PageBreadcrumbs>
        <PageBreadcrumbs.Current>
          Partner Program Overview
        </PageBreadcrumbs.Current>
      </PageBreadcrumbs>
      <PageTitle>Partner Program Overview</PageTitle>

      <Flex direction="column" gap="medium">
        <PartnersSection />
        <Divider />
        <ChannelManagerSection />
      </Flex>
    </>
  );
}

// ─── Router + Registration ──────────────────────────────────────────────────

const PageRouter = createPageRouter(
  <PageRoutes>
    <PageRoutes.IndexRoute component={PrmDashboard} />
  </PageRoutes>
);

hubspot.extend<"pages">(() => <PageRouter />);
