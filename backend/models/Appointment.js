const { randomUUID } = require("crypto");
const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: String,
      unique: true,
      default: () => `APT-${randomUUID().slice(0, 8).toUpperCase()}`
    },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", default: null },
    healthConcern: { type: String, trim: true, maxlength: 500, default: "" },
    needsDoctorAssignment: { type: Boolean, default: false },
    appointmentDate: { type: Date, required: true },
    appointmentTime: { type: String, required: true, match: [/^\d{2}:\d{2}$/, "Use 24-hour HH:MM time"] },
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Cancelled"],
      default: "Pending",
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
