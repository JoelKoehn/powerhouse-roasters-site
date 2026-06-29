const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    connectLambda(event);
    const slug = event.queryStringParameters?.slug;
    if (!slug) {
      return { statusCode: 400, body: JSON.stringify({ error: "slug required" }) };
    }

    const store = getStore("reviews");
    const { blobs } = await store.list({ prefix: `${slug}/` });

    const reviews = [];
    for (const blob of blobs) {
      try {
        const raw = await store.get(blob.key);
        if (!raw) continue;
        const review = JSON.parse(raw);
        if (review.approved) {
          reviews.push({
            id: review.id,
            author: review.author,
            body: review.body,
            rating: review.rating,
            createdAt: review.createdAt
          });
        }
      } catch (_) {}
    }

    reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviews })
    };
  } catch (err) {
    console.error("get-reviews error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
