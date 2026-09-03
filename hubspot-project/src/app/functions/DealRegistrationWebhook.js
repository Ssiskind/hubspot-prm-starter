// Webhook handler: deal_registration hs_pipeline_stage → approved triggers Deal creation
const axios = require("axios");

let _approvedStageId = null;

async function getApprovedStageId() {
  if (_approvedStageId !== null) return _approvedStageId;
  const token = process.env.PRIVATE_APP_ACCESS_TOKEN;
  const objectTypeId = process.env.HUBSPOT_DEAL_REG_OBJECT_TYPE_ID;
  const res = await axios.get(
    `https://api.hubapi.com/crm/v3/pipelines/${objectTypeId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const stages = res.data.results?.[0]?.stages ?? [];
  const match = stages.find((s) => s.label.toLowerCase() === "approved");
  _approvedStageId = match?.id ?? null;
  return _approvedStageId;
}

exports.main = async (context) => {
  const { body } = context;
  const events = Array.isArray(body) ? body : [body];

  const approvedStageId = await getApprovedStageId();

  const results = await Promise.all(
    events.map(async (event) => {
      if (
        event.subscriptionType === "object.propertyChange" &&
        event.propertyName === "hs_pipeline_stage" &&
        approvedStageId &&
        event.propertyValue === approvedStageId
      ) {
        return handleDealRegistrationApproved(event.objectId, context);
      }
      return { skipped: true, eventType: event.subscriptionType };
    })
  );

  return { statusCode: 200, body: JSON.stringify({ processed: results.length }) };
};

async function handleDealRegistrationApproved(registrationId, context) {
  const token = process.env.PRIVATE_APP_ACCESS_TOKEN;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Fetch the registration details
  const regRes = await axios.get(
    `https://api.hubapi.com/crm/v3/objects/deal_registration/${registrationId}?properties=registration_name,end_customer_name,estimated_arr,product_sku,deal_channel_type,approved_discount_pct,sub_partner_name`,
    { headers }
  );
  const reg = regRes.data;

  // Create a deal from the approved registration
  const dealRes = await axios.post(
    "https://api.hubapi.com/crm/v3/objects/deals",
    {
      properties: {
        dealname: `[Partner] ${reg.properties.end_customer_name} – ${reg.properties.product_sku}`,
        dealtype: "newbusiness",
        amount: reg.properties.estimated_arr,
        partner_sourced: "true",
        deal_channel_type: reg.properties.deal_channel_type ?? "resell",
        deal_registration_id: registrationId,
        partner_discount_pct: reg.properties.approved_discount_pct ?? "0",
        closedate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      },
    },
    { headers }
  );

  // Associate the new deal with the registration
  await axios.put(
    `https://api.hubapi.com/crm/v4/objects/deal_registration/${registrationId}/associations/deals/${dealRes.data.id}`,
    [{ associationCategory: "USER_DEFINED", associationTypeId: 1 }],
    { headers }
  );

  return { dealId: dealRes.data.id, registrationId };
}
