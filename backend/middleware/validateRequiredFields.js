function validateRequiredFields(fields) {
  return function validateRequiredFieldsMiddleware(req, res, next) {
    const missing = fields.filter((field) => req.body[field] == null || req.body[field] === "");
    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(", ")}`
      });
    }
    next();
  };
}

module.exports = validateRequiredFields;
