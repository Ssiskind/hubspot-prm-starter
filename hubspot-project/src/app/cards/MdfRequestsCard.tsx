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

// Dynamically build custom object type ID from portal (format: p{portalId}_mdf_request)
const PROPS = ["request_name", "campaign_type", "amount_requested", "amount_approved", "status", "program_source"];

const STATUS_VARIANT: Record<string, "default" | "success" | "error" | "warning"> = {
  submitted: "default",
  under_review: "warning",
  approved: "success",
  proof_submitted: "warning",
  reimbursed: "success",
  rejected: "error",
};

type MdfRequest = {
  id: string;
  properties: {
    request_name?: string;
    campaign_type?: string;
    amount_requested?: string;
    amount_approved?: string;
    status?: string;
    program_source?: string;
  };
};

hubspot.extend(({ actions }) => <MdfRequestsCard actions={actions} />);

function MdfRequestsCard({ actions }: { actions: ReturnType<typeof useExtensionActions> }) {
  const ctx = useExtensionContext<"crm.record.tab">();
  const [requests, setRequests] = useState<MdfRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const companyId = ctx.crm?.objectId;
  const portalId = String(ctx.portal.id);
  const OBJ_TYPE = `p${portalId}_mdf_request`;

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }

    async function load() {
      // Step 1: get associated record IDs
      const assocRes = await hubspot.fetch(
        `https://api.hubapi.com/crm/v4/objects/companies/${companyId}/associations/${OBJ_TYPE}`
      );
      const assocText = await assocRes.text();
      if (!assocText || !assocRes.ok) { setRequests([]); setLoading(false); return; }
      const assocData = JSON.parse(assocText) as { results?: { toObjectId: string }[] };
      const ids = (assocData.results ?? []).map((r) => r.toObjectId);

      if (ids.length === 0) { setRequests([]); setLoading(false); return; }

      // Step 2: batch read the records
      const batchRes = await hubspot.fetch(`https://api.hubapi.com/crm/v3/objects/${OBJ_TYPE}/batch/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: ids.map((id) => ({ id })), properties: PROPS }),
      });
      const batchText = await batchRes.text();
      if (!batchText || !batchRes.ok) throw new Error(`Batch read failed (${batchRes.status})`);
      const batchData = JSON.parse(batchText) as { results?: MdfRequest[] };
      setRequests(batchData.results ?? []);
      setLoading(false);
    }

    load().catch((err: Error) => { setError(err.message); setLoading(false); });
  }, [companyId]);

  if (loading) return <LoadingSpinner label="Loading MDF requests..." />;
  if (error) return <Alert title="Error loading MDF requests" variant="error">{error}</Alert>;

  const totalRequested = requests.reduce((sum, r) => sum + Number(r.properties.amount_requested ?? 0), 0);
  const totalApproved = requests.reduce((sum, r) => sum + Number(r.properties.amount_approved ?? 0), 0);

  return (
    <Flex direction="column" gap="medium">
      <Flex justify="between" align="center">
        <Text format={{ fontWeight: "bold" }}>MDF Requests</Text>
        <Text variant="microcopy">{requests.length} request{requests.length !== 1 ? "s" : ""}</Text>
      </Flex>

      {requests.length === 0 ? (
        <EmptyState title="No MDF requests" flush={false} layout="vertical">
          <Text>No Market Development Fund requests have been submitted for this partner.</Text>
          <Button
            onClick={() =>
              actions.openIframeModal({
                uri: `https://app.hubspot.com/contacts/${PORTAL}/objects/${OBJ_TYPE}`,
                height: 600,
                width: 1000,
                title: "MDF Requests",
              })
            }
          >
            View in CRM
          </Button>
        </EmptyState>
      ) : (
        <>
          <Table bordered={true}>
            <TableHead>
              <TableRow>
                <TableHeader>Campaign</TableHeader>
                <TableHeader>Requested</TableHeader>
                <TableHeader>Approved</TableHeader>
                <TableHeader>Status</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Text>{r.properties.request_name ?? r.properties.campaign_type ?? "—"}</Text>
                    {r.properties.program_source === "microsoft_co_op" && (
                      <Text variant="microcopy">Microsoft Co-op</Text>
                    )}
                  </TableCell>
                  <TableCell>
                    <Text>
                      {r.properties.amount_requested
                        ? `$${Number(r.properties.amount_requested).toLocaleString()}`
                        : "—"}
                    </Text>
                  </TableCell>
                  <TableCell>
                    <Text>
                      {r.properties.amount_approved && Number(r.properties.amount_approved) > 0
                        ? `$${Number(r.properties.amount_approved).toLocaleString()}`
                        : "—"}
                    </Text>
                  </TableCell>
                  <TableCell>
                    <Tag variant={STATUS_VARIANT[r.properties.status ?? ""] ?? "default"}>
                      {(r.properties.status ?? "").replace(/_/g, " ")}
                    </Tag>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalRequested > 0 && (
            <Text variant="microcopy">
              Total: ${totalRequested.toLocaleString()} requested · ${totalApproved.toLocaleString()} approved
            </Text>
          )}
        </>
      )}

      <Divider />
      <Link href={`https://app.hubspot.com/contacts/${PORTAL}/objects/${OBJ_TYPE}`}>
        View all in CRM →
      </Link>
    </Flex>
  );
}
