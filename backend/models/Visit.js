const { randomUUID } = require("crypto");
const mongoose = require("mongoose");

const visitSchema = new mongoose.Schema(
  {
    receiptId: {
      type: String,
      unique: true,
      default: () => `REC-${randomUUID().slice(0, 8).toUpperCase()}`
    },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    visitDate: { type: Date, required: true },
    condition: { type: String, required: true, trim: true, maxlength: 160 },
    amountMinor: { type: Number, required: true, min: 1, max: 1000000000, validate: Number.isInteger },
    currency: { type: String, required: true, enum: ["MYR", "USD"] },
    paymentMethod: { type: String, required: true, enum: ["Cash", "Card", "Bank transfer", "E-wallet", "Other"] },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

visitSchema.index({ visitDate: 1, currency: 1 });

module.exports = mongoose.model("Visit", visitSchema);
