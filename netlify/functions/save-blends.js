const { getStore, connectLambda } = require("@netlify/blobs");
const { isAuthorized, unauthorizedResponse } = require("./helpers/auth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  if (!isAuthorized(event)) return unauthorizedResponse();

  try {
    connectLambda(event);
    const { blends } = JSON.parse(event.body || "{}");

    if (!blends || typeof blends !== "object") {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid blends data" }) };
    }

    // Validate each blend percentages sum to 100
    for (const [name, formula] of Object.entries(blends)) {
      const total = Object.values(formula).reduce((s, v) => s + Number(v), 0);
      if (Math.abs(total - 100) > 0.5) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Blend "${name}" percentages must sum to 100 (got ${total})` })
        };
      }
    }

    const store = getStore("ops");
    await store.set("blends", JSON.stringify(blends, null, 2));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true })
    };
  } catch (error) {
    console.error("save-blends error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
