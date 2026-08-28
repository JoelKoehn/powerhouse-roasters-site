const { getStore, connectLambda } = require("@netlify/blobs");
const { isAuthorized, unauthorizedResponse } = require("./helpers/auth");

const REASONS = ["family", "hay-customer"];

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  if (!isAuthorized(event)) return unauthorizedResponse();

  try {
    connectLambda(event);

    const { blend, quantity, reason, notes } = JSON.parse(event.body || "{}");
    const qty = Number(quantity);

    if (!blend || !Number.isFinite(qty) || qty <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Blend and a positive quantity are required" }) };
    }
    if (!REASONS.includes(reason)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Reason must be family or hay-customer" }) };
    }

    const store = getStore("ops");
    const [inventoryRaw, logRaw] = await Promise.all([
      store.get("inventory"),
      store.get("shelf-usage-log")
    ]);

    const inventory = inventoryRaw ? JSON.parse(inventoryRaw) : { green: {}, shelf: {} };
    if (!inventory.shelf) inventory.shelf = {};

    const current = Number(inventory.shelf[blend]) || 0;
    if (current < qty) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Only ${current} bags of ${blend} on the shelf — can't log ${qty}.` })
      };
    }

    inventory.shelf[blend] = current - qty;

    const log = logRaw ? JSON.parse(logRaw) : [];
    const entry = {
      id: `su_${Date.now()}`,
      date: new Date().toISOString(),
      blend,
      quantity: qty,
      reason,
      notes: typeof notes === "string" ? notes : ""
    };
    log.unshift(entry);

    await Promise.all([
      store.set("inventory", JSON.stringify(inventory, null, 2)),
      store.set("shelf-usage-log", JSON.stringify(log, null, 2))
    ]);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, entry, inventory })
    };
  } catch (error) {
    console.error("log-shelf-usage error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
