const { getStore, connectLambda } = require("@netlify/blobs");
const { isAuthorized, unauthorizedResponse } = require("./helpers/auth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  if (!isAuthorized(event)) return unauthorizedResponse();

  try {
    connectLambda(event);
    const { origins } = JSON.parse(event.body || "{}");

    if (!Array.isArray(origins) || origins.some((o) => typeof o !== "string" || !o.trim())) {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid origins list" }) };
    }

    const cleaned = [...new Set(origins.map((o) => o.trim()))];

    const store = getStore("ops");
    await store.set("origins", JSON.stringify(cleaned, null, 2));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, origins: cleaned })
    };
  } catch (error) {
    console.error("save-origins error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
