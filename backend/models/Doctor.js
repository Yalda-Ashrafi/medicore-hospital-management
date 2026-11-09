const { randomUUID } = require("crypto");
const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    doctorId: {
      type: String,
      unique: true,
      default: () => `DOC-${randomUUID().slice(0, 8).toUpperCase()}`
    },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    specialization: { type: String, required: true, trim: true, maxlength: 100 },
    reviewStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "approved" },
    roomNumber: { type: String, required: true, trim: true, maxlength: 20, default: "Unassigned" },
    healthConcerns: {
      type: [{ type: String, trim: true, maxlength: 80 }],
      default: [],
      validate: [(concerns) => concerns.length <= 30, "A doctor can list up to 30 health concerns"]
    },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 160,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email address"]
    },
    availability: { type: String, required: true, trim: true, maxlength: 160 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Doctor", doctorSchema);
