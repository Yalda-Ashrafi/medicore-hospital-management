const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const databaseReady = require("../middleware/databaseReady");
const validateJsonBody = require("../middleware/validateJsonBody");
const { authenticate, requireRoles } = require("../middleware/authenticate");
const controller = require("../controllers/frontDeskController");

const router = express.Router();
router.post("/walk-ins", authenticate, requireRoles("admin", "receptionist"), databaseReady, validateJsonBody, asyncHandler(controller.registerWalkIn));

module.exports = router;
