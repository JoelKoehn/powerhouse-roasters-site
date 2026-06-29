const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    connectLambda(event);
    const { productSlug, productName, author, body: reviewBody, rating } = JSON.parse(event.body || "{}");

    if (!productSlug || !author || !reviewBody || !rating) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" }) };
    }

    const id = `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const review = {
      id,
      productSlug,
      productName: productName || productSlug,
      author: author.slice(0, 80),
      body: reviewBody.slice(0, 1200),
      rating: Math.min(5, Math.max(1, Number(rating))),
      approved: false,
      createdAt: new Date().toISOString()
    };

    const store = getStore("reviews");
    await store.set(`${productSlug}/${id}`, JSON.stringify(review));

    // Notify via SendGrid if configured
    const { SENDGRID_API_KEY, NOTIFICATION_EMAIL, URL: siteUrl } = process.env;
    if (SENDGRID_API_KEY && NOTIFICATION_EMAIL) {
      try {
        await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SENDGRID_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: NOTIFICATION_EMAIL }] }],
            from: { email: NOTIFICATION_EMAIL, name: "Powerhouse Roasters" },
            subject: `New review pending: ${productName || productSlug}`,
            content: [{
              type: "text/plain",
              value: `New ${rating}-star review from ${author} for ${productName}:\n\n"${reviewBody}"\n\nApprove it in your dashboard.`
            }]
          })
        });
      } catch (mailErr) {
        console.warn("SendGrid notification failed:", mailErr.message);
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, id })
    };
  } catch (err) {
    console.error("submit-review error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
