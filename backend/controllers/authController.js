const { createHash, randomBytes } = require("node:crypto");
const Doctor = require("../models/Doctor");
const DoctorApplication = require("../models/DoctorApplication");
const Patient = require("../models/Patient");
const User = require("../models/User");
const { createToken, ensureTokenSecret, hashPassword, verifyPassword } = require("../utils/authTokens");
const normalizeHealthConcerns = require("../utils/normalizeHealthConcerns");
const { assertEmailConfiguration, sendPasswordResetEmail } = require("../utils/sendPasswordResetEmail");
const { verifyFirebaseIdToken, createFirebaseUser, deleteFirebaseUser } = require("../utils/firebaseAdmin");
const { attemptNotifications, createForUsers, notifyRoles } = require("../utils/notifications");

function passwordResetNotice(res) {
  res.json({
    success: true,
    message: "If an account exists for that email, a password reset link has been sent."
  });
}

async function firebasePasswordHash() {
  return hashPassword(randomBytes(32).toString("hex"));
}

async function firebaseIdentity(idToken, expectedEmail, requireVerified = false) {
  if (!idToken) return null;
  const identity = await verifyFirebaseIdToken(idToken);
  const email = String(identity.email || "").trim().toLowerCase();
  if ((requireVerified && !identity.email_verified) || !email || (expectedEmail && email !== expectedEmail)) {
    const error = new Error("The Firebase account email must be verified and match the registration email.");
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }
  return { uid: identity.uid, email };
}

async function requestPasswordReset(req, res) {
  ensureTokenSecret();
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "Please enter a valid email address." });
  }
  assertEmailConfiguration();

  const now = new Date();
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const user = await User.findOneAndUpdate(
    {
      email,
      $or: [
        { passwordResetRequestedAt: { $exists: false } },
        { passwordResetRequestedAt: { $lte: new Date(now.getTime() - 60 * 1000) } }
      ]
    },
    {
      $set: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpires: new Date(now.getTime() + 30 * 60 * 1000),
        passwordResetRequestedAt: now
      }
    },
    { new: true }
  ).select("+passwordResetTokenHash +passwordResetExpires");
  if (!user) return passwordResetNotice(res);

  try {
    await sendPasswordResetEmail(email, token);
  } catch (error) {
    await User.updateOne(
      { _id: user._id, passwordResetTokenHash: tokenHash },
      { $unset: { passwordResetTokenHash: 1, passwordResetExpires: 1 } }
    );
    console.error("Password reset email could not be sent:", error.message);
    const deliveryError = new Error("Password reset email could not be sent. Check the email settings and try again.");
    deliveryError.statusCode = 503;
    deliveryError.isOperational = true;
    throw deliveryError;
  }
  return passwordResetNotice(res);
}

async function resetPassword(req, res) {
  const { token, password } = req.body;
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({ success: false, message: "This password reset link is invalid or has expired." });
  }
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    return res.status(400).json({ success: false, message: "New password must be between 12 and 128 characters." });
  }

  const passwordHash = await hashPassword(password);
  const user = await User.findOneAndUpdate(
    {
      passwordResetTokenHash: createHash("sha256").update(token).digest("hex"),
      passwordResetExpires: { $gt: new Date() }
    },
    {
      $set: { passwordHash },
      $inc: { tokenVersion: 1 },
      $unset: { passwordResetTokenHash: 1, passwordResetExpires: 1 }
    },
    { new: true, runValidators: true }
  );
  if (!user) {
    return res.status(400).json({ success: false, message: "This password reset link is invalid or has expired." });
  }
  res.json({ success: true, message: "Your password has been updated. You can now log in with your new password." });
}

function publicUser(user, profile) {
  const displayName = user.role === "doctor" ? profile && profile.fullName
    : user.role === "patient" ? profile && profile.fullName || user.displayName
      : user.role === "receptionist" ? user.displayName : "Administrator";
  return {
    id: String(user._id),
    email: user.email,
    role: user.role,
    displayName: displayName || (user.role === "doctor" ? "Doctor" : user.role === "patient" ? "Patient" : user.role === "receptionist" ? "Receptionist" : "Administrator"),
    profileId: user.doctor || user.patient ? String(user.doctor || user.patient) : null
  };
}

