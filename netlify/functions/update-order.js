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
      dashboardStatus,
      customer,
      orderType,
      paymentMethod,
      paymentStatus,
      items
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

    if (customer && typeof customer === "object") {
      order.customer = {
        name: typeof customer.name === "string" ? customer.name : order.customer.name,
        email: typeof customer.email === "string" ? customer.email : order.customer.email
      };
    }

    if (typeof orderType === "string") order.orderType = orderType;
    if (typeof paymentMethod === "string") order.paymentMethod = paymentMethod;
    if (typeof paymentStatus === "string") order.paymentStatus = paymentStatus;

    if (Array.isArray(items) && items.length > 0) {
      if (order.source !== "Manual") {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "Items can't be edited on this order — it came from a real Stripe payment and items must match what was actually charged."
          })
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

      const previousRoasted = {};
      (order.roastNeeded || []).forEach((line) => {
        previousRoasted[line.name] = line.roasted || 0;
      });

      const roastMap = {};
      normalizedItems.forEach((item) => {
        roastMap[item.name] = (roastMap[item.name] || 0) + item.quantity;
      });

      order.roastNeeded = Object.entries(roastMap).map(([name, quantity]) => ({
        name,
        quantity,
        roasted: Math.min(quantity, previousRoasted[name] || 0)
      }));

      order.items = normalizedItems;
      order.amountTotal = normalizedItems.reduce((sum, item) => sum + item.amount_total, 0);

      const allFulfilled = order.roastNeeded.every((line) => line.roasted >= line.quantity);
      if (!allFulfilled && order.fulfillmentStatus === "Roasted") {
        order.fulfillmentStatus = "Needs Roast";
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