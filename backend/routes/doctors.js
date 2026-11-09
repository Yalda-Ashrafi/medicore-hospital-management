const express = require("express");
const controller = require("../controllers/doctorsController");
const asyncHandler = require("../middleware/asyncHandler");
const databaseReady = require("../middleware/databaseReady");
const validateObjectId = require("../middleware/validateObjectId");
const validateJsonBody = require("../middleware/validateJsonBody");
const validateRequiredFields = require("../middleware/validateRequiredFields");
const { authenticate, requireRoles } = require("../middleware/authenticate");

const router = express.Router();
router.use(authenticate, requireRoles("admin", "doctor", "receptionist", "patient"));
router.route("/")
  .get(databaseReady, asyncHandler(controller.listDoctors))
  .post(
    requireRoles("admin", "receptionist"),
    validateJsonBody,
    validateRequiredFields(["fullName", "specialization", "phone", "email", "availability"]),
    databaseReady,
    asyncHandler(controller.createDoctor)
  );
router.route("/:id")
  .get(validateObjectId, databaseReady, asyncHandler(controller.getDoctor))
  .put(requireRoles("admin", "receptionist"), validateObjectId, validateJsonBody, databaseReady, asyncHandler(controller.updateDoctor))
  .delete(requireRoles("admin"), validateObjectId, databaseReady, asyncHandler(controller.deleteDoctor));

module.exports = router;
