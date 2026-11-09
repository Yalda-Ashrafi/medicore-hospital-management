const { randomBytes, timingSafeEqual } = require("node:crypto");
const Doctor = require("../models/Doctor");
const DoctorApplication = require("../models/DoctorApplication");
const Patient = require("../models/Patient");
const User = require("../models/User");
const { createToken, ensureTokenSecret, hashPassword } = require("../utils/authTokens");

const STATE_COOKIE = "medicoreGoogleState";

function googleConfiguration() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) return null;
  return { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, redirectUri: GOOGLE_REDIRECT_URI };
}

function loginRedirect(res, error) {
  res.redirect(303, `/login.html?google_error=${encodeURIComponent(error)}`);
}

function clearStateCookie(res, secure) {
  res.setHeader("Set-Cookie", `${STATE_COOKIE}=; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=0${secure ? "; Secure" : ""}`);
}

function roleDestination(user) {
  if (user.role === "patient") return "/patient.html";
  if (user.role === "receptionist") return "/appointments.html";
  return "/dashboard.html";
}

function start(req, res) {
  const configuration = googleConfiguration();
  if (!configuration) return loginRedirect(res, "not_configured");
  try {
    ensureTokenSecret();
  } catch (error) {
    return loginRedirect(res, "auth_not_configured");
  }

  const state = randomBytes(32).toString("base64url");
  const secure = configuration.redirectUri.startsWith("https://");
  res.setHeader("Set-Cookie", `${STATE_COOKIE}=${state}; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=600${secure ? "; Secure" : ""}`);
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: configuration.clientId,
    redirect_uri: configuration.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state
  }).toString();
  res.redirect(302, authorizationUrl.toString());
}

async function callback(req, res) {
  const configuration = googleConfiguration();
  const secure = Boolean(configuration && configuration.redirectUri.startsWith("https://"));
  const cookie = (req.get("cookie") || "").match(/(?:^|;\s*)medicoreGoogleState=([^;]+)/);
  const cookieState = cookie ? cookie[1] : "";
  const returnedState = String(req.query.state || "");
  const stateMatches = cookieState && returnedState &&
    Buffer.byteLength(cookieState) === Buffer.byteLength(returnedState) &&
    timingSafeEqual(Buffer.from(cookieState), Buffer.from(returnedState));
  clearStateCookie(res, secure);

  if (!configuration) return loginRedirect(res, "not_configured");
  if (!stateMatches) return loginRedirect(res, "state_mismatch");
  if (req.query.error) return loginRedirect(res, "cancelled");
  if (typeof req.query.code !== "string" || !req.query.code) return loginRedirect(res, "failed");

  try {
    ensureTokenSecret();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({
        code: req.query.code,
        client_id: configuration.clientId,
        client_secret: configuration.clientSecret,
        redirect_uri: configuration.redirectUri,
        grant_type: "authorization_code"
      })
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || typeof tokenData.access_token !== "string") {
      console.error("Google OAuth code exchange failed:", tokenData.error || tokenResponse.status);
      return loginRedirect(res, "failed");
    }

    const identityResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const identity = await identityResponse.json();
    if (!identityResponse.ok || identity.email_verified !== true ||
        typeof identity.email !== "string" || typeof identity.sub !== "string") {
      console.error("Google did not return a verified email identity.");
      return loginRedirect(res, "unverified");
    }

    const email = identity.email.trim().toLowerCase();
    let user = await User.findOne({ $or: [{ googleId: identity.sub }, { email }] }).select("+googleId");
    if (!user && (await Doctor.exists({ email }) || await DoctorApplication.exists({ email, status: "pending" }))) {
      return loginRedirect(res, "account_conflict");
    }
    if (user && user.googleId && user.googleId !== identity.sub) return loginRedirect(res, "account_conflict");
    if (!user) {
      user = await User.create({
        email,
        displayName: String(identity.name || identity.given_name || "").trim().slice(0, 120),
        passwordHash: await hashPassword(randomBytes(32).toString("hex")),
        googleId: identity.sub,
        role: "patient"
      });
    } else {
      user.googleId = identity.sub;
      if (!user.displayName && identity.name) user.displayName = String(identity.name).trim().slice(0, 120);
      await user.save();
    }

    const token = createToken(user);
    res.redirect(303, `${roleDestination(user)}#token=${encodeURIComponent(token)}`);
  } catch (error) {
    console.error("Google sign-in failed:", error.message);
    loginRedirect(res, "failed");
  }
}

async function completeProfile(req, res) {
  if (req.user.patient) return res.status(409).json({ success: false, message: "Your patient profile is already complete." });
  const { age, gender, phone, address } = req.body;
  const fullName = String(req.body.fullName || req.user.displayName || "").trim();
  const numericAge = Number(age);
  if (!fullName || fullName.length > 120 || !Number.isInteger(numericAge) ||
      numericAge < 0 || numericAge > 125 ||
      !["Female", "Male", "Other"].includes(gender) ||
      typeof phone !== "string" || !phone.trim() || phone.trim().length > 30 ||
      typeof address !== "string" || !address.trim() || address.trim().length > 300) {
    return res.status(400).json({ success: false, message: "Enter your name, a valid age, gender, phone number, and home address." });
  }

  const patient = await Patient.create({
    fullName,
    age: numericAge,
    gender,
    phone: phone.trim(),
    address: address.trim()
  });
  try {
    req.user.patient = patient._id;
    req.user.displayName = fullName;
    await req.user.save();
  } catch (error) {
    await Patient.deleteOne({ _id: patient._id });
    throw error;
  }
  res.json({ success: true, message: "Your patient profile is ready." });
}

module.exports = { start, callback, completeProfile };
