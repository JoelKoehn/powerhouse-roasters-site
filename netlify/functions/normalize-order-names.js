// ONE-TIME MIGRATION — run once locally against production via netlify dev,
// verify results, then delete this file. Only ever touches item/roastNeeded
// "name" strings — never quantity, price, payment status, or any other field.
const { getStore, connectLambda } = require("@netlify/blobs");
const { isAuthorized, unauthorizedResponse } = require("./helpers/auth");

const CANONICAL_BLENDS = [
  "Full Power Dark", "Range Line Roast", "Brazil", "Guatemala", "Ethiopia", "Stillwater Decaf"
];

function normalizeName(name) {
  if (typeof name !== "string") return name;
  const trimmed = name.trim();

  for (const blend of CANONICAL_BLENDS) {
    if (trimmed === blend) return blend;
    if (trimmed.startsWith(blend)) {
      const rest = trimmed.slice(blend.length);
      if (/^\s*[-•—]/.test(rest)) {
        return blend;
      }
    }
  }
  return trimmed;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  if (!isAuthorized(event)) return unauthorizedResponse();

  try {
    connectLambda(event);
    const store = getStore("orders");
    const listed = await store.list({ prefix: "orders/" });

    const changes = [];

    for (const blob of listed.blobs || []) {
      const raw = await store.get(blob.key);
      if (!raw) continue;
      const order = JSON.parse(raw);
      let changed = false;
      const itemChanges = [];

      (order.items || []).forEach((item) => {
        const newName = normalizeName(item.name);
        if (newName !== item.name) {
          itemChanges.push({ from: item.name, to: newName });
          item.name = newName;
          changed = true;
        }
      });

      (order.roastNeeded || []).forEach((line) => {
        const newName = normalizeName(line.name);
        if (newName !== line.name) {
          line.name = newName;
          changed = true;
        }
      });

      if (changed && order.roastNeeded && order.roastNeeded.length > 1) {
        const merged = {};
        order.roastNeeded.forEach((line) => {
          if (!merged[line.name]) {
            merged[line.name] = { name: line.name, quantity: 0, roasted: 0 };
          }
          merged[line.name].quantity += line.quantity;
          merged[line.name].roasted += (line.roasted || 0);
        });
        order.roastNeeded = Object.values(merged);
      }

      if (changed) {
        order.updatedAt = new Date().toISOString();
        await store.set(blob.key, JSON.stringify(order, null, 2));
        changes.push({ orderId: order.id, itemChanges });
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, ordersChanged: changes.length, changes })
    };
  } catch (error) {
    console.error("normalize-order-names error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
