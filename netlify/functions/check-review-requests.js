// Scheduled daily — sends 7-day post-purchase review request emails
const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event) => {
  try {
    connectLambda(event);
    const store = getStore("orders");
    const { SENDGRID_API_KEY, URL: siteUrl } = process.env;

    if (!SENDGRID_API_KEY) {
      console.warn("SENDGRID_API_KEY not set, skipping review requests");
      return { statusCode: 200, body: "skipped" };
    }

    const { blobs } = await store.list({ prefix: "orders/" });
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    let sent = 0;

    for (const blob of blobs) {
      try {
        const raw = await store.get(blob.key);
        if (!raw) continue;
        const order = JSON.parse(raw);

        // Only completed orders that haven't had a review email sent
        if (order.reviewEmailSent) continue;
        if (order.dashboardStatus !== "completed") continue;

        const orderAge = now - new Date(order.createdAt).getTime();
        if (orderAge < SEVEN_DAYS_MS) continue;

        const email = order.customer?.email;
        const name = order.customer?.name?.split(" ")[0] || "there";
        if (!email) continue;

        const productList = (order.items || [])
          .map(i => i.name)
          .filter(Boolean)
          .join(", ");

        const site = siteUrl || "https://powerhouseroasters.com";

        await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SENDGRID_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email, name: order.customer.name }] }],
            from: { email: "info@powerhouseroasters.com", name: "Powerhouse Roasters" },
            subject: "How's your coffee? We'd love to hear from you.",
            content: [{
              type: "text/html",
              value: `
                <p>Hi ${name},</p>
                <p>It's been a week since your Powerhouse Roasters order arrived — we hope you're enjoying it!</p>
                <p>You ordered: <strong>${productList}</strong></p>
                <p>If you have a moment, we'd really appreciate a review. It helps other coffee lovers find us and helps us keep getting better.</p>
                <p><a href="${site}/index.html#coffees" style="background:#C8A24D;color:#1c1406;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:700;display:inline-block;">Leave a Review</a></p>
                <p>Thanks for your support,<br>The Powerhouse Roasters Team</p>
              `
            }]
          })
        });

        // Mark as sent
        order.reviewEmailSent = true;
        order.reviewEmailSentAt = new Date().toISOString();
        await store.set(blob.key, JSON.stringify(order, null, 2));
        sent++;
      } catch (innerErr) {
        console.error("Error processing order for review email:", innerErr.message);
      }
    }

    console.log(`Review request emails sent: ${sent}`);
    return { statusCode: 200, body: JSON.stringify({ sent }) };
  } catch (err) {
    console.error("check-review-requests error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
