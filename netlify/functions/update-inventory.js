const { getStore, connectLambda } = require("@netlify/blobs");
const { isAuthorized, unauthorizedResponse } = require("./helpers/auth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  if (!isAuthorized(event)) return unauthorizedResponse();

  try {
    connectLambda(event);
    const { inventory } = JSON.parse(event.body || "{}");

    if (!inventory || typeof inventory !== "object") {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid inventory data" }) };
    }

    const store = getStore("ops");
    await store.set("inventory", JSON.stringify(inventory, null, 2));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, inventory })
    };
  } catch (error) {
    console.error("update-inventory error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
