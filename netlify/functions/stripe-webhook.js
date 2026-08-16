const Stripe = require("stripe");
const { getStore, connectLambda } = require("@netlify/blobs");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function summarizeRoastNeeded(items) {
  const map = {};

  for (const item of items) {
    if (!map[item.name]) {
      map[item.name] = 0;
    }
    map[item.name] += item.quantity;
  }

  return Object.entries(map).map(([name, quantity]) => ({
    name,
    quantity,
    roasted: 0
  }));
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method not allowed"
    };
  }

  try {
    connectLambda(event);

    const signature =
      event.headers["stripe-signature"] ||
      event.headers["Stripe-Signature"];

    if (!signature) {
      return {
        statusCode: 400,
        body: "Missing Stripe signature"
      };
    }

    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;

    const stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;

      const lineItemsResponse = await stripe.checkout.sessions.listLineItems(
        session.id,
        { limit: 100 }
      );

      const items = lineItemsResponse.data.map((line) => ({
        name: line.description,
        quantity: line.quantity,
        amount_total: line.amount_total,
        currency: line.currency
      }));

      const now = new Date().toISOString();

      const order = {
        id: `ord_${session.id}`,
        source: "Retail",
        stripeSessionId: session.id,
        paymentStatus: session.payment_status || "paid",
        fulfillmentStatus: "Needs Roast",
        shippingStatus: "Unfulfilled",
        dashboardStatus: "active", // ✅ NEW FIELD
        createdAt: now,
        updatedAt: now,
        amountTotal: session.amount_total || 0,
        currency: session.currency || "usd",
        customer: {
          name: session.customer_details?.name || "",
          email: session.customer_details?.email || ""
        },
        shippingAddress: {
          line1: session.customer_details?.address?.line1 || "",
          line2: session.customer_details?.address?.line2 || "",
          city: session.customer_details?.address?.city || "",
          state: session.customer_details?.address?.state || "",
          postal_code: session.customer_details?.address?.postal_code || "",
          country: session.customer_details?.address?.country || ""
        },
        items,
        roastNeeded: summarizeRoastNeeded(items),
        notes: "",
        trackingNumber: ""
      };

      const state = order.shippingAddress.state?.toUpperCase();
      const isUnsupportedState = ["AK", "HI"].includes(state);

      if (isUnsupportedState) {
        order.fulfillmentStatus = "DO NOT FULFILL";
        order.notes = `Unsupported shipping state: ${state}`;
        order.dashboardStatus = "review"; // ✅ AUTO SEND TO REVIEW

        console.warn(`Blocked order ${order.id} from ${state}`);

        try {
          if (session.payment_intent) {
            await stripe.refunds.create({
              payment_intent: session.payment_intent
            });

            order.paymentStatus = "refunded";
            order.notes += " - Auto-refunded";
          }
        } catch (refundError) {
          console.error("Refund failed:", refundError);
          order.notes += " - REFUND FAILED";
        }
      }

      const store = getStore("orders");

      await store.set(
        `orders/${order.id}.json`,
        JSON.stringify(order, null, 2)
      );

      // Store review request — check-review-requests scheduled function processes these 7+ days later
      if (!isUnsupportedState && order.customer?.email) {
        const reviewStore = getStore("review-requests");
        await reviewStore.set(order.id, JSON.stringify({
          orderId: order.id,
          customerEmail: order.customer.email,
          customerName: order.customer.name,
          items: order.items,
          createdAt: now
        }));
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: `Webhook error: ${error.message}`
    };
  }
};