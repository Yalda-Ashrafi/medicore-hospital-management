const Patient = require("../models/Patient");
const Visit = require("../models/Visit");
const { attemptNotifications, notifyRoles } = require("../utils/notifications");

const currencies = new Set(["MYR", "USD"]);
const paymentMethods = new Set(["Cash", "Card", "Bank transfer", "E-wallet", "Other"]);

async function registerWalkIn(req, res) {
  const { fullName, age, gender, phone, address, condition, visitDate, amountMinor, currency, paymentMethod } = req.body;
  const normalizedName = typeof fullName === "string" ? fullName.trim() : "";
  const normalizedPhone = typeof phone === "string" ? phone.trim() : "";
  const normalizedAddress = typeof address === "string" ? address.trim() : "";
  const normalizedCondition = typeof condition === "string" ? condition.trim() : "";
  const visitDayPattern = /^\d{4}-\d{2}-\d{2}$/;
  const visitDay = typeof visitDate === "string" && visitDayPattern.test(visitDate) ? new Date(`${visitDate}T00:00:00.000Z`) : null;
  const numericAge = typeof age === "number" ? age
    : typeof age === "string" && age.trim() ? Number(age) : NaN;

  if (!normalizedName || normalizedName.length > 120 || !Number.isInteger(numericAge) ||
      numericAge < 0 || numericAge > 125 || !["Female", "Male", "Other"].includes(gender) ||
      !normalizedPhone || normalizedPhone.length > 30 || !normalizedAddress || normalizedAddress.length > 300 ||
      !normalizedCondition || normalizedCondition.length > 160 || !visitDay || Number.isNaN(visitDay.getTime()) ||
      visitDay.toISOString().slice(0, 10) !== visitDate ||
      !Number.isSafeInteger(amountMinor) || amountMinor < 1 || amountMinor > 1000000000 ||
      !currencies.has(currency) || !paymentMethods.has(paymentMethod)) {
    return res.status(400).json({
      success: false,
      message: "Check the patient details, visit date, payment amount, currency, and payment method."
    });
  }

  const patient = await Patient.create({
    fullName: normalizedName,
    age: numericAge,
    gender,
    phone: normalizedPhone,
    address: normalizedAddress,
    disease: normalizedCondition,
    admissionDate: visitDay
  });

  let visit;
  try {
    visit = await Visit.create({
      patient: patient._id,
      visitDate: visitDay,
      condition: normalizedCondition,
      amountMinor,
      currency,
      paymentMethod,
      receivedBy: req.user._id
    });
  } catch (error) {
    await Patient.deleteOne({ _id: patient._id });
    throw error;
  }
  let notificationWarning;
  if (req.user.role === "receptionist") {
    notificationWarning = await attemptNotifications([notifyRoles(["admin"], {
      type: "front-desk",
      title: "Walk-in check-in recorded",
      message: "A walk-in check-in and payment have been recorded.",
      href: "front-desk.html"
    }, req.user._id)]);
  }

  res.status(201).json({
    success: true,
    message: "Walk-in visit recorded and receipt created.",
    notificationWarning,
    data: {
      patient: { id: String(patient._id), patientId: patient.patientId, fullName: patient.fullName },
      visit: {
        receiptId: visit.receiptId,
        visitDate: visit.visitDate,
        condition: visit.condition,
        amountMinor: visit.amountMinor,
        currency: visit.currency,
        paymentMethod: visit.paymentMethod
      }
    }
  });
}

module.exports = { registerWalkIn };
