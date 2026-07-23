import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!serviceAccount) {
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT tidak ditemukan di environment variables. " +
      "Pastikan sudah ada di file .env.local (untuk local dev) dan sudah restart dev server.",
  );
}

// Logika cerdas: Cek apakah masih string, kalau iya baru di-parse
if (typeof serviceAccount === "string") {
  try {
    serviceAccount = JSON.parse(serviceAccount);
  } catch (e) {
    throw new Error(
      "Gagal mem-parse FIREBASE_SERVICE_ACCOUNT sebagai JSON. " +
        "Pastikan isinya adalah JSON valid dalam satu baris (bukan multi-line mentah). Detail: " +
        e.message,
    );
  }
}

// Validasi field wajib ada di service account
if (
  !serviceAccount.project_id ||
  !serviceAccount.private_key ||
  !serviceAccount.client_email
) {
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT tidak lengkap. Pastikan mengandung project_id, private_key, dan client_email.",
  );
}

// Beberapa cara menyimpan private_key di .env membuat karakter '\n'
// literal (bukan newline sungguhan) — ini perbaikannya:
if (typeof serviceAccount.private_key === "string") {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
}

// Inisialisasi Firebase
if (!getApps().length) {
  try {
    initializeApp({
      credential: cert(serviceAccount),
    });
  } catch (e) {
    throw new Error("Gagal inisialisasi Firebase Admin: " + e.message);
  }
}

export const db = getFirestore();
