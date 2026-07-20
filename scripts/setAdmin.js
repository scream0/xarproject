const admin = require("firebase-admin");
const { getAuth } = require("firebase-admin/auth"); // Import modul auth secara eksplisit
const serviceAccount = require("./serviceAccountKey.json");

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
