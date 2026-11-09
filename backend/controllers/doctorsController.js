const Doctor = require("../models/Doctor");
const User = require("../models/User");
const pickFields = require("../middleware/pickFields");
const normalizeHealthConcerns = require("../utils/normalizeHealthConcerns");
const doctorFields = ["fullName", "specialization", "roomNumber", "phone", "email", "availability", "healthConcerns"];

function doctorInput(req, res) {
  const input = pickFields(req.body, doctorFields);
  if (Object.prototype.hasOwnProperty.call(req.body, "healthConcerns")) {
    const result = normalizeHealthConcerns(req.body.healthConcerns);
    if (result.error) {
      res.status(400).json({ success: false, message: result.error });
      return null;
    }
    input.healthConcerns = result.concerns;
  }
  return input;
}

async function listDoctors(req, res) {
  const filter = ["patient", "receptionist"].includes(req.user.role) ? { reviewStatus: { $ne: "rejected" } }
    : req.user.role === "admin" ? { reviewStatus: { $ne: "rejected" } } : {};
  const query = Doctor.find(filter).sort({ createdAt: -1 });
  if (req.user.role === "patient") query.select("fullName specialization reviewStatus roomNumber availability healthConcerns");
  let doctors = await query;
  if (req.user.role === "admin") {
    const accounts = await User.find({ doctor: { $in: doctors.map((doctor) => doctor._id) } }).select("doctor").lean();
    const linkedIds = new Set(accounts.map((account) => String(account.doctor)));
    doctors = doctors.map((doctor) => ({ ...doctor.toObject(), hasAccount: linkedIds.has(String(doctor._id)) }));
  }
  res.json({ success: true, count: doctors.length, data: doctors });
}

async function getDoctor(req, res) {
  const query = Doctor.findOne(req.user.role === "patient"
    ? { _id: req.params.id, reviewStatus: { $ne: "rejected" } }
    : { _id: req.params.id });
  if (req.user.role === "patient") query.select("fullName specialization reviewStatus roomNumber availability healthConcerns");
  const doctor = await query;
  if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });
  res.json({ success: true, data: doctor });
}

async function createDoctor(req, res) {
  const input = doctorInput(req, res);
  if (!input) return;
  const doctor = await Doctor.create(input);
  res.status(201).json({ success: true, data: doctor });
}

async function updateDoctor(req, res) {
  const input = doctorInput(req, res);
  if (!input) return;
  const doctor = await Doctor.findByIdAndUpdate(req.params.id, input, {
    new: true,
    runValidators: true
  });
  if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });
  await User.updateOne({ doctor: doctor._id }, { email: doctor.email });
  res.json({ success: true, data: doctor });
}

async function deleteDoctor(req, res) {
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });
  await User.deleteOne({ doctor: doctor._id });
  await doctor.deleteOne();
  res.json({ success: true, message: "Doctor deleted" });
}

module.exports = { listDoctors, getDoctor, createDoctor, updateDoctor, deleteDoctor };
