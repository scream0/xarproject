import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Ambil data
let serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

// Logika cerdas: Cek apakah masih string, kalau iya baru di-parse
if (typeof serviceAccount === "string") {
  try {
    serviceAccount = JSON.parse(serviceAccount);
  } catch (e) {
    console.error("Gagal mem-parse JSON serviceAccount:", e);
  }
}

// Inisialisasi Firebase
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

export const db = getFirestore();