async function sessionResponse(user, res, status = 200) {
  let profile = null;
  if (user.doctor) profile = await Doctor.findById(user.doctor).select("fullName");
  if (user.patient) profile = await Patient.findById(user.patient).select("fullName");
  res.status(status).json({
    success: true,
    data: { token: createToken(user), user: publicUser(user, profile) }
  });
}

async function registerPatient(req, res) {
  ensureTokenSecret();
  const { fullName, email, password, age, gender, phone, address, firebaseIdToken } = req.body;
  if (!fullName || !email || !password || age === undefined || !gender || !phone || !address) {
    return res.status(400).json({ success: false, message: "Name, email, password, age, gender, phone, and address are required." });
  }
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    return res.status(400).json({ success: false, message: "Password must be between 12 and 128 characters." });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ success: false, message: "Please provide a valid email address." });
  }
  if (await User.exists({ email: normalizedEmail }) ||
      await Doctor.exists({ email: normalizedEmail }) ||
      await DoctorApplication.exists({ email: normalizedEmail, status: "pending" })) {
    return res.status(409).json({ success: false, message: "An account with this email already exists." });
  }

  const identity = await firebaseIdentity(firebaseIdToken, normalizedEmail);
  const user = await User.create({
    email: normalizedEmail,
    passwordHash: identity ? await firebasePasswordHash() : await hashPassword(password),
    role: "patient",
    ...(identity ? { firebaseUid: identity.uid } : {})
  });
  let patient;
  try {
    patient = await Patient.create({ fullName, age, gender, phone, address });
    user.patient = patient._id;
    await user.save();
  } catch (error) {
    if (patient) await Patient.deleteOne({ _id: patient._id });
    await User.deleteOne({ _id: user._id });
    throw error;
  }
  await sessionResponse(user, res, 201);
}

async function login(req, res) {
  ensureTokenSecret();
  const email = String(req.body.email || "").trim().toLowerCase();
  if (req.body.firebaseIdToken) {
    const identity = await firebaseIdentity(req.body.firebaseIdToken, email);
    let firebaseUser = await User.findOne({ $or: [{ firebaseUid: identity.uid }, { email: identity.email }] });
    if (!firebaseUser) {
      const pending = await DoctorApplication.findOne({ email: identity.email, status: "pending" });
      if (pending) return res.status(403).json({ success: false, message: "Your doctor registration is awaiting administrator approval." });
      return res.status(401).json({ success: false, message: "This Firebase account is not linked to a MediCore patient or doctor account." });
    }
    if (!['patient', 'doctor'].includes(firebaseUser.role)) {
      return res.status(403).json({ success: false, message: "Use the hospital account sign-in for this account type." });
    }
    if (!firebaseUser.firebaseUid) {
      firebaseUser.firebaseUid = identity.uid;
      await firebaseUser.save();
    }
    return sessionResponse(firebaseUser, res);
  }
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (password.length > 128) {
    return res.status(401).json({ success: false, message: "Email or password is incorrect." });
  }
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) {
    const application = await DoctorApplication.findOne({ email, status: "pending" }).select("+passwordHash");
    if (application && await verifyPassword(password, application.passwordHash)) {
      return res.status(403).json({ success: false, message: "Your doctor registration is awaiting administrator approval." });
    }
    return res.status(401).json({ success: false, message: "Email or password is incorrect." });
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ success: false, message: "Email or password is incorrect." });
  }
  await sessionResponse(user, res);
}

