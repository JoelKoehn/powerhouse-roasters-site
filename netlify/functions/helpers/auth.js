function getAdminKey(event) {
  return event.headers["x-admin-key"] || event.headers["X-Admin-Key"];
}

function isAuthorized(event) {
  return (
    process.env.ADMIN_DASHBOARD_KEY &&
    getAdminKey(event) === process.env.ADMIN_DASHBOARD_KEY
  );
}

function unauthorizedResponse() {
  return {
    statusCode: 401,
    body: JSON.stringify({ error: "Unauthorized" })
  };
}

module.exports = {
  getAdminKey,
  isAuthorized,
  unauthorizedResponse
};