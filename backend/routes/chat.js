const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const databaseReady = require("../middleware/databaseReady");
const validateJsonBody = require("../middleware/validateJsonBody");
const validateObjectId = require("../middleware/validateObjectId");
const { authenticate, requireRoles } = require("../middleware/authenticate");
const controller = require("../controllers/chatController");

const router = express.Router();
router.use(authenticate, requireRoles("admin", "receptionist", "patient"), databaseReady);
router.get("/conversations", asyncHandler(controller.listConversations));
router.post("/conversations", requireRoles("patient"), asyncHandler(controller.getConversation));
router.get("/conversations/:id/messages", validateObjectId, asyncHandler(controller.getMessages));
router.post("/conversations/:id/messages", validateObjectId, validateJsonBody, asyncHandler(controller.sendMessage));

module.exports = router;
