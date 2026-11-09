const fs = require("node:fs");
const path = require("node:path");
const admin = require("firebase-admin");

let firebaseApp;

function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    path.join(__dirname, "..", "firebase-service-account.json");
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error("Firebase Admin is not configured. Add FIREBASE_SERVICE_ACCOUNT_PATH or backend/firebase-service-account.json.");
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  return firebaseApp;
}

function firebaseAuth() {
  return getFirebaseApp() && admin.auth();
}

async function verifyFirebaseIdToken(idToken) {
  if (typeof idToken !== "string" || !idToken) throw new Error("A Firebase ID token is required.");
  return firebaseAuth().verifyIdToken(idToken);
}

async function createFirebaseUser(email, password) {
  return firebaseAuth().createUser({ email, password });
}

async function deleteFirebaseUser(uid) {
  if (uid) await firebaseAuth().deleteUser(uid);
}

module.exports = { firebaseAuth, verifyFirebaseIdToken, createFirebaseUser, deleteFirebaseUser };
