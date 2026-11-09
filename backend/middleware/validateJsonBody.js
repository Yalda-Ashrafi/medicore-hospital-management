function validateJsonBody(req, res, next) {
  if (!req.is("application/json") || !req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ success: false, message: "Request body must be a JSON object" });
  }
  if (Object.keys(req.body).length === 0) {
    return res.status(400).json({ success: false, message: "Request body must not be empty" });
  }
  next();
}

module.exports = validateJsonBody;
