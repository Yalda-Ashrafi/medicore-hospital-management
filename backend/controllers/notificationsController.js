const Notification = require("../models/Notification");

async function listNotifications(req, res) {
  const recipient = req.user._id;
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ recipient }).sort({ createdAt: -1 }).limit(30).lean(),
    Notification.countDocuments({ recipient, readAt: null })
  ]);
  res.json({ success: true, data: { notifications, unreadCount } });
}

async function markRead(req, res) {
  const notification = await Notification.findOne({ _id: req.params.id, recipient: req.user._id });
  if (!notification) return res.status(404).json({ success: false, message: "Notification not found." });
  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }
  res.json({ success: true, data: notification });
}

async function markAllRead(req, res) {
  const result = await Notification.updateMany(
    { recipient: req.user._id, readAt: null },
    { $set: { readAt: new Date() } }
  );
  res.json({ success: true, data: { updatedCount: result.modifiedCount } });
}

module.exports = { listNotifications, markRead, markAllRead };
