const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const pickFields = require("../middleware/pickFields");
const { attemptNotifications, notifyDoctor, notifyPatient, notifyRoles } = require("../utils/notifications");
const appointmentFields = ["patient", "doctor", "appointmentDate", "appointmentTime", "status", "healthConcern", "needsDoctorAssignment"];

const populateAppointment = (query) => query.populate("patient", "patientId fullName").populate("doctor", "doctorId fullName specialization roomNumber");

async function validateReferences(patientId, doctorId) {
  const [patient, doctor] = await Promise.all([
    Patient.exists({ _id: patientId }),
    doctorId ? Doctor.exists({ _id: doctorId, reviewStatus: { $ne: "rejected" } }) : Promise.resolve(true)
  ]);
  if (!patient || !doctor) {
    const error = new Error("Select an existing patient and doctor");
    error.statusCode = 400;
    throw error;
  }
}

async function listAppointments(req, res) {
  const filter = req.user.role === "patient" ? { patient: req.user.patient || null }
    : req.user.role === "doctor" ? { doctor: req.user.doctor || null } : {};
  const appointments = await populateAppointment(Appointment.find(filter).sort({ appointmentDate: 1, appointmentTime: 1 }));
  res.json({ success: true, count: appointments.length, data: appointments });
}

async function getAppointment(req, res) {
  const appointment = await populateAppointment(Appointment.findById(req.params.id));
  if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });
  if (req.user.role === "patient" && (!appointment.patient || String(appointment.patient._id) !== String(req.user.patient))) {
    return res.status(404).json({ success: false, message: "Appointment not found" });
  }
  if (req.user.role === "doctor" && (!appointment.doctor || String(appointment.doctor._id) !== String(req.user.doctor))) {
    return res.status(404).json({ success: false, message: "Appointment not found" });
  }
  res.json({ success: true, data: appointment });
}

async function createAppointment(req, res) {
  const values = pickFields(req.body, appointmentFields);
  if (typeof values.healthConcern === "string") values.healthConcern = values.healthConcern.trim();
  if (req.user.role === "patient" && !req.user.patient) {
    return res.status(403).json({ success: false, message: "Complete your patient profile before requesting an appointment." });
  }
  if (req.user.role === "patient") values.patient = req.user.patient;
  const needsDoctorAssignment = req.user.role === "patient" && values.needsDoctorAssignment === true;
  if (!values.patient || !values.appointmentDate || !values.appointmentTime ||
      (!needsDoctorAssignment && !values.doctor) || (needsDoctorAssignment && !values.healthConcern)) {
    return res.status(400).json({ success: false, message: "Patient, appointment date, and appointment time are required; select a doctor or ask reception for help with your condition." });
  }
  values.needsDoctorAssignment = needsDoctorAssignment;
  if (needsDoctorAssignment) values.doctor = null;
  await validateReferences(values.patient, values.doctor);
  if (req.user.role === "patient") values.status = "Pending";
  const appointment = await Appointment.create(values);
  await appointment.populate("patient doctor", "patientId doctorId fullName specialization roomNumber");
  let notificationWarning;
  if (req.user.role === "patient") {
    const notification = {
      type: "appointment",
      title: needsDoctorAssignment ? "Appointment needs doctor assignment" : "New appointment request",
      message: needsDoctorAssignment
        ? `A patient needs help finding a doctor${appointment.healthConcern ? ` for: ${appointment.healthConcern}` : ""}.`
        : "A patient has requested an appointment.",
      href: "appointments.html"
    };
    const notifications = [notifyRoles(["admin", "receptionist"], notification, req.user._id)];
    if (appointment.doctor) notifications.push(notifyDoctor(appointment.doctor._id, notification, req.user._id));
    notificationWarning = await attemptNotifications(notifications);
  } else {
    notificationWarning = await attemptNotifications([
      notifyPatient(appointment.patient._id, {
        type: "appointment",
        title: "Appointment scheduled",
        message: "An appointment has been added to your account.",
        href: "patient.html#appointments"
      }, req.user._id),
      notifyDoctor(appointment.doctor._id, {
        type: "appointment",
        title: "Appointment added",
        message: "A new appointment has been added to your schedule.",
        href: "appointments.html"
      }, req.user._id)
    ]);
  }
  res.status(201).json({ success: true, data: appointment, notificationWarning });
}

async function updateAppointment(req, res) {
  const current = await Appointment.findById(req.params.id);
  if (!current) return res.status(404).json({ success: false, message: "Appointment not found" });
  if (req.user.role === "doctor" && String(current.doctor) !== String(req.user.doctor)) {
    return res.status(404).json({ success: false, message: "Appointment not found" });
  }
  const values = pickFields(req.body, appointmentFields);
  if (typeof values.healthConcern === "string") values.healthConcern = values.healthConcern.trim();
  if (req.user.role === "doctor") {
    for (const field of Object.keys(values)) {
      if (field !== "status") {
        return res.status(403).json({ success: false, message: "Doctors may only update the status of their own appointments." });
      }
    }
  }
  const patientId = values.patient || current.patient;
  const doctorId = Object.hasOwn(values, "doctor") ? values.doctor || null : current.doctor;
  if (doctorId) values.needsDoctorAssignment = false;
  else values.needsDoctorAssignment = true;
  if (values.status === "Confirmed" && !doctorId) {
    return res.status(400).json({ success: false, message: "Assign a doctor before confirming this appointment." });
  }
  const appointmentChanged = Object.keys(values).some((field) => {
    if (field === "appointmentDate") return new Date(values[field]).getTime() !== current.appointmentDate.getTime();
    return String(values[field]) !== String(current[field]);
  });
  await validateReferences(patientId, doctorId);
  const appointment = await Appointment.findByIdAndUpdate(req.params.id, values, {
    new: true,
    runValidators: true
  });
  await appointment.populate("patient doctor", "patientId doctorId fullName specialization roomNumber");
  let notificationWarning;
  if (appointmentChanged) {
    const statusChanged = values.status && values.status !== current.status;
    notificationWarning = await attemptNotifications([
      notifyPatient(appointment.patient._id, {
        type: "appointment",
        title: statusChanged ? "Appointment status updated" : "Appointment details updated",
        message: statusChanged ? `Your appointment status is now ${appointment.status}.` : "Your appointment details have been updated.",
        href: "patient.html#appointments"
      }, req.user._id),
      req.user.role === "doctor" || !appointment.doctor ? Promise.resolve() : notifyDoctor(appointment.doctor._id, {
        type: "appointment",
        title: "Appointment updated",
        message: "An appointment in your schedule has been updated.",
        href: "appointments.html"
      }, req.user._id)
    ]);
  }
  res.json({ success: true, data: appointment, notificationWarning });
}

async function deleteAppointment(req, res) {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });
  await appointment.deleteOne();
  const notificationWarning = await attemptNotifications([
    notifyPatient(appointment.patient, {
      type: "appointment",
      title: "Appointment removed",
      message: "An appointment has been removed from your schedule.",
      href: "patient.html#appointments"
    }, req.user._id),
    appointment.doctor && notifyDoctor(appointment.doctor, {
      type: "appointment",
      title: "Appointment removed",
      message: "An appointment has been removed from your schedule.",
      href: "appointments.html"
    }, req.user._id)
  ]);
  res.json({ success: true, message: "Appointment deleted", notificationWarning });
}

module.exports = { listAppointments, getAppointment, createAppointment, updateAppointment, deleteAppointment };
