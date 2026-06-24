const Stripe = require("stripe");

const FREE_SHIPPING_THRESHOLD = 7500; // $75.00 in cents

const PRODUCT_MAP = {
  "Brazil": {
    name: "Brazil - Smooth & Balanced",
    unit_amount: 1900,
    image: "https://powerhouseroasters.com/images/brazil-bag.jpg"
  },
  "Guatemala": {
    name: "Guatemala - Bright & Structured",
    unit_amount: 1900,
    image: "https://powerhouseroasters.com/images/guate-bag.jpg"
  },
  "Ethiopia": {
    name: "Ethiopia - Floral & Citrus",
    unit_amount: 1900,
    image: "https://powerhouseroasters.com/images/ethiopia-bag.jpg"
  },
  "Range Line Roast": {
    name: "Range Line Roast - House Blend",
    unit_amount: 1900,
    image: "https://powerhouseroasters.com/images/rangeline-bag.jpg"
  },
  "Stillwater Decaf": {
    name: "Stillwater Decaf - Smooth & Clean",
    unit_amount: 1900,
    image: "https://powerhouseroasters.com/images/swater-bag.jpg"
  },
  "Full Power Dark": {
    name: "Full Power Dark - Bold & Rich",
    unit_amount: 1900,
    image: "https://powerhouseroasters.com/images/fpdark-bag.jpg"
  }
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const freeShippingRate = process.env.STRIPE_FREE_SHIPPING_RATE_ID;
    const standardShippingRate = process.env.STRIPE_STANDARD_SHIPPING_RATE_ID;

    if (!stripeKey) {
      throw new Error("Missing STRIPE_SECRET_KEY");
    }

    if (!freeShippingRate) {
      throw new Error("Missing STRIPE_FREE_SHIPPING_RATE_ID");
    }

    if (!standardShippingRate) {
      throw new Error("Missing STRIPE_STANDARD_SHIPPING_RATE_ID");
    }

    const stripe = new Stripe(stripeKey);

    const { cart } = JSON.parse(event.body || "{}");

    if (!Array.isArray(cart) || cart.length === 0) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ error: "Cart is empty" })
      };
    }

    const origin =
      event.headers.origin ||
      event.headers.Origin ||
      process.env.SITE_URL ||
      "http://localhost:8888";

    let subtotal = 0;

    const line_items = cart.map((item) => {
      const product = PRODUCT_MAP[item.name];

      if (!product) {
        throw new Error(`Unknown product: ${item.name}`);
      }

      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity for ${item.name}`);
      }

      subtotal += product.unit_amount * quantity;

      return {
        quantity,
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            description: "Wyoming roasted - Small-batch coffee",
            images: [product.image]
          },
          unit_amount: product.unit_amount
        }
      };
    });

    const shippingRateId =
      subtotal >= FREE_SHIPPING_THRESHOLD
        ? freeShippingRate
        : standardShippingRate;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      billing_address_collection: "required",
      shipping_address_collection: {
        allowed_countries: ["US"]
      },
      shipping_options: [
        {
          shipping_rate: shippingRateId
        }
      ],
      success_url: `${origin}/thank-you.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel.html`,
      metadata: {
        cart_subtotal_cents: String(subtotal),
        free_shipping_applied: subtotal >= FREE_SHIPPING_THRESHOLD ? "yes" : "no"
      }
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url: session.url })
    };
  } catch (error) {
    console.error("create-checkout error:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        error: error.message || "Checkout failed"
      })
    };
  }
};