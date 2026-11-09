const assert = require("node:assert/strict");
const { once } = require("node:events");
const { after, before, test } = require("node:test");
process.env.AUTH_TOKEN_SECRET = "test-only-secret-that-is-long-enough-for-auth";
const app = require("../app");
const { errorHandler } = require("../middleware/errorHandler");
const { requireRoles } = require("../middleware/authenticate");
const { createToken, ensureTokenSecret, hashPassword, verifyPassword, verifyToken } = require("../utils/authTokens");
const { assertEmailConfiguration } = require("../utils/sendPasswordResetEmail");
const normalizeHealthConcerns = require("../utils/normalizeHealthConcerns");
const { demoDoctors } = require("../utils/seedDemoDoctors");
const appointmentsController = require("../controllers/appointmentsController");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");
const Visit = require("../models/Visit");
const Notification = require("../models/Notification");
const ChatConversation = require("../models/ChatConversation");
const ChatMessage = require("../models/ChatMessage");

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("doctor health concerns are trimmed, de-duplicated, and validated", () => {
  assert.deepEqual(normalizeHealthConcerns([" Asthma ", "asthma", "Allergies"]), {
    concerns: ["Asthma", "Allergies"]
  });
  assert.deepEqual(normalizeHealthConcerns("asthma, allergies"), {
    concerns: ["asthma", "allergies"]
  });
  assert.match(normalizeHealthConcerns(["x".repeat(81)]).error, /80 characters/);
  assert.match(normalizeHealthConcerns([3]).error, /must be text/);
});

test("the prototype doctor directory includes the requested demo specialists", () => {
  const expectedDoctors = [
    ["Dr. Farhad Wardak", "Ophthalmology"],
    ["Dr. Freshta Rahimi", "Cardiology"],
    ["Dr. Jawed Noori", "Nephrology"],
    ["Dr. Setayesh Karimi", "Gastroenterology"],
    ["Dr. Ehsanullah Ahmadi", "Pulmonology"],
    ["Dr. Naeem", "Radiology"]
  ];
  expectedDoctors.forEach(([fullName, specialization]) => {
    assert.ok(demoDoctors.some((doctor) => doctor.fullName === fullName && doctor.specialization === specialization));
  });
  assert.equal(new Set(demoDoctors.map((doctor) => doctor.email)).size, demoDoctors.length);
  assert.ok(demoDoctors.every((doctor) => doctor.fullName && doctor.specialization && doctor.healthConcerns.length && doctor.roomNumber));
  assert.equal(new Set(demoDoctors.map((doctor) => doctor.roomNumber)).size, demoDoctors.length);
  assert.ok(demoDoctors.filter((doctor) => expectedDoctors.some(([fullName]) => doctor.fullName === fullName))
    .every((doctor) => doctor.availability === "Contact reception for appointment availability"));
});

test("doctor profiles own room numbers instead of appointments", () => {
  const doctorError = new Doctor({
    fullName: "Room Test Doctor",
    specialization: "General Practice",
    phone: "000",
    email: "room-doctor@example.test",
    availability: "Weekdays"
  }).validateSync();
  assert.equal(doctorError, undefined);
  assert.equal(new Doctor().roomNumber, "Unassigned");
  assert.equal(new Doctor().reviewStatus, "approved");
  const doctorProfile = {
    fullName: "Review Test Doctor",
    specialization: "General Practice",
    phone: "000",
    email: "review-doctor@example.test",
    availability: "Weekdays"
  };
  assert.equal(new Doctor({ ...doctorProfile, reviewStatus: "pending" }).validateSync(), undefined);
  assert.match(new Doctor({ ...doctorProfile, reviewStatus: "unknown" }).validateSync().message, /reviewStatus/);
  assert.equal(Object.hasOwn(Appointment.schema.paths, "room"), false);
});

