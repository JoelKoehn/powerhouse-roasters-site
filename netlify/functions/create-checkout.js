const Stripe = require("stripe");

const FREE_SHIPPING_THRESHOLD = 7500; // $75.00 in cents
const PRODUCT_PRICE_CENTS = 1900; // $19.00 — update here to change all product prices

// NOTE: "name" here must exactly match the blend keys used in the ops
// dashboard's Blends editor and roastNeeded aggregation. Do not decorate
// it (e.g. "Full Power Dark - Bold & Rich") — that breaks the roast
// queue's blend-formula lookup for every order built from this map.
// Use "tagline" for the flavor blurb shown at checkout instead.
const PRODUCT_MAP = {
  "Brazil": {
    name: "Brazil",
    tagline: "Smooth & Balanced",
    unit_amount: PRODUCT_PRICE_CENTS,
    image: "https://powerhouseroasters.com/images/brazil-bag.jpg"
  },
  "Guatemala": {
    name: "Guatemala",
    tagline: "Bright & Structured",
    unit_amount: PRODUCT_PRICE_CENTS,
    image: "https://powerhouseroasters.com/images/guate-bag.jpg"
  },
  "Ethiopia": {
    name: "Ethiopia",
    tagline: "Floral & Citrus",
    unit_amount: PRODUCT_PRICE_CENTS,
    image: "https://powerhouseroasters.com/images/ethiopia-bag.jpg"
  },
  "Range Line Roast": {
    name: "Range Line Roast",
    tagline: "House Blend",
    unit_amount: PRODUCT_PRICE_CENTS,
    image: "https://powerhouseroasters.com/images/rangeline-bag.jpg"
  },
  "Stillwater Decaf": {
    name: "Stillwater Decaf",
    tagline: "Smooth & Clean",
    unit_amount: PRODUCT_PRICE_CENTS,
    image: "https://powerhouseroasters.com/images/swater-bag.jpg"
  },
  "Full Power Dark": {
    name: "Full Power Dark",
    tagline: "Bold & Rich",
    unit_amount: PRODUCT_PRICE_CENTS,
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

      const grind = item.grind === "ground" ? "ground" : "whole-bean";
      const grindLabel = grind === "ground" ? "Ground" : "Whole Bean";

      return {
        quantity,
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            description: `${product.tagline} — Wyoming roasted, small-batch · ${grindLabel}`,
            images: [product.image],
            metadata: { grind }
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
      allow_promotion_codes: true,
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