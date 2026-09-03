// Callable from the PRM dashboard extension to get pipeline stage → status label mapping.
// The stage IDs are portal-specific numeric strings; this function normalizes them
// to the snake_case labels used throughout the extension (e.g. "under_review").
const axios = require("axios");

exports.main = async (context, sendResponse) => {
  const token = process.env.PRIVATE_APP_ACCESS_TOKEN;
  const objectTypeId = process.env.HUBSPOT_DEAL_REG_OBJECT_TYPE_ID;

  try {
    const res = await axios.get(
      `https://api.hubapi.com/crm/v3/pipelines/${objectTypeId}`,
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
    );

    const pipeline = res.data.results?.[0];
    const stageIdToStatus = {};

    if (pipeline) {
      for (const stage of pipeline.stages) {
        const key = stage.label.toLowerCase().replace(/\s+/g, "_");
        stageIdToStatus[stage.id] = key;
      }
    }

    sendResponse({ stageIdToStatus });
  } catch (err) {
    sendResponse({ stageIdToStatus: {}, error: String(err.message) });
  }
};
