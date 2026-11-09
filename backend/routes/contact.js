const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const validateJsonBody = require("../middleware/validateJsonBody");
const controller = require("../controllers/contactController");

const router = express.Router();
router.post("/", validateJsonBody, asyncHandler(controller.submitContactMessage));

module.exports = router;
