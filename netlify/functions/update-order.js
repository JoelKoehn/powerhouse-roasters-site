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

    const {
      orderId,
      fulfillmentStatus,
      shippingStatus,
      trackingNumber,
      notes,
      dashboardStatus
    } = JSON.parse(event.body || "{}");

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

    if (typeof fulfillmentStatus === "string") {
      order.fulfillmentStatus = fulfillmentStatus;
    }

    if (typeof shippingStatus === "string") {
      order.shippingStatus = shippingStatus;
    }

    if (typeof trackingNumber === "string") {
      order.trackingNumber = trackingNumber;
    }

    if (typeof notes === "string") {
      order.notes = notes;
    }

    if (typeof dashboardStatus === "string") {
      order.dashboardStatus = dashboardStatus;
      order.archived = dashboardStatus === "archived";

      if (dashboardStatus === "archived") {
        order.archivedAt = new Date().toISOString();
      }
    }

    order.updatedAt = new Date().toISOString();

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