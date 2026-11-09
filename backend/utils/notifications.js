const User = require("../models/User");
const Notification = require("../models/Notification");

async function createForUsers(userIds, notification, excludeUserId) {
  const excluded = excludeUserId ? String(excludeUserId) : null;
  const recipients = [...new Set(userIds.map(String))].filter((id) => id !== excluded);
  if (!recipients.length) return;
  await Notification.insertMany(recipients.map((recipient) => ({ ...notification, recipient })));
}

async function notifyRoles(roles, notification, excludeUserId) {
  const users = await User.find({ role: { $in: roles } }).select("_id").lean();
  await createForUsers(users.map((user) => user._id), notification, excludeUserId);
}

async function notifyPatient(patientId, notification, excludeUserId) {
  const user = await User.findOne({ patient: patientId, role: "patient" }).select("_id").lean();
  if (user) await createForUsers([user._id], notification, excludeUserId);
}

async function notifyDoctor(doctorId, notification, excludeUserId) {
  const user = await User.findOne({ doctor: doctorId, role: "doctor" }).select("_id").lean();
  if (user) await createForUsers([user._id], notification, excludeUserId);
}

async function attemptNotifications(tasks) {
  const results = await Promise.allSettled(tasks);
  const failures = results.filter((result) => result.status === "rejected");
  failures.forEach((result) => console.error("Could not save an in-app notification:", result.reason));
  return failures.length ? "The action was completed, but some notifications could not be saved." : null;
}

module.exports = { attemptNotifications, createForUsers, notifyDoctor, notifyPatient, notifyRoles };
