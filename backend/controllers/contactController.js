const formspreeUrl = "https://formspree.io/f/xyeeqzlj";
const requestCounts = new Map();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRateLimited(req, res) {
  const now = Date.now();
  const current = requestCounts.get(req.ip);
  if (!current || current.resetAt <= now) {
    requestCounts.set(req.ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    if (requestCounts.size > 5000) {
      for (const [ip, entry] of requestCounts) {
        if (entry.resetAt <= now) requestCounts.delete(ip);
      }
    }
    return false;
  }
  if (current.count >= 5) {
    res.status(429).json({ success: false, message: "Too many messages were sent. Please try again later." });
    return true;
  }
  current.count += 1;
  return false;
}

async function submitContactMessage(req, res) {
  if (isRateLimited(req, res)) return;
  const { name, email, subject, message, _gotcha } = req.body;
  if (typeof _gotcha === "string" && _gotcha.trim()) {
    return res.json({ success: true, message: "Thanks for contacting us. We have received your message." });
  }
  const fields = [name, email, subject, message];
  if (fields.some((value) => typeof value !== "string")) {
    return res.status(400).json({ success: false, message: "Please complete all contact form fields." });
  }
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanSubject = subject.trim();
  const cleanMessage = message.trim();
  if (!cleanName || cleanName.length > 120 || !emailPattern.test(cleanEmail) || cleanEmail.length > 160 ||
      !cleanSubject || cleanSubject.length > 120 || cleanMessage.length < 10 || cleanMessage.length > 5000) {
    return res.status(400).json({
      success: false,
      message: "Enter your name, a valid email address, a subject, and a message between 10 and 5,000 characters."
    });
  }

  let upstream;
  try {
    upstream = await fetch(formspreeUrl, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ name: cleanName, email: cleanEmail, subject: cleanSubject, message: cleanMessage })
    });
  } catch {
    return res.status(502).json({ success: false, message: "We could not send your message right now. Please try again." });
  }
  if (!upstream.ok) {
    console.error(`Formspree rejected a contact message with status ${upstream.status}.`);
    return res.status(502).json({ success: false, message: "We could not send your message right now. Please try again." });
  }
  return res.json({ success: true, message: "Thanks for contacting us. We have received your message and will get back to you." });
}

module.exports = { submitContactMessage };
