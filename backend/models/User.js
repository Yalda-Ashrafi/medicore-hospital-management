const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
    passwordHash: { type: String, required: true, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    passwordResetRequestedAt: { type: Date, select: false },
    role: { type: String, required: true, enum: ["admin", "doctor", "patient", "receptionist"] },
    displayName: { type: String, trim: true, maxlength: 120 },
    googleId: { type: String, unique: true, sparse: true, select: false },
    firebaseUid: { type: String, unique: true, sparse: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },
    tokenVersion: { type: Number, default: 0 }
  },
  { timestamps: true }
);

userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });

module.exports = mongoose.model("User", userSchema);
