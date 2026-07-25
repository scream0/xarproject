// src/utils/authHelpers.js
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import { auth } from "@/lib/firebaseClient"; // Sesuaikan path jika berbeda (misal: "../lib/firebaseClient")

// --- HELPER INTERNAL (PRIVATE) ---

// 1. Helper untuk membuat Cookie Sesi di Server
async function setSessionCookie(user) {
  const token = await user.getIdToken();
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    throw new Error("Gagal membuat sesi cookie di server.");
  }
}

// 2. Helper untuk sinkronisasi data user ke database via API
async function syncUserToServer(userData) {
  try {
    await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });
  } catch (err) {
    console.error("Gagal menyinkronkan user ke server:", err);
  }
}

// ==========================================
// EKSPOR FUNGSI AUTENTIKASI
// ==========================================

/**
 * 1. Login dengan Email & Password
 */
export const loginWithEmail = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(
    auth,
    email,
    password,
  );
  const user = userCredential.user;

  await syncUserToServer({
    uid: user.uid,
    email: user.email,
    name: user.displayName || "User",
    phone: user.phoneNumber || "",
  });

  await setSessionCookie(user);
  return user;
};

/**
 * 2. Registrasi Akun Baru (Email & Password)
 */
export const registerWithEmail = async (name, email, password) => {
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );
  const user = userCredential.user;

  await updateProfile(user, { displayName: name });
  await sendEmailVerification(user);

  await syncUserToServer({
    uid: user.uid,
    email: user.email,
    name: name,
    phone: "",
    role: "user",
  });

  await setSessionCookie(user);
  return user;
};

/**
 * 3. Login dengan Google Popup
 */
export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  await syncUserToServer({
    uid: user.uid,
    email: user.email,
    name: user.displayName || "User",
    phone: user.phoneNumber || "",
    role: "user",
  });

  await setSessionCookie(user);
  return user;
};

/**
 * 4. Kirim Kode OTP via SMS (Nomor HP)
 */
export const sendOtpCode = async (phoneInput) => {
  let formattedPhone = phoneInput.trim();
  if (formattedPhone.startsWith("0")) {
    formattedPhone = "+62" + formattedPhone.substring(1);
  } else if (formattedPhone.startsWith("8")) {
    formattedPhone = "+62" + formattedPhone;
  }

  if (!formattedPhone.startsWith("+")) {
    throw new Error("Format nomor HP tidak valid.");
  }

  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(
      auth,
      "recaptcha-container",
      {
        size: "invisible",
        callback: () => {},
      },
    );
  }

  const appVerifier = window.recaptchaVerifier;
  const confirmation = await signInWithPhoneNumber(
    auth,
    formattedPhone,
    appVerifier,
  );

  return { confirmation, formattedPhone };
};

/**
 * 5. Verifikasi Kode OTP dan Login
 */
export const verifyOtpAndLogin = async (confirmationResult, otpCode) => {
  const result = await confirmationResult.confirm(otpCode);
  const user = result.user;

  await syncUserToServer({
    uid: user.uid,
    email: user.email || "",
    name: user.displayName || "User",
    phone: user.phoneNumber || "",
    role: "user",
  });

  await setSessionCookie(user);
  return user;
};

/**
 * 6. Kirim Email Reset Password
 */
export const resetPassword = async (email) => {
  await sendPasswordResetEmail(auth, email);
};

/**
 * 7. Logout Pengguna (Hapus Cookie Sesi & Firebase Auth)
 */
export const logoutUser = async () => {
  try {
    // Hapus session cookie di server
    await fetch("/api/auth/logout", { method: "POST" });

    // Keluar dari sesi Firebase client
    await signOut(auth);

    // Redirect bersih ke halaman login
    window.location.replace("/login");
  } catch (error) {
    console.error("Terjadi kesalahan saat logout:", error);
  }
};
