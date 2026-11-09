const mongoose = require("mongoose");

function databaseReady(req, res, next) {
  if (mongoose.connection.readyState === 1) return next();

  const message = mongoose.connection.readyState === 2
    ? "MongoDB is still connecting. Try again shortly."
    : "MongoDB is not connected. Set MONGODB_URI in backend/.env, then restart the backend.";

  res.status(503).json({ success: false, message });
}

module.exports = databaseReady;
