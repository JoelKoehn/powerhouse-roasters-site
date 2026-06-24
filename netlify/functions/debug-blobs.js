const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event) => {
  try {
    connectLambda(event);

    const siteID = process.env.NETLIFY_BLOBS_SITE_ID;
    const token = process.env.NETLIFY_BLOBS_TOKEN;

    const result = {
      hasSiteID: !!siteID,
      hasToken: !!token,
      siteIDPrefix: siteID ? siteID.slice(0, 8) : null,
      tokenPrefix: token ? token.slice(0, 8) : null
    };

    const store = getStore("orders");
    const listed = await store.list({ prefix: "orders/" });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        ...result,
        blobCount: (listed.blobs || []).length
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        hasSiteID: !!process.env.NETLIFY_BLOBS_SITE_ID,
        hasToken: !!process.env.NETLIFY_BLOBS_TOKEN,
        siteIDPrefix: process.env.NETLIFY_BLOBS_SITE_ID
          ? process.env.NETLIFY_BLOBS_SITE_ID.slice(0, 8)
          : null,
        tokenPrefix: process.env.NETLIFY_BLOBS_TOKEN
          ? process.env.NETLIFY_BLOBS_TOKEN.slice(0, 8)
          : null,
        error: error.message
      })
    };
  }
};