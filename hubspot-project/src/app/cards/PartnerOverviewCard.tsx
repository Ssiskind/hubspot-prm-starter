import {
  hubspot,
  Text,
  Flex,
  Tag,
  Divider,
  LoadingSpinner,
  Alert,
  Statistics,
  StatisticsItem,
} from "@hubspot/ui-extensions";
import { useCrmProperties } from "@hubspot/ui-extensions/crm";

const TIER_VARIANT: Record<string, "default" | "success" | "error" | "warning"> = {
  registered: "default",
  silver: "default",
  gold: "warning",
  platinum: "success",
};

const STATUS_VARIANT: Record<string, "default" | "success" | "error" | "warning"> = {
  active: "success",
  pending: "warning",
  inactive: "default",
  suspended: "error",
};

hubspot.extend(() => <PartnerOverviewCard />);

function PartnerOverviewCard() {
  const { isLoading, error, properties } = useCrmProperties([
    "partner_tier",
    "partner_status",
    "partner_since",
    "partner_territory",
    "partner_mrr_managed",
    "partner_certification_count",
    "mdf_balance_available",
    "microsoft_partner_id",
    "partner_type",
  ]);

  if (isLoading) return <LoadingSpinner label="Loading partner data..." />;
  if (error) return <Alert title="Error loading partner data" variant="error">{String(error)}</Alert>;

  const tier = properties.partner_tier ?? "—";
  const status = properties.partner_status ?? "—";
  const mrr = properties.partner_mrr_managed
    ? `$${Number(properties.partner_mrr_managed).toLocaleString()}`
    : "—";
  const certs = String(properties.partner_certification_count ?? "—");
  const mdfBalance = properties.mdf_balance_available
    ? `$${Number(properties.mdf_balance_available).toLocaleString()}`
    : "—";

  return (
    <Flex direction="column" gap="medium">
      <Flex justify="between" align="center">
        <Flex gap="small" align="center">
          <Text format={{ fontWeight: "bold" }}>Partner Status</Text>
          <Tag variant={STATUS_VARIANT[status] ?? "default"}>{status}</Tag>
        </Flex>
        <Tag variant={TIER_VARIANT[tier] ?? "default"}>
          {tier.charAt(0).toUpperCase() + tier.slice(1)} Tier
        </Tag>
      </Flex>

      <Divider />

      <Statistics>
        <StatisticsItem label="MRR Managed" number={mrr} />
        <StatisticsItem label="Certifications" number={certs} />
        <StatisticsItem label="MDF Balance" number={mdfBalance} />
      </Statistics>

      {(properties.partner_type || properties.partner_territory || properties.microsoft_partner_id || properties.partner_since) && (
        <>
          <Divider />
          <Flex direction="column" gap="extra-small">
            {properties.partner_type && (
              <Flex justify="between">
                <Text variant="microcopy" format={{ fontWeight: "bold" }}>Type</Text>
                <Text variant="microcopy">{String(properties.partner_type)}</Text>
              </Flex>
            )}
            {properties.partner_territory && (
              <Flex justify="between">
                <Text variant="microcopy" format={{ fontWeight: "bold" }}>Territory</Text>
                <Text variant="microcopy">{String(properties.partner_territory)}</Text>
              </Flex>
            )}
            {properties.microsoft_partner_id && (
              <Flex justify="between">
                <Text variant="microcopy" format={{ fontWeight: "bold" }}>MS Partner ID</Text>
                <Text variant="microcopy">{String(properties.microsoft_partner_id)}</Text>
              </Flex>
            )}
            {properties.partner_since && (
              <Flex justify="between">
                <Text variant="microcopy" format={{ fontWeight: "bold" }}>Partner Since</Text>
                <Text variant="microcopy">{new Date(Number(properties.partner_since)).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</Text>
              </Flex>
            )}
          </Flex>
        </>
      )}
    </Flex>
  );
}
