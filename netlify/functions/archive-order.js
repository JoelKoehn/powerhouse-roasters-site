const { getStore, connectLambda } = require("@netlify/blobs");
const { isAuthorized, unauthorizedResponse } = require("./helpers/auth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  if (!isAuthorized(event)) {
    return unauthorizedResponse();
  }

  try {
    connectLambda(event);

    const { orderId } = JSON.parse(event.body || "{}");

    if (!orderId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing orderId" })
      };
    }

    const store = getStore("orders");

    const key = `orders/${orderId}.json`;
    const raw = await store.get(key);

    if (!raw) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Order not found" })
      };
    }

    const order = JSON.parse(raw);
    const now = new Date().toISOString();

    order.dashboardStatus = "archived";
    order.archived = true;
    order.archivedAt = now;
    order.updatedAt = now;

    await store.set(key, JSON.stringify(order, null, 2));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ order })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};