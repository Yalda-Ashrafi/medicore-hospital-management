const express = require("express");
const controller = require("../controllers/appointmentsController");
const asyncHandler = require("../middleware/asyncHandler");
const databaseReady = require("../middleware/databaseReady");
const validateObjectId = require("../middleware/validateObjectId");
const validateJsonBody = require("../middleware/validateJsonBody");
const validateRequiredFields = require("../middleware/validateRequiredFields");
const { authenticate, requireRoles } = require("../middleware/authenticate");

const router = express.Router();
router.use(authenticate, requireRoles("admin", "doctor", "receptionist", "patient"));
router.route("/")
  .get(databaseReady, asyncHandler(controller.listAppointments))
  .post(
    requireRoles("admin", "receptionist", "patient"),
    validateJsonBody,
    validateRequiredFields(["appointmentDate", "appointmentTime"]),
    databaseReady,
    asyncHandler(controller.createAppointment)
  );
router.route("/:id")
  .get(validateObjectId, databaseReady, asyncHandler(controller.getAppointment))
  .put(requireRoles("admin", "doctor", "receptionist"), validateObjectId, validateJsonBody, databaseReady, asyncHandler(controller.updateAppointment))
  .delete(requireRoles("admin"), validateObjectId, databaseReady, asyncHandler(controller.deleteAppointment));

module.exports = router;
