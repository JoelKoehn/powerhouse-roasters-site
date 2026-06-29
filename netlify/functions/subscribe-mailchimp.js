exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const { email } = JSON.parse(event.body || "{}");
  if (!email || !email.includes("@")) {
    return { statusCode: 400, body: JSON.stringify({ error: "Valid email required" }) };
  }

  const { MAILCHIMP_API_KEY, MAILCHIMP_LIST_ID, MAILCHIMP_SERVER_PREFIX } = process.env;
  if (!MAILCHIMP_API_KEY || !MAILCHIMP_LIST_ID || !MAILCHIMP_SERVER_PREFIX) {
    console.warn("Mailchimp env vars not configured");
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  try {
    const res = await fetch(
      `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${MAILCHIMP_LIST_ID}/members`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString("base64")}`
        },
        body: JSON.stringify({
          email_address: email,
          status: "subscribed",
          tags: ["popup-signup", "10-percent-offer"]
        })
      }
    );

    const data = await res.json();

    if (!res.ok && data.title !== "Member Exists") {
      console.error("Mailchimp error:", data);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.error("subscribe-mailchimp error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
