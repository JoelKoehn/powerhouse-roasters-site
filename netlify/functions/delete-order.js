const { getStore, connectLambda } = require("@netlify/blobs");
const { isAuthorized, unauthorizedResponse } = require("./helpers/auth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!isAuthorized(event)) return unauthorizedResponse();

  try {
    connectLambda(event);

    const { orderId } = JSON.parse(event.body || "{}");

    if (!orderId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing orderId" }) };
    }

    const store = getStore("orders");
    const key = `orders/${orderId}.json`;
    const raw = await store.get(key);

    if (!raw) {
      return { statusCode: 404, body: JSON.stringify({ error: "Order not found" }) };
    }

    const order = JSON.parse(raw);

    if (order.source !== "Manual") {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "This order came from a real Stripe payment and can't be permanently deleted — archive it instead to keep the payment record."
        })
      };
    }

    await store.delete(key);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true })
    };
  } catch (error) {
    console.error("delete-order error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
