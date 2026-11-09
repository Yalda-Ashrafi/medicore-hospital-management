const mongoose = require("mongoose");

function validateObjectId(req, res, next) {
  if (mongoose.isValidObjectId(req.params.id)) return next();
  res.status(400).json({ success: false, message: "Invalid resource identifier" });
}

module.exports = validateObjectId;
