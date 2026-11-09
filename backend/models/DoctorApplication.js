const mongoose = require("mongoose");

const doctorApplicationSchema = new mongoose.Schema(
  {
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email address"]
    },
    passwordHash: { type: String, required: function () { return this.status === "pending"; }, select: false },
    firebaseUid: { type: String, trim: true },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    specialization: { type: String, required: true, trim: true, maxlength: 100 },
    availability: { type: String, required: true, trim: true, maxlength: 160 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewedAt: { type: Date }
  },
  { timestamps: true }
);

doctorApplicationSchema.index({ email: 1, status: 1 });

module.exports = mongoose.model("DoctorApplication", doctorApplicationSchema);
