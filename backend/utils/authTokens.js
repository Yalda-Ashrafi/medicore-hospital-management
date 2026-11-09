const { promisify } = require("node:util");
const { createHmac, randomBytes, scrypt: scryptCallback, timingSafeEqual } = require("node:crypto");

const scrypt = promisify(scryptCallback);
const TOKEN_LIFETIME_SECONDS = 8 * 60 * 60;

function tokenSecret() {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    const error = new Error("Authentication is not configured. Set AUTH_TOKEN_SECRET to a random secret of at least 32 characters.");
    error.statusCode = 503;
    error.isOperational = true;
    throw error;
  }
  return secret;
}
const ensureTokenSecret = () => tokenSecret();

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, passwordHash) {
  const [salt, storedKey] = String(passwordHash || "").split(":");
  if (!salt || !storedKey || !/^[a-f0-9]{128}$/i.test(storedKey)) return false;
  const derivedKey = await scrypt(password, salt, 64);
  const expected = Buffer.from(storedKey, "hex");
  return expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey);
}

function sign(payload) {
  return createHmac("sha256", tokenSecret()).update(payload).digest("base64url");
}

function createToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    sub: String(user._id),
    version: user.tokenVersion || 0,
    iat: now,
    exp: now + TOKEN_LIFETIME_SECONDS
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  const [payload, signature, extra] = String(token || "").split(".");
  if (!payload || !signature || extra) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded.sub || !Number.isInteger(decoded.exp) || decoded.exp <= Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

module.exports = { createToken, ensureTokenSecret, hashPassword, verifyPassword, verifyToken };
