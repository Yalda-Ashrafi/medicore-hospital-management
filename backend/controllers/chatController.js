const ChatConversation = require("../models/ChatConversation");
const ChatMessage = require("../models/ChatMessage");
const { attemptNotifications, createForUsers, notifyRoles } = require("../utils/notifications");

function isStaff(user) {
  return ["admin", "receptionist"].includes(user.role);
}

async function getConversation(req, res) {
  let conversation = await ChatConversation.findOne({ patient: req.user._id, status: "open" });
  if (!conversation) {
    conversation = await ChatConversation.create({ patient: req.user._id });
  }
  res.json({ success: true, data: conversation });
}

async function listConversations(req, res) {
  const filter = isStaff(req.user) ? { status: "open" } : { patient: req.user._id };
  const conversations = await ChatConversation.find(filter)
    .populate("patient", "displayName email")
    .sort({ lastMessageAt: -1 })
    .limit(100)
    .lean();
  res.json({ success: true, data: conversations });
}

async function getMessages(req, res) {
  const conversation = await ChatConversation.findById(req.params.id).select("patient status").lean();
  if (!conversation || (!isStaff(req.user) && String(conversation.patient) !== String(req.user._id))) {
    return res.status(404).json({ success: false, message: "Conversation not found." });
  }
  const messages = await ChatMessage.find({ conversation: conversation._id })
    .populate("sender", "displayName")
    .sort({ createdAt: 1 })
    .limit(500)
    .lean();
  res.json({ success: true, data: messages });
}

async function sendMessage(req, res) {
  const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
  if (!content || content.length > 2000) {
    return res.status(400).json({ success: false, message: "Message must be between 1 and 2000 characters." });
  }
  const conversation = await ChatConversation.findById(req.params.id);
  if (!conversation || (!isStaff(req.user) && String(conversation.patient) !== String(req.user._id))) {
    return res.status(404).json({ success: false, message: "Conversation not found." });
  }
  if (conversation.status !== "open") {
    return res.status(409).json({ success: false, message: "This conversation is closed." });
  }
  const message = await ChatMessage.create({
    conversation: conversation._id,
    sender: req.user._id,
    senderRole: req.user.role,
    content
  });
  conversation.lastMessage = content;
  conversation.lastMessageAt = message.createdAt;
  await conversation.save();

  const notification = req.user.role === "patient"
    ? notifyRoles(["admin", "receptionist"], {
      type: "chat",
      title: "New patient chat message",
      message: content.slice(0, 180),
      href: "chat.html"
    }, req.user._id)
    : createForUsers([conversation.patient], {
      type: "chat",
      title: "New reply from hospital staff",
      message: content.slice(0, 180),
      href: "patient.html#chat"
    }, req.user._id);
  const notificationWarning = await attemptNotifications([notification]);
  await message.populate("sender", "displayName");
  res.status(201).json({ success: true, data: message, notificationWarning });
}

module.exports = { getConversation, listConversations, getMessages, sendMessage };