async function registerDoctor(req, res) {
  ensureTokenSecret();
  const { fullName, email, password, phone, specialization, availability, firebaseIdToken } = req.body;
  if (!fullName || !email || !password || !phone || !specialization || !availability) {
    return res.status(400).json({ success: false, message: "Name, email, password, phone, specialization, and availability are required." });
  }
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    return res.status(400).json({ success: false, message: "Password must be between 12 and 128 characters." });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ success: false, message: "Please provide a valid email address." });
  }
  if (await User.exists({ email: normalizedEmail }) ||
      await Doctor.exists({ email: normalizedEmail }) ||
      await DoctorApplication.exists({ email: normalizedEmail, status: "pending" })) {
    return res.status(409).json({ success: false, message: "An account or doctor registration with this email already exists." });
  }
  const identity = await firebaseIdentity(firebaseIdToken, normalizedEmail);
  const doctor = await Doctor.create({
    fullName,
    email: normalizedEmail,
    phone,
    specialization,
    availability,
    reviewStatus: "pending"
  });
  let application;
  try {
    application = await DoctorApplication.create({
      doctor: doctor._id,
      fullName,
      email: normalizedEmail,
      passwordHash: identity ? await firebasePasswordHash() : await hashPassword(password),
      phone,
      specialization,
      availability,
      ...(identity ? { firebaseUid: identity.uid } : {})
    });
  } catch (error) {
    if (application) await DoctorApplication.deleteOne({ _id: application._id });
    await Doctor.deleteOne({ _id: doctor._id });
    throw error;
  }
  const notificationWarning = await attemptNotifications([notifyRoles(["admin"], {
    type: "doctor-application",
    title: "Doctor registration for review",
    message: "A new doctor registration is awaiting your review.",
    href: "doctors.html"
  })]);
  res.status(202).json({
    success: true,
    message: "Your profile is now visible in the doctor directory as pending review. You can sign in after an administrator approves your account.",
    notificationWarning
  });
}

async function listDoctorApplications(req, res) {
  const applications = await DoctorApplication.find({ status: "pending" })
    .select("fullName email phone specialization availability createdAt")
    .sort({ createdAt: 1 });
  res.json({ success: true, count: applications.length, data: applications });
}

async function approveDoctorApplication(req, res) {
  ensureTokenSecret();
  const application = await DoctorApplication.findOne({ _id: req.params.id, status: "pending" }).select("+passwordHash");
  if (!application) return res.status(404).json({ success: false, message: "Pending doctor registration not found." });
  if (await User.exists({ email: application.email })) {
    return res.status(409).json({ success: false, message: "This email is already linked to an account." });
  }

  let doctor = application.doctor
    ? await Doctor.findById(application.doctor)
    : await Doctor.findOne({ email: application.email });
  let createdDoctor = false;
  if (!doctor) {
    doctor = await Doctor.create({
      fullName: application.fullName,
      email: application.email,
      phone: application.phone,
      specialization: application.specialization,
      availability: application.availability,
      reviewStatus: "pending"
    });
    createdDoctor = true;
  }
  if (doctor.reviewStatus !== "pending") {
    return res.status(409).json({ success: false, message: "This doctor profile is no longer awaiting approval." });
  }
  let doctorUser;
  try {
    doctorUser = await User.create({
      email: application.email,
      passwordHash: application.firebaseUid ? await firebasePasswordHash() : application.passwordHash,
      role: "doctor",
      doctor: doctor._id,
      ...(application.firebaseUid ? { firebaseUid: application.firebaseUid } : {})
    });
    doctor.reviewStatus = "approved";
    await doctor.save();
    const review = await DoctorApplication.updateOne(
      { _id: application._id, status: "pending" },
      { $set: { status: "approved", reviewedAt: new Date() }, $unset: { passwordHash: 1 } }
    );
    if (review.modifiedCount !== 1) throw new Error("Doctor registration was already reviewed.");
  } catch (error) {
    await User.deleteOne({ email: application.email, doctor: doctor._id });
    if (createdDoctor) await Doctor.deleteOne({ _id: doctor._id });
    else {
      doctor.reviewStatus = "pending";
      await doctor.save();
    }
    throw error;
  }
  const notificationWarning = await attemptNotifications([createForUsers([doctorUser._id], {
    type: "doctor-application",
    title: "Doctor registration approved",
    message: "Your doctor account is approved and ready to use.",
    href: "dashboard.html"
  })]);
  res.json({ success: true, message: "Doctor registration approved. The applicant can now sign in.", data: { doctor }, notificationWarning });
}

