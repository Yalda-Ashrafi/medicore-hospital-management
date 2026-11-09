const express = require("express");
const controller = require("../controllers/patientsController");
const asyncHandler = require("../middleware/asyncHandler");
const databaseReady = require("../middleware/databaseReady");
const validateObjectId = require("../middleware/validateObjectId");
const validateJsonBody = require("../middleware/validateJsonBody");
const validateRequiredFields = require("../middleware/validateRequiredFields");
const { authenticate, requireRoles } = require("../middleware/authenticate");

const router = express.Router();
router.use(authenticate, requireRoles("admin", "doctor", "receptionist", "patient"));
router.route("/")
  .get(databaseReady, asyncHandler(controller.listPatients))
  .post(
    requireRoles("admin", "receptionist"),
    validateJsonBody,
    validateRequiredFields(["fullName", "age", "gender", "phone", "address", "disease", "admissionDate"]),
    databaseReady,
    asyncHandler(controller.createPatient)
  );
router.route("/:id")
  .get(validateObjectId, databaseReady, asyncHandler(controller.getPatient))
  .put(requireRoles("admin", "receptionist"), validateObjectId, validateJsonBody, databaseReady, asyncHandler(controller.updatePatient))
  .delete(requireRoles("admin"), validateObjectId, databaseReady, asyncHandler(controller.deletePatient));

module.exports = router;
