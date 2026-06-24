const { getStore, connectLambda } = require("@netlify/blobs");
const { isAuthorized, unauthorizedResponse } = require("./helpers/auth");

const DEFAULT_BLENDS = {
  "Full Power Dark": { "Brazil": 60, "Guatemala": 40 },
  "Range Line Roast": { "Brazil": 50, "Guatemala": 30, "Ethiopia": 20 },
  "Brazil": { "Brazil": 100 },
  "Guatemala": { "Guatemala": 100 },
  "Ethiopia": { "Ethiopia": 100 },
  "Stillwater Decaf": { "Decaf Colombia": 100 }
};

const DEFAULT_INVENTORY = {
  green: {
    "Brazil": 0,
    "Guatemala": 0,
    "Ethiopia": 0,
    "Decaf Colombia": 0,
    "Colombia": 0
  },
  shelf: {
    "Full Power Dark": 0,
    "Range Line Roast": 0,
    "Brazil": 0,
    "Guatemala": 0,
    "Ethiopia": 0,
    "Stillwater Decaf": 0
  }
};

exports.handler = async (event) => {
  if (!isAuthorized(event)) return unauthorizedResponse();

  try {
    connectLambda(event);
    const store = getStore("ops");

    const [blendsRaw, inventoryRaw, roastLogRaw] = await Promise.all([
      store.get("blends").catch(() => null),
      store.get("inventory").catch(() => null),
      store.get("roast-log").catch(() => null)
    ]);

    const blends = blendsRaw ? JSON.parse(blendsRaw) : DEFAULT_BLENDS;
    const inventory = inventoryRaw ? JSON.parse(inventoryRaw) : DEFAULT_INVENTORY;
    const roastLog = roastLogRaw ? JSON.parse(roastLogRaw) : [];

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blends, inventory, roastLog })
    };
  } catch (error) {
    console.error("get-ops-data error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
