// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require("firebase-admin");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getAuth } = require("firebase-admin/auth");

// Load service account credentials from environment variables
const serviceAccount = {
  project_id: process.env.FIREBASE_PROJECT_ID,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  // The private key must be a single-line string.
  // In your .env file, wrap the key in double quotes and replace newlines with \\n.
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

// Validate that the required environment variables are set
if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
  console.error(
    "Firebase Admin credentials are not set in environment variables. " +
    "Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
  );
  process.exit(1);
}

// Inisialisasi Firebase
admin.initializeApp({
  credential: admin.cert(serviceAccount),
});

// UID akun kamu
const uid = "4sUGf9NR5XPpKWH05Jtvw0pavGw2";

// Gunakan getAuth() untuk mendapatkan instance auth
getAuth()
  .setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log(`Sukses! Akun ${uid} sekarang adalah ADMIN.`);
    process.exit();
  })
  .catch((error) => {
    console.error("Gagal menetapkan custom claims:", error);
    process.exit(1);
  });
