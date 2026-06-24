const { getStore, connectLambda } = require("@netlify/blobs");
const { isAuthorized, unauthorizedResponse } = require("./helpers/auth");

function summarizeRoastNeeded(items) {
  const map = {};

  for (const item of items) {
    if (!map[item.name]) {
      map[item.name] = 0;
    }
    map[item.name] += Number(item.quantity || 0);
  }

  return Object.entries(map).map(([name, quantity]) => ({
    name,
    quantity
  }));
}

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

    const body = JSON.parse(event.body || "{}");

    const {
      customer,
      items = [],
      source = "Manual",
      orderType = "Retail",
      paymentMethod = "cash",
      paymentStatus = "paid",
      fulfillmentStatus = "Needs Roast",
      shippingStatus = "Unfulfilled",
      dashboardStatus = "active",
      notes = "",
      trackingNumber = "",
      shippingAddress = {
        line1: "",
        line2: "",
        city: "",
        state: "",
        postal_code: "",
        country: "US"
      }
    } = body;

    if (!customer || !customer.name) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing customer name" })
      };
    }

    if (!Array.isArray(items) || items.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Cart is empty" })
      };
    }

    const normalizedItems = items.map((item) => {
      const quantity = Number(item.quantity || 0);
      const unitAmount = Number(item.unit_amount || 0);

      if (!item.name || !Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Invalid item data");
      }

      return {
        name: item.name,
        quantity,
        unit_amount: unitAmount,
        amount_total: unitAmount * quantity,
        currency: "usd"
      };
    });

    const amountTotal = normalizedItems.reduce(
      (sum, item) => sum + item.amount_total,
      0
    );

    const now = new Date().toISOString();
    const orderId = `manual_${Date.now()}`;

    const order = {
      id: orderId,
      source,
      orderType,
      paymentMethod,
      paymentStatus,
      fulfillmentStatus,
      shippingStatus,
      dashboardStatus,
      createdAt: now,
      updatedAt: now,
      amountTotal,
      currency: "usd",
      customer: {
        name: customer.name || "",
        email: customer.email || ""
      },
      shippingAddress: {
        line1: shippingAddress.line1 || "",
        line2: shippingAddress.line2 || "",
        city: shippingAddress.city || "",
        state: shippingAddress.state || "",
        postal_code: shippingAddress.postal_code || "",
        country: shippingAddress.country || ""
      },
      items: normalizedItems,
      roastNeeded: summarizeRoastNeeded(normalizedItems),
      notes,
      trackingNumber,
      archived: false
    };

    const store = getStore("orders");

    await store.set(`orders/${order.id}.json`, JSON.stringify(order, null, 2));

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