const { randomUUID } = require("crypto");
const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      unique: true,
      default: () => `PAT-${randomUUID().slice(0, 8).toUpperCase()}`
    },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    age: { type: Number, required: true, min: 0, max: 125 },
    gender: { type: String, required: true, enum: ["Female", "Male", "Other"] },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    disease: { type: String, trim: true, maxlength: 160, default: "Not provided" },
    admissionDate: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Patient", patientSchema);