test("appointments can wait for reception to assign a doctor", () => {
  const appointment = new Appointment({
    patient: "507f1f77bcf86cd799439011",
    appointmentDate: new Date("2026-11-10T00:00:00.000Z"),
    appointmentTime: "10:30",
    healthConcern: "Eye concern",
    needsDoctorAssignment: true
  });
  assert.equal(appointment.validateSync(), undefined);
  assert.equal(appointment.doctor, null);
  assert.equal(appointment.needsDoctorAssignment, true);
  assert.match(new Appointment({
    ...appointment.toObject(),
    healthConcern: "x".repeat(501)
  }).validateSync().message, /healthConcern/);
});

test("walk-in payment receipts require valid currency, amount, and payment method", () => {
  const visit = new Visit({
    patient: "507f1f77bcf86cd799439011",
    visitDate: new Date("2026-11-09T00:00:00.000Z"),
    condition: "Walk-in consultation",
    amountMinor: 12550,
    currency: "USD",
    paymentMethod: "Cash",
    receivedBy: "507f1f77bcf86cd799439012"
  });
  assert.equal(visit.validateSync(), undefined);
  assert.match(new Visit({ ...visit.toObject(), currency: "EUR" }).validateSync().message, /currency/);
  assert.match(new Visit({ ...visit.toObject(), amountMinor: 12.5 }).validateSync().message, /amountMinor/);
});

test("notifications require a recipient and a local destination", () => {
  const notification = new Notification({
    recipient: "507f1f77bcf86cd799439011",
    type: "appointment",
    title: "Appointment updated",
    message: "Your appointment details have been updated.",
    href: "patient.html#appointments"
  });
  assert.equal(notification.validateSync(), undefined);
  assert.match(new Notification({ ...notification.toObject(), href: "https://example.test" }).validateSync().message, /href/);
  assert.equal(new Notification({ ...notification.toObject(), type: "chat" }).validateSync(), undefined);
});

test("patient chat records require a patient, sender, and bounded message", () => {
  const conversation = new ChatConversation({ patient: "507f1f77bcf86cd799439011" });
  assert.equal(conversation.validateSync(), undefined);
  const message = new ChatMessage({
    conversation: "507f1f77bcf86cd799439012",
    sender: "507f1f77bcf86cd799439011",
    senderRole: "patient",
    content: "I need help finding a doctor."
  });
  assert.equal(message.validateSync(), undefined);
  assert.match(new ChatMessage({ ...message.toObject(), senderRole: "doctor" }).validateSync().message, /senderRole/);
  assert.match(new ChatMessage({ ...message.toObject(), content: "x".repeat(2001) }).validateSync().message, /content/);
});

test("Google patients without a profile must complete it before requesting appointments", async () => {
  let responseStatus;
  let responseBody;
  const response = {
    status(status) {
      responseStatus = status;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };
  await appointmentsController.createAppointment({
    user: { role: "patient", patient: null },
    body: { doctor: "507f1f77bcf86cd799439011", appointmentDate: "2026-11-10", appointmentTime: "10:30" }
  }, response);
  assert.equal(responseStatus, 403);
  assert.match(responseBody.message, /Complete your patient profile/);
});

test("receptionist accounts are valid users with a display name", () => {
  const error = new User({
    email: "receptionist@example.test",
    passwordHash: "hashed-password",
    role: "receptionist",
    displayName: "Front Desk"
  }).validateSync();
  assert.equal(error, undefined);
});

test("password reset email requires valid SMTP configuration", () => {
  const keys = ["APP_BASE_URL", "EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASSWORD", "EMAIL_FROM", "EMAIL_SECURE"];
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    APP_BASE_URL: "http://localhost:5000",
    EMAIL_HOST: "smtp.example.test",
    EMAIL_PORT: "587",
    EMAIL_USER: "sender@example.test",
    EMAIL_PASSWORD: "test-password",
    EMAIL_FROM: "MediCore <sender@example.test>",
    EMAIL_SECURE: "false"
  });
  try {
    assert.doesNotThrow(assertEmailConfiguration);
    process.env.EMAIL_PORT = "not-a-port";
    assert.throws(assertEmailConfiguration, /EMAIL_PORT must be a valid TCP port/);
  } finally {
    keys.forEach((key) => {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    });
  }
});

