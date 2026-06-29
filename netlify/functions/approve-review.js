const { getStore, connectLambda } = require("@netlify/blobs");
const { isAuthorized, unauthorizedResponse } = require("./helpers/auth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }
  if (!isAuthorized(event)) return unauthorizedResponse();

  try {
    connectLambda(event);
    const { slug, id } = JSON.parse(event.body || "{}");
    if (!slug || !id) {
      return { statusCode: 400, body: JSON.stringify({ error: "slug and id required" }) };
    }

    const store = getStore("reviews");
    const key = `${slug}/${id}`;
    const raw = await store.get(key);
    if (!raw) {
      return { statusCode: 404, body: JSON.stringify({ error: "Review not found" }) };
    }

    const review = JSON.parse(raw);
    review.approved = true;
    review.approvedAt = new Date().toISOString();
    await store.set(key, JSON.stringify(review));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.error("approve-review error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
