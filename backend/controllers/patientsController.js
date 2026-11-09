const Patient = require("../models/Patient");
const User = require("../models/User");
const pickFields = require("../middleware/pickFields");
const patientFields = ["fullName", "age", "gender", "phone", "address", "disease", "admissionDate"];

async function listPatients(req, res) {
  const filter = req.user.role === "patient" ? { _id: req.user.patient || null } : {};
  let patients = await Patient.find(filter).sort({ createdAt: -1 });
  if (req.user.role === "admin") {
    const accounts = await User.find({ patient: { $in: patients.map((patient) => patient._id) } }).select("patient").lean();
    const linkedIds = new Set(accounts.map((account) => String(account.patient)));
    patients = patients.map((patient) => ({ ...patient.toObject(), hasAccount: linkedIds.has(String(patient._id)) }));
  }
  res.json({ success: true, count: patients.length, data: patients });
}

async function getPatient(req, res) {
  if (req.user.role === "patient" && String(req.user.patient) !== req.params.id) {
    return res.status(404).json({ success: false, message: "Patient not found" });
  }
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.status(404).json({ success: false, message: "Patient not found" });
  res.json({ success: true, data: patient });
}

async function createPatient(req, res) {
  const patient = await Patient.create(pickFields(req.body, patientFields));
  res.status(201).json({ success: true, data: patient });
}

async function updatePatient(req, res) {
  const patient = await Patient.findByIdAndUpdate(req.params.id, pickFields(req.body, patientFields), {
    new: true,
    runValidators: true
  });
  if (!patient) return res.status(404).json({ success: false, message: "Patient not found" });
  res.json({ success: true, data: patient });
}

async function deletePatient(req, res) {
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.status(404).json({ success: false, message: "Patient not found" });
  await User.deleteOne({ patient: patient._id });
  await patient.deleteOne();
  res.json({ success: true, message: "Patient deleted" });
}

module.exports = { listPatients, getPatient, createPatient, updatePatient, deletePatient };
