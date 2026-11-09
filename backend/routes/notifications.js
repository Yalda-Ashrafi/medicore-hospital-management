const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const databaseReady = require("../middleware/databaseReady");
const validateJsonBody = require("../middleware/validateJsonBody");
const validateObjectId = require("../middleware/validateObjectId");
const { authenticate } = require("../middleware/authenticate");
const controller = require("../controllers/notificationsController");

const router = express.Router();
router.use(authenticate, databaseReady);
router.get("/", asyncHandler(controller.listNotifications));
router.patch("/read-all", validateJsonBody, asyncHandler(controller.markAllRead));
router.patch("/:id/read", validateObjectId, validateJsonBody, asyncHandler(controller.markRead));

module.exports = router;