async function rejectDoctorApplication(req, res) {
  const application = await DoctorApplication.findOne({ _id: req.params.id, status: "pending" });
  if (!application) return res.status(404).json({ success: false, message: "Pending doctor registration not found." });
  const review = await DoctorApplication.updateOne(
    { _id: application._id, status: "pending" },
    { $set: { status: "rejected", reviewedAt: new Date() }, $unset: { passwordHash: 1 } }
  );
  if (review.matchedCount !== 1) return res.status(404).json({ success: false, message: "Pending doctor registration not found." });
  if (application.doctor) {
    await Doctor.updateOne({ _id: application.doctor, reviewStatus: "pending" }, { $set: { reviewStatus: "rejected" } });
  } else {
    await Doctor.updateOne({ email: application.email, reviewStatus: "pending" }, { $set: { reviewStatus: "rejected" } });
  }
  res.json({ success: true, message: "Doctor registration rejected." });
}

async function currentUser(req, res) {
  let profile = null;
  if (req.user.doctor) profile = await Doctor.findById(req.user.doctor).select("fullName");
  if (req.user.patient) profile = await Patient.findById(req.user.patient).select("fullName");
  res.json({ success: true, data: { user: publicUser(req.user, profile) } });
}

async function logout(req, res) {
  req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
  await req.user.save();
  res.json({ success: true, message: "Signed out." });
}

async function changePassword(req, res) {
  ensureTokenSecret();
  const { currentPassword, newPassword } = req.body;
  if (typeof currentPassword !== "string" || typeof newPassword !== "string" ||
      newPassword.length < 12 || newPassword.length > 128) {
    return res.status(400).json({ success: false, message: "Enter your current password and a new password of 12 to 128 characters." });
  }
  const user = await User.findById(req.user._id).select("+passwordHash");
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return res.status(400).json({ success: false, message: "Current password is incorrect." });
  }
  user.passwordHash = await hashPassword(newPassword);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  res.json({ success: true, data: { token: createToken(user) } });
}

async function createDoctorAccount(req, res) {
  ensureTokenSecret();
  const { fullName, specialization, roomNumber, phone, email, availability, password } = req.body;
  const healthConcernResult = normalizeHealthConcerns(req.body.healthConcerns);
  if (healthConcernResult.error) {
    return res.status(400).json({ success: false, message: healthConcernResult.error });
  }
  if (!fullName || !specialization || !phone || !email || !availability || !password) {
    return res.status(400).json({ success: false, message: "All doctor details and a temporary password are required." });
  }
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    return res.status(400).json({ success: false, message: "Password must be between 12 and 128 characters." });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (await User.exists({ email: normalizedEmail }) ||
      await Doctor.exists({ email: normalizedEmail }) ||
      await DoctorApplication.exists({ email: normalizedEmail, status: "pending" })) {
    return res.status(409).json({ success: false, message: "An account or doctor record with this email already exists." });
  }

  const doctor = await Doctor.create({
    fullName, specialization, roomNumber, phone, email: normalizedEmail, availability,
    healthConcerns: healthConcernResult.concerns
  });
  let firebaseUser;
  try {
    firebaseUser = await createFirebaseUser(normalizedEmail, password);
    await User.create({
      email: normalizedEmail,
      passwordHash: await firebasePasswordHash(),
      role: "doctor",
      doctor: doctor._id,
      firebaseUid: firebaseUser.uid
    });
  } catch (error) {
    if (firebaseUser) await deleteFirebaseUser(firebaseUser.uid).catch(() => {});
    await Doctor.deleteOne({ _id: doctor._id });
    throw error;
  }
  res.status(201).json({ success: true, data: { doctor } });
}

