const User = require("../models/User");
const { ensureTokenSecret, hashPassword } = require("./authTokens");

async function bootstrapAdmin() {
  const email = String(process.env.INITIAL_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email && !password) {
    console.error("Initial admin is not configured. Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD in backend/.env.");
    return;
  }
  if (!email || !password || password.length < 12) {
    console.error("Initial admin configuration is incomplete. Set a valid INITIAL_ADMIN_EMAIL and an INITIAL_ADMIN_PASSWORD of at least 12 characters.");
    return;
  }
  ensureTokenSecret();
  if (await User.exists({ role: "admin" })) return;

  await User.create({ email, passwordHash: await hashPassword(password), role: "admin" });
  console.log(`Initial administrator account created for ${email}.`);
}

module.exports = bootstrapAdmin;
