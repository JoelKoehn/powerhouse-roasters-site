const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const FREQUENCY_MAP = {
  biweekly: { interval: "week", interval_count: 2, label: "Every 2 Weeks" },
  monthly:  { interval: "month", interval_count: 1, label: "Monthly" },
  "6weeks": { interval: "week", interval_count: 6, label: "Every 6 Weeks" }
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { productName, frequency = "monthly" } = JSON.parse(event.body || "{}");

    if (!productName) {
      return { statusCode: 400, body: JSON.stringify({ error: "productName required" }) };
    }

    const freq = FREQUENCY_MAP[frequency] || FREQUENCY_MAP.monthly;
    const origin = event.headers.origin || process.env.URL || "https://powerhouseroasters.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      allow_promotion_codes: true,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 1600,
            recurring: { interval: freq.interval, interval_count: freq.interval_count },
            product_data: {
              name: `${productName} — Subscribe & Save`,
              description: `${freq.label} delivery • Fresh-roasted small-batch coffee`
            }
          },
          quantity: 1
        }
      ],
      success_url: `${origin}/cart.html?subscribed=1`,
      cancel_url: `${origin}/cart.html`
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    console.error("create-subscription-checkout error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
