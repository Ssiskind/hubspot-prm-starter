// Workflow action: recalculate partner tier based on YTD revenue
const axios = require("axios");

exports.main = async (context) => {
  const { inputFields, object } = context;
  const token = process.env.PRIVATE_APP_ACCESS_TOKEN;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const silverThreshold = Number(inputFields.silver_revenue_threshold ?? 50000);
  const goldThreshold = Number(inputFields.gold_revenue_threshold ?? 200000);
  const platinumThreshold = Number(inputFields.platinum_revenue_threshold ?? 500000);

  const companyId = object.objectId;

  // Fetch current YTD revenue from the company record
  const companyRes = await axios.get(
    `https://api.hubapi.com/crm/v3/objects/companies/${companyId}?properties=partner_mrr_managed,partner_certification_count,partner_tier`,
    { headers }
  );
  const props = companyRes.data.properties;

  const ytdRevenue = Number(props.partner_mrr_managed ?? 0) * 12;
  const certCount = Number(props.partner_certification_count ?? 0);

  let newTier = "registered";
  if (ytdRevenue >= platinumThreshold && certCount >= 3) {
    newTier = "platinum";
  } else if (ytdRevenue >= goldThreshold && certCount >= 2) {
    newTier = "gold";
  } else if (ytdRevenue >= silverThreshold && certCount >= 1) {
    newTier = "silver";
  }

  // Update partner_tier if it changed
  if (newTier !== props.partner_tier) {
    await axios.patch(
      `https://api.hubapi.com/crm/v3/objects/companies/${companyId}`,
      { properties: { partner_tier: newTier } },
      { headers }
    );
  }

  return {
    outputFields: { new_tier: newTier },
  };
};
