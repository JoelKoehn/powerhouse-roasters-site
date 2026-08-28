const { getStore, connectLambda } = require("@netlify/blobs");
const { isAuthorized, unauthorizedResponse } = require("./helpers/auth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  if (!isAuthorized(event)) return unauthorizedResponse();

  try {
    connectLambda(event);
    const { entryId } = JSON.parse(event.body || "{}");

    if (!entryId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing entryId" }) };
    }

    const store = getStore("ops");
    const [inventoryRaw, logRaw] = await Promise.all([
      store.get("inventory"),
      store.get("shelf-usage-log")
    ]);

    const inventory = inventoryRaw ? JSON.parse(inventoryRaw) : { green: {}, shelf: {} };
    const log = logRaw ? JSON.parse(logRaw) : [];

    const entry = log.find((e) => e.id === entryId);
    if (!entry) {
      return { statusCode: 404, body: JSON.stringify({ error: "Log entry not found" }) };
    }

    // Undo the deduction this entry made — deleting the record should
    // restore the shelf stock it took, not just erase the history.
    if (!inventory.shelf) inventory.shelf = {};
    inventory.shelf[entry.blend] = (Number(inventory.shelf[entry.blend]) || 0) + entry.quantity;

    const newLog = log.filter((e) => e.id !== entryId);

    await Promise.all([
      store.set("inventory", JSON.stringify(inventory, null, 2)),
      store.set("shelf-usage-log", JSON.stringify(newLog, null, 2))
    ]);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, inventory })
    };
  } catch (error) {
    console.error("delete-shelf-usage error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
