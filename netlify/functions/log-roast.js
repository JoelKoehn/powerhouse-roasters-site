const { getStore, connectLambda } = require("@netlify/blobs");
const { isAuthorized, unauthorizedResponse } = require("./helpers/auth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  if (!isAuthorized(event)) return unauthorizedResponse();

  try {
    connectLambda(event);
    const body = JSON.parse(event.body || "{}");
    const { blend, lbsRoasted, bagsFilled, date, roastType, orderId, notes } = body;

    if (!blend || !lbsRoasted || lbsRoasted <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "blend and lbsRoasted required" }) };
    }
    if (roastType === "shelf" && (!bagsFilled || bagsFilled <= 0)) {
      return { statusCode: 400, body: JSON.stringify({ error: "bagsFilled required for shelf roasts" }) };
    }
    if (!["shelf", "order"].includes(roastType)) {
      return { statusCode: 400, body: JSON.stringify({ error: "roastType must be shelf or order" }) };
    }

    const store = getStore("ops");
    const [blendsRaw, inventoryRaw, logRaw] = await Promise.all([
      store.get("blends").catch(() => null),
      store.get("inventory").catch(() => null),
      store.get("roast-log").catch(() => null)
    ]);

    const blends = blendsRaw ? JSON.parse(blendsRaw) : {};
    const inventory = inventoryRaw ? JSON.parse(inventoryRaw) : { green: {}, shelf: {} };
    const roastLog = logRaw ? JSON.parse(logRaw) : [];

    const formula = blends[blend];
    if (!formula) {
      return { statusCode: 400, body: JSON.stringify({ error: `No formula found for blend "${blend}"` }) };
    }

    // Calculate green bean usage from formula percentages
    const greenUsed = {};
    for (const [origin, pct] of Object.entries(formula)) {
      greenUsed[origin] = parseFloat(((Number(pct) / 100) * lbsRoasted).toFixed(2));
    }

    // Check green inventory sufficiency
    for (const [origin, lbs] of Object.entries(greenUsed)) {
      const available = inventory.green[origin] || 0;
      if (available < lbs) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: `Insufficient green beans: need ${lbs} lbs of ${origin}, have ${available} lbs`
          })
        };
      }
    }

    // Deduct green beans
    for (const [origin, lbs] of Object.entries(greenUsed)) {
      inventory.green[origin] = parseFloat(((inventory.green[origin] || 0) - lbs).toFixed(2));
    }

    // For shelf roast: add bags to shelf inventory
    if (roastType === "shelf") {
      if (!inventory.shelf[blend]) inventory.shelf[blend] = 0;
      inventory.shelf[blend] = Math.round(inventory.shelf[blend] + Number(bagsFilled));
    }

    const session = {
      id: `roast_${Date.now()}`,
      blend,
      lbsRoasted: Number(lbsRoasted),
      bagsFilled: roastType === "shelf" ? Number(bagsFilled) : null,
      date: date || new Date().toISOString().split("T")[0],
      roastType,
      orderId: orderId || null,
      greenUsed,
      notes: notes || "",
      createdAt: new Date().toISOString()
    };

    roastLog.unshift(session);

    await Promise.all([
      store.set("inventory", JSON.stringify(inventory, null, 2)),
      store.set("roast-log", JSON.stringify(roastLog, null, 2))
    ]);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, session, inventory })
    };
  } catch (error) {
    console.error("log-roast error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
