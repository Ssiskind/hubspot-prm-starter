import {
  hubspot,
  Text,
  Flex,
  Tag,
  Divider,
  LoadingSpinner,
  EmptyState,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Link,
  Button,
} from "@hubspot/ui-extensions";
import { useExtensionContext, useExtensionActions } from "@hubspot/ui-extensions";
import { useState, useEffect } from "react";

// Dynamically build custom object type ID from portal (format: p{portalId}_deal_registration)
const PROPS = ["registration_name", "status", "end_customer_name", "estimated_arr", "expiry_date", "deal_channel_type"];

const STATUS_VARIANT: Record<string, "default" | "success" | "error" | "warning"> = {
  submitted: "default",
  under_review: "warning",
  approved: "success",
  rejected: "error",
  expired: "default",
};

type DealReg = {
  id: string;
  properties: {
    registration_name?: string;
    status?: string;
    end_customer_name?: string;
    estimated_arr?: string;
    expiry_date?: string;
    deal_channel_type?: string;
  };
};

hubspot.extend(({ actions }) => <DealRegistrationsCard actions={actions} />);

function DealRegistrationsCard({ actions }: { actions: ReturnType<typeof useExtensionActions> }) {
  const ctx = useExtensionContext<"crm.record.tab">();
  const [registrations, setRegistrations] = useState<DealReg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const companyId = ctx.crm?.objectId;
  const portalId = String(ctx.portal.id);
  const OBJ_TYPE = `p${portalId}_deal_registration`;

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }

    async function load() {
      // Step 1: get associated record IDs
      const assocRes = await hubspot.fetch(
        `https://api.hubapi.com/crm/v4/objects/companies/${companyId}/associations/${OBJ_TYPE}`
      );
      const assocText = await assocRes.text();
      if (!assocText || !assocRes.ok) { setRegistrations([]); setLoading(false); return; }
      const assocData = JSON.parse(assocText) as { results?: { toObjectId: string }[] };
      const ids = (assocData.results ?? []).map((r) => r.toObjectId);

      if (ids.length === 0) { setRegistrations([]); setLoading(false); return; }

      // Step 2: batch read the records
      const batchRes = await hubspot.fetch(`https://api.hubapi.com/crm/v3/objects/${OBJ_TYPE}/batch/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: ids.map((id) => ({ id })), properties: PROPS }),
      });
      const batchText = await batchRes.text();
      if (!batchText || !batchRes.ok) throw new Error(`Batch read failed (${batchRes.status})`);
      const batchData = JSON.parse(batchText) as { results?: DealReg[] };
      setRegistrations(batchData.results ?? []);
      setLoading(false);
    }

    load().catch((err: Error) => { setError(err.message); setLoading(false); });
  }, [companyId]);

  if (loading) return <LoadingSpinner label="Loading registrations..." />;
  if (error) return <Alert title="Error loading deal registrations" variant="error">{error}</Alert>;

  return (
    <Flex direction="column" gap="medium">
      <Flex justify="between" align="center">
        <Text format={{ fontWeight: "bold" }}>Deal Registrations</Text>
        <Text variant="microcopy">{registrations.length} registration{registrations.length !== 1 ? "s" : ""}</Text>
      </Flex>

      {registrations.length === 0 ? (
        <EmptyState title="No deal registrations" flush={false} layout="vertical">
          <Text>No registrations have been submitted for this partner yet.</Text>
          <Button
            onClick={() =>
              actions.openIframeModal({
                uri: `https://app.hubspot.com/contacts/${PORTAL}/objects/${OBJ_TYPE}`,
                height: 600,
                width: 1000,
                title: "Deal Registrations",
              })
            }
          >
            View in CRM
          </Button>
        </EmptyState>
      ) : (
        <Table bordered={true}>
          <TableHead>
            <TableRow>
              <TableHeader>End Customer</TableHeader>
              <TableHeader>ARR</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Expires</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {registrations.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Text>{r.properties.end_customer_name ?? r.properties.registration_name ?? "—"}</Text>
                </TableCell>
                <TableCell>
                  <Text>
                    {r.properties.estimated_arr
                      ? `$${Number(r.properties.estimated_arr).toLocaleString()}`
                      : "—"}
                  </Text>
                </TableCell>
                <TableCell>
                  <Tag variant={STATUS_VARIANT[r.properties.status ?? ""] ?? "default"}>
                    {(r.properties.status ?? "").replace(/_/g, " ")}
                  </Tag>
                </TableCell>
                <TableCell>
                  <Text>{r.properties.expiry_date ?? "—"}</Text>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Divider />
      <Link href={`https://app.hubspot.com/contacts/${PORTAL}/objects/${OBJ_TYPE}`}>
        View all in CRM →
      </Link>
    </Flex>
  );
}