async function createExistingDoctorAccount(req, res) {
  ensureTokenSecret();
  const { password } = req.body;
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    return res.status(400).json({ success: false, message: "Password must be between 12 and 128 characters." });
  }
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found." });
  if (await User.exists({ $or: [{ doctor: doctor._id }, { email: doctor.email }] })) {
    return res.status(409).json({ success: false, message: "This doctor already has an account or the email is already in use." });
  }
  let firebaseUser;
  try {
    firebaseUser = await createFirebaseUser(doctor.email, password);
    await User.create({
      email: doctor.email,
      passwordHash: await firebasePasswordHash(),
      role: "doctor",
      doctor: doctor._id,
      firebaseUid: firebaseUser.uid
    });
  } catch (error) {
    if (firebaseUser) await deleteFirebaseUser(firebaseUser.uid).catch(() => {});
    throw error;
  }
  res.status(201).json({ success: true, data: { doctor } });
}

async function createExistingPatientAccount(req, res) {
  ensureTokenSecret();
  const { email, password } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ success: false, message: "Please provide a valid email address." });
  }
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    return res.status(400).json({ success: false, message: "Password must be between 12 and 128 characters." });
  }
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.status(404).json({ success: false, message: "Patient not found." });
  if (await User.exists({ $or: [{ patient: patient._id }, { email: normalizedEmail }] })) {
    return res.status(409).json({ success: false, message: "This patient already has an account or the email is already in use." });
  }
  let firebaseUser;
  try {
    firebaseUser = await createFirebaseUser(normalizedEmail, password);
    await User.create({
      email: normalizedEmail,
      passwordHash: await firebasePasswordHash(),
      role: "patient",
      patient: patient._id,
      firebaseUid: firebaseUser.uid
    });
  } catch (error) {
    if (firebaseUser) await deleteFirebaseUser(firebaseUser.uid).catch(() => {});
    throw error;
  }
  res.status(201).json({ success: true, data: { patient } });
}

async function createReceptionistAccount(req, res) {
  ensureTokenSecret();
  const displayName = typeof req.body.displayName === "string" ? req.body.displayName.trim() : "";
  const normalizedEmail = String(req.body.email || "").trim().toLowerCase();
  const { password } = req.body;
  if (!displayName || displayName.length > 120 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ success: false, message: "Enter a receptionist name and a valid email address." });
  }
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    return res.status(400).json({ success: false, message: "Password must be between 12 and 128 characters." });
  }
  if (await User.exists({ email: normalizedEmail }) ||
      await Doctor.exists({ email: normalizedEmail }) ||
      await DoctorApplication.exists({ email: normalizedEmail })) {
    return res.status(409).json({ success: false, message: "This email is already in use." });
  }
  const user = await User.create({
    displayName,
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    role: "receptionist"
  });
  res.status(201).json({ success: true, data: { id: String(user._id), displayName: user.displayName, email: user.email } });
}

async function createAdminAccount(req, res) {
  ensureTokenSecret();
  const normalizedEmail = String(req.body.email || "").trim().toLowerCase();
  const { password } = req.body;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ success: false, message: "Enter a valid administrator email address." });
  }
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    return res.status(400).json({ success: false, message: "Password must be between 12 and 128 characters." });
  }
  if (await User.exists({ email: normalizedEmail }) ||
      await Doctor.exists({ email: normalizedEmail }) ||
      await DoctorApplication.exists({ email: normalizedEmail })) {
    return res.status(409).json({ success: false, message: "This email is already in use. Each staff account needs a unique email address." });
  }
  const user = await User.create({
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    role: "admin"
  });
  res.status(201).json({ success: true, data: { id: String(user._id), email: user.email, role: user.role } });
}

module.exports = {
  registerPatient,
  registerDoctor,
  login,
  requestPasswordReset,
  resetPassword,
  listDoctorApplications,
  approveDoctorApplication,
  rejectDoctorApplication,
  currentUser,
  logout,
  changePassword,
  createDoctorAccount,
  createExistingDoctorAccount,
  createExistingPatientAccount,
  createReceptionistAccount,
  createAdminAccount
};
