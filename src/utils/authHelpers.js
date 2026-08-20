// src/utils/authHelpers.js
import { supabase } from "@/lib/supabaseClient";

// --- HELPER INTERNAL (PRIVATE) ---

// 1. Helper untuk membuat Cookie Sesi di Server
async function setSessionCookie(accessToken) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: accessToken }),
  });

  if (!response.ok) {
    throw new Error("Gagal membuat sesi cookie di server.");
  }
}

// ==========================================
// EKSPOR FUNGSI AUTENTIKASI
// ==========================================

/**
 * 1. Login dengan Email & Password
 */
export const loginWithEmail = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  const user = data.user;
  const accessToken = data.session?.access_token;

  if (accessToken) {
    await setSessionCookie(accessToken);
  }

  // Catatan: Sinkronisasi data ke tabel 'profiles' sekarang ditangani 
  // secara otomatis oleh Supabase Database Trigger (handle_new_user)

  return user;
};

/**
 * 2. Registrasi Akun Baru (Email & Password)
 */
export const registerWithEmail = async (name, email, password) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name, // Disesuaikan dengan trigger database (full_name)
        role: "customer", // Default role
      },
    },
  });

  if (error) {
    throw error;
  }

  const user = data.user;
  const accessToken = data.session?.access_token;

  // Jika sign-up otomatis menghasilkan sesi (email confirmation dimatikan)
  if (accessToken) {
    await setSessionCookie(accessToken);
  }

  // Data profil akan otomatis dibuat di tabel 'profiles' oleh Database Trigger Supabase

  return user;
};

/**
 * 3. Login dengan Google Popup
 */
export const loginWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
  });

  if (error) {
    throw error;
  }

  return data;
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

  const { data, error } = await supabase.auth.signInWithOtp({
    phone: formattedPhone,
  });

  if (error) {
    throw error;
  }

  return { phone: formattedPhone, data };
};

/**
 * 5. Verifikasi Kode OTP dan Login
 */
export const verifyOtpAndLogin = async (phone, otpCode) => {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token: otpCode,
    type: "sms",
  });

  if (error) {
    throw error;
  }

  const user = data.user;
  const accessToken = data.session?.access_token;

  if (accessToken) {
    await setSessionCookie(accessToken);
  }

  // Trigger database akan otomatis membuatkan profil jika user baru via OTP

  return user;
};

/**
 * 6. Kirim Email Reset Password
 */
export const resetPassword = async (email) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    throw error;
  }
};

/**
 * 7. Logout Pengguna (Hapus Cookie Sesi & Supabase Auth)
 */
export const logoutUser = async () => {
  try {
    // Hapus session cookie di server
    await fetch("/api/auth/logout", { method: "POST" });

    // Keluar dari sesi Supabase client
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }

    // Redirect bersih ke halaman login
    window.location.replace("/login");
  } catch (error) {
    console.error("Terjadi kesalahan saat logout:", error);
  }
};

/**
 * 8. Helper to determine if an auth state change event should be skipped
 * to prevent unnecessary re-fetching (e.g. on TOKEN_REFRESHED).
 */
export function shouldSkipAuthEvent(event, session, lastUserId) {
  if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
    return true;
  }
  
  if (session?.user?.id && session.user.id === lastUserId) {
    return true;
  }

  return false;
}
