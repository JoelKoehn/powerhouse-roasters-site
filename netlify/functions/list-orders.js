const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event) => {
  const adminKey =
    event.headers["x-admin-key"] || event.headers["X-Admin-Key"];

  if (
    !process.env.ADMIN_DASHBOARD_KEY ||
    adminKey !== process.env.ADMIN_DASHBOARD_KEY
  ) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Unauthorized" })
    };
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