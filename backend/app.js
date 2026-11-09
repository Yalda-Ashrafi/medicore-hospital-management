require("dotenv").config();

const path = require("path");
const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const asyncHandler = require("./middleware/asyncHandler");
const analyticsController = require("./controllers/analyticsController");

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "..", "frontend")));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/contact", require("./routes/contact"));
app.use("/api/front-desk", require("./routes/frontDesk"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/chat", require("./routes/chat"));

app.get("/api/health", (req, res) => {
  const database = ["disconnected", "connected", "connecting", "disconnecting"][mongoose.connection.readyState] || "unknown";
  res.json({
    success: true,
    message: "MediCore API is running",
    database
  });
});
app.use("/api/patients", require("./routes/patients"));
app.use("/api/doctors", require("./routes/doctors"));
app.use("/api/appointments", require("./routes/appointments"));
const { authenticate, requireRoles } = require("./middleware/authenticate");
const databaseReady = require("./middleware/databaseReady");
app.get("/api/dashboard/revenue", authenticate, requireRoles("admin"), databaseReady, asyncHandler(analyticsController.getMonthlyRevenue));
app.get("/api/dashboard", authenticate, requireRoles("admin", "doctor"), databaseReady, asyncHandler(analyticsController.getDashboard));
app.get("/api/reports", authenticate, requireRoles("admin"), require("./middleware/databaseReady"), asyncHandler(analyticsController.getReports));
app.use(notFound);
app.use(errorHandler);

module.exports = app;