test("health endpoint returns the API envelope", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.message, "MediCore API is running");
  assert.ok(["disconnected", "connected", "connecting", "disconnecting", "unknown"].includes(body.database));
});

test("guest demo page is available without signing in", async () => {
  const response = await fetch(`${baseUrl}/demo.html`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /GUEST PREVIEW · VIEW ONLY/);
  assert.match(html, /Explore hospital information in the guest preview\. Sign in or select Create Account to access role-specific features/);
  assert.match(html, /Your life is precious\. Your health matters\./);
  assert.match(html, /Never lose hope/);
  assert.match(html, /src="images\/guest-care\.png"/);
  assert.match(html, /href="login\.html">Sign in/);
  assert.match(html, /href="register\.html">Create patient account/);
  assert.doesNotMatch(html, /id="demoBookingForm"/);
  const imageResponse = await fetch(`${baseUrl}/images/guest-care.png`);
  assert.equal(imageResponse.status, 200);
  assert.match(imageResponse.headers.get("content-type"), /image\/png/);
});

test("contact page submits to Formspree and contact API validates legacy submissions", async () => {
  const pageResponse = await fetch(`${baseUrl}/contact.html`);
  assert.equal(pageResponse.status, 200);
  const contactHtml = await pageResponse.text();
  assert.match(contactHtml, /id="contactForm"/);
  assert.match(contactHtml, /action="https:\/\/formspree\.io\/f\/xyeeqzlj"/);
  assert.match(contactHtml, /name="_gotcha"/);
  assert.match(contactHtml, /MediCore Community Hospital/);
  assert.match(contactHtml, /href="tel:\+602341542450"/);
  assert.match(contactHtml, /Kuala Lumpur City Centre \(KLCC\), Kuala Lumpur/);
  assert.match(contactHtml, /View location on map/);
  for (const page of ["demo.html", "login.html", "register.html", "contact.html"]) {
    assert.match(contactHtml, new RegExp(`href="${page}"`));
  }
  assert.match(contactHtml, /id="sidebar"/);
  assert.match(contactHtml, /id="topbar"/);
  assert.match(contactHtml, /data-page="contact"/);
  const [loginHtml, registerHtml] = await Promise.all([
    fetch(`${baseUrl}/login.html`).then((response) => response.text()),
    fetch(`${baseUrl}/register.html`).then((response) => response.text())
  ]);
  assert.match(loginHtml, /href="contact\.html">Contact/);
  assert.match(registerHtml, /href="contact\.html">Contact/);
  for (const role of ["patient", "doctor", "admin", "receptionist"]) {
    assert.match(loginHtml, new RegExp(`<option value="${role}">`));
  }
  assert.match(loginHtml, /Continue as guest/);
  assert.match(loginHtml, /Continue with Google/);
  assert.match(loginHtml, /Create Account/);
  assert.match(registerHtml, /id="patientRoleOption"/);
  assert.match(registerHtml, /id="doctorRoleOption"/);
  assert.doesNotMatch(registerHtml, /id="adminRoleOption"|id="receptionistRoleOption"/);
  const invalidResponse = await fetch(`${baseUrl}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "" })
  });
  assert.equal(invalidResponse.status, 400);
  assert.match((await invalidResponse.json()).message, /complete all contact form fields|Enter your name/);
});

test("front-desk page is available and walk-in registration requires authentication", async () => {
  const pageResponse = await fetch(`${baseUrl}/front-desk.html`);
  assert.equal(pageResponse.status, 200);
  assert.match(await pageResponse.text(), /Print \/ Save PDF/);
  const apiResponse = await fetch(`${baseUrl}/api/front-desk/walk-ins`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  assert.equal(apiResponse.status, 401);
});

test("notification endpoints require an authenticated account", async () => {
  const [listResponse, readResponse, readAllResponse] = await Promise.all([
    fetch(`${baseUrl}/api/notifications`),
    fetch(`${baseUrl}/api/notifications/507f1f77bcf86cd799439011/read`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true })
    }),
    fetch(`${baseUrl}/api/notifications/read-all`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true })
    })
  ]);
  assert.equal(listResponse.status, 401);
  assert.equal(readResponse.status, 401);
  assert.equal(readAllResponse.status, 401);
});

test("patient and staff pages load the in-app notification center", async () => {
  const [patientResponse, dashboardResponse] = await Promise.all([
    fetch(`${baseUrl}/patient.html`),
    fetch(`${baseUrl}/dashboard.html`)
  ]);
  const patientHtml = await patientResponse.text();
  assert.match(patientHtml, /notification-button/);
  assert.match(patientHtml, /id="profileCompletionNotice"/);
  assert.match(patientHtml, /href="google-profile\.html">Complete profile/);
  const patientScript = await fetch(`${baseUrl}/js/patient.js`).then((response) => response.text());
  assert.match(patientScript, /Complete your patient profile before requesting an appointment/);
  const apiScript = await fetch(`${baseUrl}/js/api.js`).then((response) => response.text());
  assert.match(apiScript, /handoffToken/);
  const dashboardHtml = await dashboardResponse.text();
  assert.match(dashboardHtml, /js\/notifications\.js/);
  const appScript = await fetch(`${baseUrl}/js/app.js`).then((response) => response.text());
  assert.match(appScript, /class="notification-panel"/);
});

test("password recovery pages are available and linked from login", async () => {
  const [loginResponse, forgotResponse, resetResponse] = await Promise.all([
    fetch(`${baseUrl}/login.html`),
    fetch(`${baseUrl}/forgot-password.html`),
    fetch(`${baseUrl}/reset-password.html`)
  ]);
  assert.equal(loginResponse.status, 200);
  assert.match(await loginResponse.text(), /href="forgot-password\.html">Forgot password\?/);
  assert.equal(forgotResponse.status, 200);
  assert.match(await forgotResponse.text(), /forgotPasswordForm/);
  assert.equal(resetResponse.status, 200);
  const resetHtml = await resetResponse.text();
  assert.match(resetHtml, /resetPasswordForm/);
  assert.match(resetHtml, /name="referrer" content="no-referrer"/);
});

test("patient page navigation links directly to dashboard sections and contact", async () => {
  const response = await fetch(`${baseUrl}/patient.html`);
  assert.equal(response.status, 200);
  const html = await response.text();
  for (const section of ["home", "appointments", "doctors", "chat", "location"]) {
    assert.match(html, new RegExp(`href="#${section}"`));
    assert.match(html, new RegExp(`id="${section}"`));
  }
  assert.match(html, /href="contact\.html">Contact/);
});

test("patient specialty guide and staff chat pages are wired", async () => {
  const [patientResponse, chatResponse, chatApiResponse] = await Promise.all([
    fetch(`${baseUrl}/patient.html`),
    fetch(`${baseUrl}/chat.html`),
    fetch(`${baseUrl}/api/chat/conversations`)
  ]);
  const patientHtml = await patientResponse.text();
  const chatHtml = await chatResponse.text();
  const patientScript = await fetch(`${baseUrl}/js/patient.js`).then((response) => response.text());
  const staffScript = await fetch(`${baseUrl}/js/chat.js`).then((response) => response.text());
  assert.match(patientHtml, /id="careChatLauncher"/);
  assert.match(patientHtml, /id="careChatPanel"[^>]+hidden/);
  assert.match(patientHtml, /id="specialtyGuideForm"/);
  assert.match(patientHtml, /id="careChatMessages"/);
  assert.doesNotMatch(patientHtml, /id="patientChatForm"/);
  assert.match(patientHtml, /I can explain specialties and show listed doctors, but I can’t diagnose/);
  assert.match(patientScript, /startPatientChat/);
  assert.match(patientScript, /function appendCareChatBubble/);
  assert.match(patientScript, /function renderSpecialtyGuide/);
  assert.match(patientScript, /Hi! I’m MediCore’s care guide\. Welcome!/);
  assert.match(patientScript, /You’re welcome! I’m here if you need anything else/);
  assert.match(patientScript, /MediCore means “Essential Medical Care” or “At the Heart of Medicine\.”/);
  assert.match(patientScript, /what does medicore mean/);
  assert.match(patientScript, /MediCore Community Hospital is in Kuala Lumpur City Centre/);
  assert.match(patientScript, /Open Contact page/);
  assert.match(patientScript, /Request an appointment/);
  assert.match(patientScript, /Reception can help register your visit and record your payment/);
  assert.match(patientScript, /function handleCareGuideMessage/);
  assert.match(patientScript, /You’re welcome! I’m here if you need anything else/);
  assert.match(patientScript, /What would you like to do\?/);
  assert.match(patientScript, /Hospital location/);
  assert.match(patientScript, /earache.*ear pain.*ear problem.*ear issue/);
  assert.match(patientScript, /ENT \(ear, nose, and throat\)/);
  assert.match(patientScript, /You’re back with MediCore Assistant/);
  assert.match(chatHtml, /Open conversations/);
  assert.match(chatHtml, /js\/chat\.js/);
  assert.match(staffScript, /\/chat\/conversations/);
  assert.equal(chatApiResponse.status, 401);
});

test("patient appointment booking offers concern-based doctor suggestions", async () => {
  const [pageResponse, scriptResponse] = await Promise.all([
    fetch(`${baseUrl}/patient.html`),
    fetch(`${baseUrl}/js/patient.js`)
  ]);
  const html = await pageResponse.text();
  const script = await scriptResponse.text();
  assert.match(html, /id="bookingConcern"/);
  assert.match(html, /What is your health issue or condition\?/);
  assert.match(html, /id="bookingDoctorHelp"/);
  assert.match(html, /id="noMatchingDoctorHelp"/);
  assert.match(html, /Ask reception to find a suitable doctor/);
  assert.match(html, /Reception will review your condition, assign a doctor, and confirm your appointment/);
  assert.match(script, /function populateBookingDoctors\(\)/);
  assert.match(script, /Suggested matches/);
  assert.match(script, /Other available doctors/);
  assert.match(script, /needsDoctorAssignment: requestReceptionAssignment\.checked/);
  assert.match(script, /healthConcern: bookingConcern\.value\.trim\(\)/);
  assert.match(script, /doctorSelect\.disabled = needsReceptionHelp/);
  assert.match(script, /radiology.*radiologist.*imaging/);
});

test("Google sign-in gives setup guidance when OAuth credentials are missing", async () => {
  const names = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"];
  const originalValues = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  names.forEach((name) => { delete process.env[name]; });
  try {
    const response = await fetch(`${baseUrl}/api/auth/google`, { redirect: "manual" });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/login.html?google_error=not_configured");
  } finally {
    names.forEach((name) => {
      if (originalValues[name] === undefined) delete process.env[name];
      else process.env[name] = originalValues[name];
    });
  }
});

test("Google OAuth uses a browser-bound state before accepting a callback", async () => {
  const values = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI
  };
  Object.assign(process.env, {
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    GOOGLE_REDIRECT_URI: "http://localhost:5000/api/auth/google/callback"
  });
  try {
    const startResponse = await fetch(`${baseUrl}/api/auth/google`, { redirect: "manual" });
    assert.equal(startResponse.status, 302);
    const authorizationUrl = new URL(startResponse.headers.get("location"));
    assert.equal(authorizationUrl.origin, "https://accounts.google.com");
    assert.equal(authorizationUrl.searchParams.get("client_id"), "test-client-id");
    assert.equal(authorizationUrl.searchParams.get("scope"), "openid email profile");
    assert.equal(authorizationUrl.searchParams.get("prompt"), "select_account");
    const stateCookie = startResponse.headers.get("set-cookie").split(";")[0];
    const callbackResponse = await fetch(`${baseUrl}/api/auth/google/callback?state=wrong&code=test-code`, {
      headers: { Cookie: stateCookie },
      redirect: "manual"
    });
    assert.equal(callbackResponse.status, 303);
    assert.equal(callbackResponse.headers.get("location"), "/login.html?google_error=state_mismatch");
  } finally {
    Object.entries(values).forEach(([name, value]) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    });
  }
});

test("unknown routes return a JSON 404", async () => {
  const response = await fetch(`${baseUrl}/api/not-a-route`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    success: false,
    message: "Route not found: GET /api/not-a-route"
  });
});

test("private API endpoints reject requests without a signed-in user", async () => {
  const response = await fetch(`${baseUrl}/api/patients`, {
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).success, false);
});

test("doctor registration review endpoints require an administrator session", async () => {
  const response = await fetch(`${baseUrl}/api/auth/doctor-applications`);
  assert.equal(response.status, 401);
});

test("monthly revenue dashboard endpoint requires authentication", async () => {
  const response = await fetch(`${baseUrl}/api/dashboard/revenue`);
  assert.equal(response.status, 401);
});

test("malformed JSON still returns a JSON 400 before route authentication", async () => {
  const response = await fetch(`${baseUrl}/api/patients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{"
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    message: "Malformed JSON request body"
  });
});

