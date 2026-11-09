const nodemailer = require("nodemailer");

function emailConfiguration() {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM, APP_BASE_URL } = process.env;
  if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASSWORD || !EMAIL_FROM || !APP_BASE_URL) {
    const error = new Error("Password reset email is not configured. Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM, and APP_BASE_URL in backend/.env.");
    error.statusCode = 503;
    error.isOperational = true;
    throw error;
  }
  const port = Number(EMAIL_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    const error = new Error("EMAIL_PORT must be a valid TCP port number.");
    error.statusCode = 503;
    error.isOperational = true;
    throw error;
  }
  let baseUrl;
  try {
    baseUrl = new URL(APP_BASE_URL);
  } catch {
    const error = new Error("APP_BASE_URL must be a valid HTTP or HTTPS URL.");
    error.statusCode = 503;
    error.isOperational = true;
    throw error;
  }
  if (!["http:", "https:"].includes(baseUrl.protocol)) {
    const error = new Error("APP_BASE_URL must use HTTP or HTTPS.");
    error.statusCode = 503;
    error.isOperational = true;
    throw error;
  }
  return {
    host: EMAIL_HOST,
    port,
    secure: process.env.EMAIL_SECURE === "true",
    auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
    from: EMAIL_FROM,
    baseUrl
  };
}

function assertEmailConfiguration() {
  emailConfiguration();
}

async function sendPasswordResetEmail(email, token) {
  const configuration = emailConfiguration();
  const resetUrl = new URL("/reset-password.html", configuration.baseUrl);
  resetUrl.searchParams.set("token", token);
  const transporter = nodemailer.createTransport({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
    auth: configuration.auth
  });
  await transporter.sendMail({
    from: configuration.from,
    to: email,
    subject: "Reset your MediCore password",
    text: `Use this one-time link to reset your MediCore password. It expires in 30 minutes:\n\n${resetUrl.toString()}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Use this one-time link to reset your MediCore password. It expires in 30 minutes:</p><p><a href="${resetUrl.toString()}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`
  });
}

module.exports = { assertEmailConfiguration, sendPasswordResetEmail };
