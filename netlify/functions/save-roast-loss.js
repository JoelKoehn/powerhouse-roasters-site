const { getStore, connectLambda } = require("@netlify/blobs");
const { isAuthorized, unauthorizedResponse } = require("./helpers/auth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  if (!isAuthorized(event)) return unauthorizedResponse();

  try {
    connectLambda(event);
    const { roastLoss } = JSON.parse(event.body || "{}");

    if (!roastLoss || typeof roastLoss !== "object" || Array.isArray(roastLoss)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid roast loss data" }) };
    }

    for (const [name, pct] of Object.entries(roastLoss)) {
      const n = Number(pct);
      if (!Number.isFinite(n) || n < 0 || n > 60) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Roast loss for "${name}" must be a number between 0 and 60` })
        };
      }
    }

    const store = getStore("ops");
    await store.set("roast-loss", JSON.stringify(roastLoss, null, 2));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, roastLoss })
    };
  } catch (error) {
    console.error("save-roast-loss error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