test("patient registration reports database setup while MongoDB is disconnected", async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Test Patient",
      email: "patient@example.test",
      password: "a-secure-test-password",
      age: 30,
      gender: "Other",
      phone: "000",
      address: "Test address"
    })
  });
  assert.equal(response.status, 503);
});

for (const resource of ["patients", "doctors", "appointments"]) {
  test(`${resource} endpoints require authentication before exposing records`, async () => {
    const response = await fetch(`${baseUrl}/api/${resource}/not-an-object-id`);
    assert.equal(response.status, 401);
  });
}

test("signed sessions reject tampering and password hashes verify without storing plaintext", async () => {
  const user = { _id: "507f1f77bcf86cd799439011", tokenVersion: 0 };
  const token = createToken(user);
  assert.equal(verifyToken(token).sub, user._id);
  assert.equal(verifyToken(`${token.slice(0, -1)}x`), null);
  const hash = await hashPassword("correct horse battery staple");
  assert.notEqual(hash, "correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
  assert.equal(await verifyPassword("wrong password", hash), false);
});

test("role guards reject lower-privilege users and allow assigned roles", () => {
  const guard = requireRoles("admin");
  const denied = {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  guard({ user: { role: "patient" } }, denied, () => assert.fail("patient must not pass admin guard"));
  assert.equal(denied.statusCode, 403);
  let passed = false;
  guard({ user: { role: "admin" } }, {}, () => { passed = true; });
  assert.equal(passed, true);
  let receptionistPassed = false;
  requireRoles("receptionist")({ user: { role: "receptionist" } }, {}, () => { receptionistPassed = true; });
  assert.equal(receptionistPassed, true);
});

test("database errors return a safe JSON 500 instead of crashing", () => {
  const response = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    errorHandler(new Error("private database connection detail"), {}, response, () => {});
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, {
    success: false,
    message: "Internal server error"
  });
});

test("missing authentication configuration returns actionable setup guidance", () => {
  const originalSecret = process.env.AUTH_TOKEN_SECRET;
  delete process.env.AUTH_TOKEN_SECRET;
  const response = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  try {
    let configurationError;
    try {
      ensureTokenSecret();
    } catch (error) {
      configurationError = error;
    }
    assert.ok(configurationError);
    errorHandler(configurationError, {}, response, () => {});
  } finally {
    if (originalSecret === undefined) delete process.env.AUTH_TOKEN_SECRET;
    else process.env.AUTH_TOKEN_SECRET = originalSecret;
  }
  assert.equal(response.statusCode, 503);
  assert.match(response.body.message, /Set AUTH_TOKEN_SECRET/);
});
