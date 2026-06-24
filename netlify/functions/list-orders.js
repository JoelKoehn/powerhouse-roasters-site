const { getStore, connectLambda } = require("@netlify/blobs");
const { isAuthorized, unauthorizedResponse } = require("./helpers/auth");

exports.handler = async (event) => {
  if (!isAuthorized(event)) {
    return unauthorizedResponse();
  }

  try {
    connectLambda(event);

    const store = getStore("orders");

    const listed = await store.list({ prefix: "orders/" });
    const orders = [];

    for (const blob of listed.blobs || []) {
      const raw = await store.get(blob.key);
      if (!raw) continue;

      const order = JSON.parse(raw);

      if (!order.dashboardStatus) {
        order.dashboardStatus = order.archived ? "archived" : "active";
      }

      orders.push(order);
    }

    orders.sort((a, b) => {
      const aDate = new Date(a.updatedAt || a.createdAt || 0);
      const bDate = new Date(b.updatedAt || b.createdAt || 0);
      return bDate - aDate;
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ orders })
    };
  } catch (error) {
    console.error("list-orders error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};